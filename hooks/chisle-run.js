#!/usr/bin/env node
// chisle — run a command and filter its output before Claude Code sees it.
//
// Claude Code hands a failed Bash call (exit != 0) to PostToolUseFailure,
// which cannot rewrite output, so chisle-compress-output.js only ever filters
// successful runs. This file closes that gap the way RTK
// (https://github.com/rtk-ai/rtk) does, rewriting the command in a PreToolUse
// hook, but with no binary:
//
//   PreToolUse hook (no args, payload on stdin): rewrites test/build/install
//     segments of a Bash command to run through this file:
//       cd app && npm test  →  cd app && node .../chisle-run.js -- npm test
//   Runner (`-- cmd args...`): runs the command, buffers stdout and stderr,
//     filters each like the PostToolUse hook would, writes them back and
//     exits with the command's own status.
//
// Claude Code checks permission rules against the rewritten command, so a
// rewrite could dodge a deny rule or trip a prompt an allow rule used to
// skip. Hence: only in bypassPermissions mode (CHISLE_COMPRESS_WRAP=1 opts in
// for every mode, =0 turns it off), and never for a program any deny/ask Bash
// rule names. Not on Windows. Anything it cannot parse is left as written.

const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawn } = require('child_process');
const { wrappable } = require('./chisle-command-filters');

const SKIP_FIRST = new Set(['sudo', 'doas', 'time', 'command', 'exec', 'nice', 'nohup', 'timeout', 'builtin',
  'noglob', 'stdbuf', 'eval', 'source', '.', '!']);
