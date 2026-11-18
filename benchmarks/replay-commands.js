#!/usr/bin/env node
// Command corpus benchmark: what the model reads from common shell commands,
// with and without RTK and Chisle's compressor. Deterministic, zero LLM calls.
//
// Usage: node benchmarks/replay-commands.js <fixtures-dir> [--json]
//
// <fixtures-dir> holds the repos the corpus runs in (see CORPUS below):
//   chisle/     a clone of this repo with a few edits, staged and untracked files
//   gopass/ gofail/        a Go module whose tests pass / fail
//   cargopass/ cargofail/  a Rust crate whose tests pass / fail
//   noisylog/   benchmarks/agentic/fixtures/noisylog/repo (npm test, one failure)
//
// Arms, each as Claude Code would deliver it:
//   bare          raw output
//   chisle-3.12   PostToolUse compressor without command filters
//   chisle        PostToolUse compressor with command filters (3.13+)
//   rtk           the command `rtk hook claude` rewrites it to (raw if unchanged)
//   rtk+chisle    rtk's output, then the compressor; PostToolUse sees the
//                 rewritten `rtk ...` command, so the filters skip it
// Claude Code hands a failed command (exit != 0) to PostToolUseFailure, which
// cannot rewrite output, so the Chisle arms leave failures untouched. RTK runs
// before the command, so it can shrink failures too. When rtk itself errors on
// a command that works raw (e.g. `rtk find` rejects -not), the rtk arms pay the
// error plus the raw re-run the agent then needs. Every arm is capped at
// Claude Code's 30,000-char Bash output limit.

const path = require('path');
const { spawnSync } = require('child_process');
const { transform, limitsFor } = require('../hooks/chisle-compress-output');

const CORPUS = [
  ['chisle', 'git status'],
  ['chisle', 'git log -n 15'],
  ['chisle', 'git log --stat -n 5'],
  ['chisle', 'git diff'],
  ['chisle', 'git show --stat HEAD'],
  ['chisle', 'git branch -a'],
  ['chisle', 'ls -la'],
  ['chisle', 'ls -la hooks'],
  ['chisle', 'grep -rn "transform" hooks tests'],
  ['chisle', 'find . -name "*.js" -not -path "./node_modules/*" -not -path "./site/*"'],
  ['chisle', 'cat package.json'],
  ['chisle', 'wc -l hooks/*.js'],
  ['chisle', 'npm test'],
  ['chisle', 'node --test tests/test_compress.js'],
  ['chisle', 'node --test --test-reporter=tap tests/test_installer.js'],
  ['gopass', 'go test ./...'],
  ['gopass', 'go test -v ./...'],
  ['gopass', 'go vet ./...'],
  ['gofail', 'go test -v ./...'],
  ['cargopass', 'cargo build --offline'],
  ['cargopass', 'cargo test --offline'],
  ['cargofail', 'cargo test --offline'],
  ['noisylog', 'npm test'],
];

const CAP = 30000;
const cap = (s) => (s.length > CAP ? s.slice(0, CAP) : s);

function run(cmd, cwd) {
  const r = spawnSync('bash', ['-c', `{ ${cmd}\n} 2>&1`], { cwd, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024, env: { ...process.env, NO_COLOR: '1' } });
  return { text: (r.stdout || '').replace(/\n$/, ''), failed: r.status !== 0 };
}

// What RTK's installed hook would turn the command into, or the command itself.
function rtkRewrite(cmd) {
  const input = JSON.stringify({ session_id: 'bench', hook_event_name: 'PreToolUse', tool_name: 'Bash', tool_input: { command: cmd } });
  const r = spawnSync('rtk', ['hook', 'claude'], { input, encoding: 'utf8' });
  try {
    const out = JSON.parse(r.stdout).hookSpecificOutput;
    return (out && out.updatedInput && out.updatedInput.command) || cmd;
  } catch (_) { return cmd; }
}

function compress(text, failed, command, filters) {
  if (failed) return text;
  const prev = process.env.CHISLE_COMPRESS_FILTERS;
  process.env.CHISLE_COMPRESS_FILTERS = filters ? '1' : '0';
  try { return transform(text, limitsFor(), undefined, undefined, command) || text; }
  finally { if (prev === undefined) delete process.env.CHISLE_COMPRESS_FILTERS; else process.env.CHISLE_COMPRESS_FILTERS = prev; }
}

const root = process.argv[2];
if (!root) { console.error('usage: node benchmarks/replay-commands.js <fixtures-dir> [--json]'); process.exit(1); }
const ARMS = ['bare', 'chisle-3.12', 'chisle', 'rtk', 'rtk+chisle'];
const rows = [];
for (const [dir, cmd] of CORPUS) {
  const cwd = path.join(root, dir);
  const raw = run(cmd, cwd);
  const rcmd = rtkRewrite(cmd);
  const rtk = rcmd === cmd ? raw : run(rcmd, cwd);
  const rtkError = rtk.failed && !raw.failed;
  const out = {
    bare: raw.text,
    'chisle-3.12': compress(raw.text, raw.failed, cmd, false),
    chisle: compress(raw.text, raw.failed, cmd, true),
    rtk: rtkError ? rtk.text + '\n' + raw.text : rtk.text,
    'rtk+chisle': rtkError ? rtk.text + '\n' + compress(raw.text, false, 'rtk proxy ' + cmd, true) : compress(rtk.text, rtk.failed, rcmd, true),
  };
  rows.push({ dir, cmd, rtk: rcmd !== cmd, rtkError, failed: raw.failed, chars: Object.fromEntries(ARMS.map((a) => [a, cap(out[a]).length])) });
}

if (process.argv.includes('--json')) { console.log(JSON.stringify(rows, null, 2)); process.exit(0); }

const fmt = (n) => n.toLocaleString('en-US');
const pct = (a, b) => (b ? `${Math.round((100 * a) / b)}%` : '—');
console.log(`| command | ${ARMS.join(' | ')} |`);
console.log(`|---|${ARMS.map(() => '---:').join('|')}|`);
for (const r of rows) {
  const tag = `${r.dir}: \`${r.cmd.length > 46 ? r.cmd.slice(0, 45) + '…' : r.cmd}\`${r.failed ? ' (fails)' : ''}${r.rtk ? '' : ' (rtk: no rewrite)'}${r.rtkError ? ' (rtk errors, re-run raw)' : ''}`;
  console.log(`| ${tag} | ${ARMS.map((a) => fmt(r.chars[a])).join(' | ')} |`);
}
for (const [label, sel] of [['all', () => true], ['succeeded', (r) => !r.failed], ['failed', (r) => r.failed]]) {
  const rs = rows.filter(sel);
  if (!rs.length) continue;
  const sum = (a) => rs.reduce((s, r) => s + r.chars[a], 0);
  console.log(`| **total, ${label} (${rs.length})** | ${ARMS.map((a) => `**${fmt(sum(a))}** (${pct(sum(a), sum('bare'))})`).join(' | ')} |`);
}