const ENV_PREFIX = /^\s*(?:[A-Za-z_]\w*=(?:'[^']*'|"(?:\\.|[^"\\])*"|[^\s'"\\])*\s+)*/;

const quote = (s) => (/^[\w@%+=:,./-]+$/.test(s) ? s : `'${s.replace(/'/g, `'\\''`)}'`);

// Top-level segments of a command as [start, end) offsets, split on && || ;
// and newlines. null for anything we will not rewrite safely: command
// substitution, subshells, groups, heredocs, background jobs, comments.
function segments(cmd) {
  const segs = [];
  let start = 0;
  let q = null;
  for (let i = 0; i < cmd.length; i++) {
    const c = cmd[i];
    if (q === "'") { if (c === "'") q = null; continue; }
    if (c === '\\') { i++; continue; }
    if (c === '$' && cmd[i + 1] === '{') { const e = cmd.indexOf('}', i); if (e < 0) return null; i = e; continue; }
    if (c === '`' || (c === '$' && cmd[i + 1] === '(')) return null;
    if (q === '"') { if (c === '"') q = null; continue; }
    if (c === "'" || c === '"') { q = c; continue; }
    if ('(){}'.includes(c) || (c === '<' && cmd[i + 1] === '<') || (c === '#' && (i === 0 || /\s/.test(cmd[i - 1])))) return null;
    let op = 0;
    if ((c === '&' && cmd[i + 1] === '&') || (c === '|' && cmd[i + 1] === '|')) op = 2;
    else if (c === ';' || c === '\n') op = 1;
    else if (c === '&') { if (cmd[i - 1] === '>' || cmd[i + 1] === '>') continue; return null; }
    else if (c === '|' && cmd[i + 1] === '&') return null;
    if (op) { segs.push([start, i]); start = i + op; i += op - 1; }
  }
  if (q) return null;
  segs.push([start, cmd.length]);
  return segs;
}

// Prefix every wrappable segment with the runner; null when nothing changes.
// `guarded` holds programs named by deny/ask rules ('*' = all of them).
function rewriteCommand(cmd, prefix, guarded = new Set()) {
  if (typeof cmd !== 'string' || !cmd.trim() || guarded.has('*') || cmd.includes(prefix.trim())) return null;
  const segs = segments(cmd);
  if (!segs) return null;
  let out = '';
  let last = -1;
  for (const [a, b] of segs) {
    const text = cmd.slice(a, b);
    const at = text.match(ENV_PREFIX)[0].length;
    const words = text.slice(at).split(/\s+/);
    if (SKIP_FIRST.has(words[0]) || words.some(w => guarded.has(w)) || !wrappable(text)) continue;
    out += cmd.slice(Math.max(last, 0), a + at) + prefix;
    last = a + at;
  }
  return last < 0 ? null : out + cmd.slice(last);
}

// Programs named by deny/ask Bash rules in every settings file Claude Code
// might read for this cwd. Over-matching only means we wrap less.
function guardedPrograms(cwd, claudeDir) {
  const files = [path.join(claudeDir, 'settings.json'), '/etc/claude-code/managed-settings.json',
    '/Library/Application Support/ClaudeCode/managed-settings.json'];
  for (let d = cwd ? path.resolve(cwd) : null; d; d = path.dirname(d) === d ? null : path.dirname(d)) {
    files.push(path.join(d, '.claude', 'settings.json'), path.join(d, '.claude', 'settings.local.json'));
  }
  const out = new Set();
  for (const f of files) {
    let perms;
    try { perms = JSON.parse(fs.readFileSync(f, 'utf8')).permissions; } catch (_) { continue; }
    for (const rule of [].concat((perms && perms.deny) || [], (perms && perms.ask) || [])) {
      if (typeof rule !== 'string') continue;
      const m = rule.match(/^Bash(?:\((.*)\))?$/);
      if (!m) continue;
      const word = (m[1] || '').trim().split(/[\s:]/)[0];
      out.add(!word || word.includes('*') ? '*' : word);
    }
  }
  return out;
}

function hook(input) {
  const payload = JSON.parse(input.replace(/^\uFEFF/, ''));
  const env = process.env;
  if (process.platform === 'win32' || env.CHISLE_COMPRESS === '0' || env.CHISLE_COMPRESS_FILTERS === '0' ||
      env.CHISLE_COMPRESS_WRAP === '0' || payload.tool_name !== 'Bash') return;
  if (payload.permission_mode !== 'bypassPermissions' && env.CHISLE_COMPRESS_WRAP !== '1') return;
  const { getClaudeDir, readFlag } = require('./chisle-config');
  const mode = readFlag(path.join(getClaudeDir(), '.chisle-active'));
  if (!mode || mode === 'off') return;
  const toolInput = payload.tool_input || {};
  const prefix = `${quote(process.execPath)} ${quote(__filename)} -- `;
  const next = rewriteCommand(toolInput.command, prefix, guardedPrograms(payload.cwd, getClaudeDir()));
  if (!next) return;
  process.stdout.write(JSON.stringify({
    hookSpecificOutput: { hookEventName: 'PreToolUse', updatedInput: { ...toolInput, command: next } },
  }));
}

function run(argv) {
  const command = argv.map(quote).join(' ');
  const child = spawn(argv[0], argv.slice(1), { stdio: ['inherit', 'pipe', 'pipe'] });
  // With `2>&1` (or Claude Code capturing both into one file) stdout and
  // stderr share a destination: keep them in one buffer, in arrival order,
  // so an error line stays where it happened instead of trailing the output.
  let merged = false;
  try { const a = fs.fstatSync(1), b = fs.fstatSync(2); merged = a.dev === b.dev && a.ino === b.ino; } catch (_) {}
  const out = [];
  const err = merged ? out : [];
  let failed = false;
  child.stdout.on('data', d => out.push(d));
  child.stderr.on('data', d => err.push(d));
  for (const sig of ['SIGINT', 'SIGTERM', 'SIGHUP']) process.on(sig, () => { try { child.kill(sig); } catch (_) {} });
  child.on('error', (e) => {
    failed = true;
    process.stderr.write(`${argv[0]}: ${e.code === 'ENOENT' ? 'command not found' : e.message}\n`);
    process.exitCode = e.code === 'ENOENT' ? 127 : 126;
  });
  child.on('close', (code, signal) => {
    if (failed) return;
    const raw = merged ? [Buffer.concat(out), Buffer.alloc(0)] : [Buffer.concat(out), Buffer.concat(err)];
    let res = raw;
    try {
      const { transform, limitsFor, recordSavings } = require('./chisle-compress-output');
      const { getClaudeDir } = require('./chisle-config');
      let saved = 0;
      res = raw.map((buf) => {
        const text = buf.toString('utf8');
        const t = text && transform(text, limitsFor(), 'Bash', getClaudeDir(), command);
        if (t == null) return buf;
        saved += text.length - t.length;
        return t.endsWith('\n') || !text.endsWith('\n') ? t : t + '\n';
      });
      if (saved > 0) recordSavings(saved, getClaudeDir());
    } catch (_) { res = raw; } // filtering must never eat output
    process.stdout.write(res[0]);
    process.stderr.write(res[1]);
    process.exitCode = code != null ? code : 128 + (os.constants.signals[signal] || 0);
  });
}

if (require.main === module) {
  const dash = process.argv.indexOf('--');
  if (dash > 1 && process.argv.length > dash + 1) run(process.argv.slice(dash + 1));
  else {
    let input = '';
    process.stdin.on('data', c => { input += c; });
    process.stdin.on('end', () => { try { hook(input); } catch (_) {} });
  }
}

module.exports = { segments, rewriteCommand, guardedPrograms };
