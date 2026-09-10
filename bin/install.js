#!/usr/bin/env node
// chisle — cross-platform installer.
//
// Detects the AI coding agents on this machine and installs Chisle for each:
//   - Claude Code  → plugin (marketplace add + install), fallback to standalone
//                    hooks + settings.json merge + statusline badge
//   - Gemini CLI   → gemini extensions install
//   - Codex        → fenced ruleset appended to ~/.codex/AGENTS.md
//   - Cursor/Windsurf/Cline/Kiro/Copilot → project rule file dropped into CWD
//
// Usage:
//   npx chisle                 auto-detect + install
//   npx chisle --list          show detected agents, install nothing
//   npx chisle --only claude   install for one agent
//   npx chisle --dry-run       print actions, change nothing
//   npx chisle --uninstall     remove what we installed
//   npx chisle --help
//
// Pure stdlib, zero runtime deps.

'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');
const cp = require('child_process');

const SETTINGS = require('./lib/settings');

const REPO = 'JayPokale/Chisle';
const IS_WIN = process.platform === 'win32';

// Repo root = parent of bin/. Installed package or local clone both work.
const REPO_ROOT = path.resolve(__dirname, '..');

// ── Provider matrix ─────────────────────────────────────────────────────────
// scope: 'global' installs once for the whole machine/user.
//        'project' writes a per-repo rule file into the current directory
//        (that's how Cursor/Cline/Copilot rules actually work).
const PROVIDERS = [
  { id: 'claude',   label: 'Claude Code',   scope: 'global',  detect: 'cmd:claude' },
  { id: 'gemini',   label: 'Gemini CLI',    scope: 'global',  detect: 'cmd:gemini' },
  { id: 'codex',    label: 'Codex CLI',     scope: 'global',  detect: 'cmd:codex||dir:~/.codex' },
  { id: 'cursor',   label: 'Cursor',        scope: 'project', detect: 'cmd:cursor||dir:~/.cursor',
    rule: '.cursor/rules/chisle.mdc' },
  { id: 'windsurf', label: 'Windsurf',      scope: 'project', detect: 'cmd:windsurf||dir:~/.windsurf||dir:~/.codeium/windsurf',
    rule: '.windsurf/rules/chisle.md' },
  { id: 'cline',    label: 'Cline',         scope: 'project', detect: 'vscode-ext:cline',
    rule: '.clinerules/chisle.md' },
  { id: 'kiro',     label: 'Kiro',          scope: 'project', detect: 'cmd:kiro||dir:~/.kiro',
    rule: '.kiro/steering/chisle.md' },
  { id: 'copilot',  label: 'GitHub Copilot',scope: 'project', detect: 'vscode-ext:github.copilot||vscode-ext:github.copilot-chat',
    rule: '.github/copilot-instructions.md' },
];

// ── argv ────────────────────────────────────────────────────────────────────
function parseArgs(argv) {
  const opts = { dryRun: false, force: false, list: false, uninstall: false,
                 noColor: false, help: false, only: [], configDir: null };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    switch (a) {
      case '--dry-run': opts.dryRun = true; break;
      case '--force': opts.force = true; break;
      case '--list': opts.list = true; break;
      case '--uninstall': case '-u': opts.uninstall = true; break;
      case '--no-color': opts.noColor = true; break;
      case '-h': case '--help': opts.help = true; break;
      case '--': break; // npx sometimes forwards the literal end-of-options marker
      case '--only': {
        const v = argv[++i];
        if (!v) die('error: --only requires an agent id');
        opts.only.push(v);
        break;
      }
      case '--config-dir': {
        const v = argv[++i];
        if (!v || v.startsWith('--')) die('error: --config-dir requires a path');
        opts.configDir = expandHome(v);
        break;
      }
      default: die(`error: unknown flag: ${a}\nrun 'npx chisle --help' for usage`);
    }
  }
  if (opts.only.length) {
    const known = new Set(PROVIDERS.map(p => p.id));
    for (const id of opts.only) if (!known.has(id)) die(`error: unknown agent: ${id}\n  see 'npx chisle --list'`);
  }
  return opts;
}

function die(msg) { process.stderr.write(msg + '\n'); process.exit(2); }

// ── color ───────────────────────────────────────────────────────────────────
function makeChalk(noColor) {
  const use = !noColor && process.stdout.isTTY && !process.env.NO_COLOR;
  const wrap = (c) => (s) => use ? `\x1b[${c}m${s}\x1b[0m` : s;
  return { orange: wrap('38;5;172'), dim: wrap('2'), red: wrap('31'), green: wrap('32'), yellow: wrap('33') };
}

// ── detection ───────────────────────────────────────────────────────────────
function expandHome(p) { return p.replace(/^~/, os.homedir()).replace(/^\$HOME/, os.homedir()); }

function hasCmd(cmd) {
  try {
    if (IS_WIN) return cp.spawnSync('where', [cmd], { stdio: 'ignore' }).status === 0;
    return cp.spawnSync('sh', ['-c', `command -v '${cmd.replace(/'/g, "")}'`], { stdio: 'ignore' }).status === 0;
  } catch (_) { return false; }
}

function safeStat(p, method) { try { return fs.statSync(p)[method](); } catch (_) { return false; } }

function vscodeExt(needle) {
  const roots = ['.vscode/extensions', '.vscode-server/extensions', '.cursor/extensions', '.windsurf/extensions']
    .map(r => path.join(os.homedir(), r));
  const re = new RegExp(needle.replace(/\./g, '\\.'), 'i');
  for (const r of roots) {
    if (!fs.existsSync(r)) continue;
    try { if (fs.readdirSync(r).some(e => re.test(e))) return true; } catch (_) {}
  }
  return false;
}

function detectMatch(spec) {
  for (const clause of spec.split('||')) {
    const c = clause.trim();
    const colon = c.indexOf(':');
    const kind = c.slice(0, colon), val = expandHome(c.slice(colon + 1));
    let ok = false;
    if (kind === 'cmd') ok = hasCmd(val);
    else if (kind === 'dir') ok = safeStat(val, 'isDirectory');
    else if (kind === 'file') ok = safeStat(val, 'isFile');
    else if (kind === 'vscode-ext') ok = vscodeExt(val);
    if (ok) return true;
  }
  return false;
}

// ── spawn helpers ───────────────────────────────────────────────────────────
function quoteWin(a) {
  if (!IS_WIN) return a;
  if (a === '' || /[\s"]/.test(a)) return '"' + String(a).replace(/\\(?=\\*"|$)/g, '\\\\').replace(/"/g, '\\"') + '"';
  return a;
}
function spawnX(cmd, args, o) {
  if (IS_WIN) return cp.spawnSync(`${cmd} ${args.map(quoteWin).join(' ')}`, [], Object.assign({ shell: true }, o || {}));
  return cp.spawnSync(cmd, args, o || {});
}
function run(cmd, args, dry) {
  if (dry) { process.stdout.write(`  would run: ${cmd} ${args.join(' ')}\n`); return { status: 0 }; }
  process.stdout.write(`  $ ${cmd} ${args.join(' ')}\n`);
  return spawnX(cmd, args, { stdio: 'inherit' });
}
function capture(cmd, args) {
  try { return spawnX(cmd, args, { encoding: 'utf8' }); } catch (_) { return { status: 1, stdout: '', stderr: '' }; }
}

// ── config dir ──────────────────────────────────────────────────────────────
function claudeDir(opts) {
  if (opts.configDir) return opts.configDir;
  if (process.env.CLAUDE_CONFIG_DIR) return process.env.CLAUDE_CONFIG_DIR;
  return path.join(os.homedir(), '.claude');
}

// ── Claude Code ─────────────────────────────────────────────────────────────
function installClaude(ctx) {
  const { say, note, warn, opts, results } = ctx;
  results.detected++;
  say('→ Claude Code detected');

  let pluginOK = false;
  if (hasCmd('claude')) {
    let already = false;
    if (!opts.force) {
      const r = capture('claude', ['plugin', 'list']);
      if (r.status === 0 && /chisle/i.test(r.stdout || '')) already = true;
    }
    if (already) {
      note('  chisle plugin already installed (use --force to reinstall)');
      results.skipped.push(['claude', 'plugin already installed']);
      pluginOK = true;
    } else {
      const r1 = run('claude', ['plugin', 'marketplace', 'add', REPO], opts.dryRun);
      const r2 = run('claude', ['plugin', 'install', 'chisle@chisle'], opts.dryRun);
      if ((r1.status || 0) === 0 && (r2.status || 0) === 0) { results.installed.push('claude'); pluginOK = true; }
      else warn('  claude plugin install failed — falling back to standalone hooks');
    }
  } else {
    note('  claude CLI not on PATH — wiring standalone hooks in settings.json');
  }

  if (!pluginOK) {
    const r = installClaudeHooks(ctx);
    if (r === 'ok') results.installed.push('claude-hooks');
    else if (r === 'skip') results.skipped.push(['claude-hooks', 'already wired']);
    else results.failed.push(['claude-hooks', r]);
  } else {
    note('  hooks: plugin manifest handles SessionStart + UserPromptSubmit + PostToolUse');
    // Plugin path won — drop any standalone wiring left by an earlier run, or
    // both copies of every hook run on each event and the PostToolUse pair
    // dedups first-seen output against itself.
    const settingsPath = path.join(claudeDir(opts), 'settings.json');
    const settings = SETTINGS.readSettings(settingsPath);
    if (settings && SETTINGS.removeHooks(settings, 'chisle-') > 0) {
      if (!opts.dryRun) {
        SETTINGS.validateHookFields(settings);
        SETTINGS.writeSettings(settingsPath, settings);
      }
      note('  removed superseded standalone hook entries from settings.json');
    }
  }
  process.stdout.write('\n');
}

// Standalone wiring — copy hooks into <configDir>/chisle-hooks/ and merge
// settings.json. Used when the plugin path is unavailable.
function installClaudeHooks(ctx) {
  const { opts, warn, note } = ctx;
  const cfg = claudeDir(opts);
  const hooksSrc = path.join(REPO_ROOT, 'hooks');
  const hooksDst = path.join(cfg, 'chisle-hooks');
  const settingsPath = path.join(cfg, 'settings.json');
  const HOOK_FILES = ['package.json', 'chisle-config.js', 'chisle-activate.js',
                      'chisle-mode-tracker.js', 'chisle-compress-output.js',
                      'chisle-statusline.sh', 'chisle-statusline.ps1'];

  if (opts.dryRun) {
    note(`  would copy ${HOOK_FILES.length} hook files → ${hooksDst}`);
    note(`  would merge SessionStart + UserPromptSubmit + PostToolUse + statusline → ${settingsPath}`);
    return 'ok';
  }

  fs.mkdirSync(hooksDst, { recursive: true });
  for (const f of HOOK_FILES) {
    const s = path.join(hooksSrc, f);
    if (fs.existsSync(s)) fs.copyFileSync(s, path.join(hooksDst, f));
  }
  try { fs.chmodSync(path.join(hooksDst, 'chisle-statusline.sh'), 0o755); } catch (_) {}

  const settings = SETTINGS.readSettings(settingsPath);
  if (settings === null) { warn('  settings.json unparseable; not touching it.'); return 'settings.json unparseable'; }

  const bak = settingsPath + '.bak';
  if (fs.existsSync(settingsPath) && !fs.existsSync(bak)) { try { fs.copyFileSync(settingsPath, bak); } catch (_) {} }

  const node = process.execPath;
  const activate = path.join(hooksDst, 'chisle-activate.js');
  const tracker = path.join(hooksDst, 'chisle-mode-tracker.js');
  const compress = path.join(hooksDst, 'chisle-compress-output.js');

  SETTINGS.addCommandHook(settings, 'SessionStart',
    { command: `"${node}" "${activate}"`, marker: 'chisle-activate', timeout: 5, statusMessage: 'Loading chisle mode...' });
  SETTINGS.addCommandHook(settings, 'UserPromptSubmit',
    { command: `"${node}" "${tracker}"`, marker: 'chisle-mode-tracker', timeout: 5, statusMessage: 'Tracking chisle mode...' });
  SETTINGS.addCommandHook(settings, 'PostToolUse',
    { command: `"${node}" "${compress}"`, marker: 'chisle-compress-output', timeout: 10,
      matcher: 'Bash|Agent|WebFetch|WebSearch|Grep|Glob|mcp__.*', statusMessage: 'Compressing tool output...' });

  const psHost = IS_WIN && hasCmd('pwsh') ? 'pwsh' : (IS_WIN ? 'powershell' : null);
  const slCmd = IS_WIN
    ? `${psHost} -NoProfile -ExecutionPolicy Bypass -File "${path.join(hooksDst, 'chisle-statusline.ps1')}"`
    : `bash "${path.join(hooksDst, 'chisle-statusline.sh')}"`;
  if (!settings.statusLine) {
    settings.statusLine = { type: 'command', command: slCmd };
    process.stdout.write('  statusline badge configured.\n');
  } else {
    const existing = typeof settings.statusLine === 'string' ? settings.statusLine : (settings.statusLine.command || '');
    if (existing.includes('chisle-statusline')) process.stdout.write('  statusline badge already configured.\n');
    else process.stdout.write('  NOTE: existing statusline detected — CHISLE badge NOT added (see docs/install-windows.md).\n');
  }

  SETTINGS.validateHookFields(settings);
  SETTINGS.writeSettings(settingsPath, settings);
  process.stdout.write(`  hooks wired in ${settingsPath}\n`);
  return 'ok';
}

// ── Gemini ──────────────────────────────────────────────────────────────────
function installGemini(ctx) {
  const { say, note, opts, results } = ctx;
  results.detected++;
  say('→ Gemini CLI detected');
  if (!opts.force) {
    const r = capture('gemini', ['extensions', 'list']);
    if (r.status === 0 && /chisle/i.test(r.stdout || '')) {
      note('  chisle extension already installed (use --force)');
      results.skipped.push(['gemini', 'already installed']); process.stdout.write('\n'); return;
    }
  }
  const r = run('gemini', ['extensions', 'install', `https://github.com/${REPO}`], opts.dryRun);
  if ((r.status || 0) === 0) results.installed.push('gemini');
  else results.failed.push(['gemini', 'gemini extensions install failed']);
  process.stdout.write('\n');
}

// ── Codex (fenced ruleset in ~/.codex/AGENTS.md) ────────────────────────────
const FENCE_BEGIN = '<!-- chisle-begin -->';
const FENCE_END = '<!-- chisle-end -->';

function installCodex(ctx) {
  const { say, note, opts, results } = ctx;
  results.detected++;
  say('→ Codex detected');
  const target = path.join(os.homedir(), '.codex', 'AGENTS.md');
  const body = fs.readFileSync(path.join(REPO_ROOT, 'AGENTS.md'), 'utf8').trimEnd() + '\n';
  const block = `${FENCE_BEGIN}\n${body}${FENCE_END}\n`;

  if (opts.dryRun) { note(`  would write chisle ruleset → ${target}`); results.installed.push('codex'); process.stdout.write('\n'); return; }

  try {
    fs.mkdirSync(path.dirname(target), { recursive: true });
    let existing = '';
    try { existing = fs.readFileSync(target, 'utf8'); } catch (_) {}
    if (existing.includes(FENCE_BEGIN)) {
      if (opts.force) {
        const rewritten = existing.replace(new RegExp(`${FENCE_BEGIN}[\\s\\S]*?${FENCE_END}\\n?`), block);
        fs.writeFileSync(target, rewritten, { mode: 0o644 });
        process.stdout.write(`  refreshed ruleset in ${target}\n`);
      } else { note(`  ${target} already contains chisle ruleset (--force to refresh)`); }
      results.skipped.push(['codex', 'already present']);
    } else {
      const sep = existing && !existing.endsWith('\n\n') ? (existing.endsWith('\n') ? '\n' : '\n\n') : '';
      fs.writeFileSync(target, existing + sep + block, { mode: 0o644 });
      process.stdout.write(`  installed: ${target}\n`);
      results.installed.push('codex');
    }
  } catch (e) { results.failed.push(['codex', (e && e.message) || 'write failed']); }
  process.stdout.write('\n');
}

// ── Project-scoped rule agents (Cursor/Windsurf/Cline/Kiro/Copilot) ─────────
function installProjectRule(ctx, prov) {
  const { say, note, warn, opts, results } = ctx;
  results.detected++;
  say(`→ ${prov.label} detected`);
  const src = path.join(REPO_ROOT, prov.rule);
  const dst = path.join(process.cwd(), prov.rule);

  if (!fs.existsSync(src)) { warn(`  missing source rule ${prov.rule} (run scripts/build-rules.js)`); results.failed.push([prov.id, 'source rule missing']); process.stdout.write('\n'); return; }

  if (opts.dryRun) { note(`  would write ${dst} (project-scoped)`); results.installed.push(prov.id); process.stdout.write('\n'); return; }

  if (fs.existsSync(dst) && !opts.force) {
    note(`  ${prov.rule} already in this project (--force to overwrite)`);
    results.skipped.push([prov.id, 'already in project']); process.stdout.write('\n'); return;
  }
  try {
    fs.mkdirSync(path.dirname(dst), { recursive: true });
    fs.copyFileSync(src, dst);
    process.stdout.write(`  installed: ${dst}  (project-scoped)\n`);
    results.installed.push(prov.id);
  } catch (e) { results.failed.push([prov.id, (e && e.message) || 'copy failed']); }
  process.stdout.write('\n');
}

// ── uninstall ───────────────────────────────────────────────────────────────
function uninstall(ctx) {
  const { say, note, opts, c } = ctx;
  say(c.orange('Chisle uninstall'));
  let touched = 0;

  // Claude plugin
  if (hasCmd('claude') && !opts.dryRun) {
    const r = capture('claude', ['plugin', 'list']);
    if (r.status === 0 && /chisle/i.test(r.stdout || '')) {
      run('claude', ['plugin', 'uninstall', 'chisle@chisle'], opts.dryRun); touched++;
    }
  }

  // Claude standalone hooks + statusline
  const cfg = claudeDir(opts);
  const settingsPath = path.join(cfg, 'settings.json');
  const settings = SETTINGS.readSettings(settingsPath);
  if (settings) {
    const removed = SETTINGS.removeHooks(settings, 'chisle-');
    let slRemoved = false;
    if (settings.statusLine && typeof settings.statusLine.command === 'string'
        && settings.statusLine.command.includes('chisle-statusline')) { delete settings.statusLine; slRemoved = true; }
    if (removed > 0 || slRemoved) {
      if (!opts.dryRun) { SETTINGS.validateHookFields(settings); SETTINGS.writeSettings(settingsPath, settings); }
      note(`  removed ${removed} hook entr${removed === 1 ? 'y' : 'ies'}${slRemoved ? ' + statusline' : ''} from settings.json`);
      touched++;
    }
  }
  const hooksDst = path.join(cfg, 'chisle-hooks');
  if (fs.existsSync(hooksDst)) { if (!opts.dryRun) fs.rmSync(hooksDst, { recursive: true, force: true }); note(`  removed ${hooksDst}`); touched++; }

  // Flag files
  for (const f of ['.chisle-active', '.chisle-session-turns', '.chisle-statusline-suffix',
                   '.chisle-compress-stats.json', '.chisle-compress-last.json', '.chisle-update-check.json']) {
    const p = path.join(cfg, f);
    if (fs.existsSync(p)) { if (!opts.dryRun) { try { fs.unlinkSync(p); } catch (_) {} } note(`  removed ${p}`); touched++; }
  }

  // Codex fenced block
  const codexMd = path.join(os.homedir(), '.codex', 'AGENTS.md');
  if (fs.existsSync(codexMd)) {
    const txt = fs.readFileSync(codexMd, 'utf8');
    if (txt.includes(FENCE_BEGIN)) {
      const stripped = txt.replace(new RegExp(`\\n?${FENCE_BEGIN}[\\s\\S]*?${FENCE_END}\\n?`), '\n').replace(/\n{3,}/g, '\n\n');
      if (!opts.dryRun) fs.writeFileSync(codexMd, stripped, { mode: 0o644 });
      note(`  removed chisle block from ${codexMd}`); touched++;
    }
  }

  note('');
  note('Project-scoped rule files (.cursor/, .windsurf/, .clinerules/, .kiro/, .github/copilot-instructions.md)');
  note('live in your project repos — remove them per-project with git if you added them there.');
  say(touched ? c.green(`\nUninstalled. ${touched} item(s) cleaned.`) : c.yellow('\nNothing to uninstall.'));
}

// ── help / banner ───────────────────────────────────────────────────────────
function printHelp(c) {
  process.stdout.write(`${c.orange('chisle')} — maximum-efficiency dev mode installer

Usage:
  npx chisle [flags]

Flags:
  --list           Detect agents and print them; install nothing
  --only <id>      Install only for one agent (repeatable)
  --dry-run        Print actions, change nothing
  --force          Reinstall / overwrite even if already present
  --uninstall, -u  Remove what chisle installed
  --config-dir <p> Override Claude config dir (default: $CLAUDE_CONFIG_DIR or ~/.claude)
  --no-color       Disable ANSI color
  --help, -h       This help

Agents: ${PROVIDERS.map(p => p.id).join(', ')}

Examples:
  npx chisle                  # auto-detect + install
  npx chisle --only claude    # just Claude Code
  npx chisle --dry-run        # preview
`);
}

function printList(c) {
  process.stdout.write(c.orange('chisle') + ' — detected agents:\n\n');
  for (const p of PROVIDERS) {
    const found = detectMatch(p.detect);
    const mark = found ? c.green('✓') : c.dim('·');
    const scope = p.scope === 'project' ? c.dim(' (project-scoped)') : '';
    process.stdout.write(`  ${mark} ${p.label}${scope}\n`);
  }
  process.stdout.write('\nRun ' + c.orange('npx chisle') + ' to install for the detected (✓) agents.\n');
}

// ── main ────────────────────────────────────────────────────────────────────
function main() {
  const opts = parseArgs(process.argv.slice(2));
  const c = makeChalk(opts.noColor);

  if (opts.help) return printHelp(c);
  if (opts.list) return printList(c);

  const results = { detected: 0, installed: [], skipped: [], failed: [] };
  const say = (s) => process.stdout.write(s + '\n');
  const note = (s) => process.stdout.write(c.dim(s) + '\n');
  const warn = (s) => process.stdout.write(c.yellow(s) + '\n');
  const ctx = { say, note, warn, opts, results, c };

  if (opts.uninstall) return uninstall(ctx);

  say(c.orange('╭─ Chisle installer ─╮'));
  say(c.dim(opts.dryRun ? '  (dry run — nothing will change)' : '  maximum signal, minimum noise'));
  say('');

  const targets = PROVIDERS.filter(p => opts.only.length ? opts.only.includes(p.id) : detectMatch(p.detect));
  if (targets.length === 0) {
    warn('No supported agents detected.');
    note('Run `npx chisle --list` to see what we look for, or `--only <id>` to force one.');
    return;
  }

  for (const p of targets) {
    if (p.id === 'claude') installClaude(ctx);
    else if (p.id === 'gemini') installGemini(ctx);
    else if (p.id === 'codex') installCodex(ctx);
    else installProjectRule(ctx, p);
  }

  // Summary
  say(c.orange('── summary ──'));
  say(`  detected:  ${results.detected}`);
  if (results.installed.length) say(c.green(`  installed: ${results.installed.join(', ')}`));
  if (results.skipped.length)   say(c.dim(`  skipped:   ${results.skipped.map(s => s[0]).join(', ')}`));
  if (results.failed.length)    say(c.red(`  failed:    ${results.failed.map(s => s[0] + ' (' + s[1] + ')').join(', ')}`));
  say('');
  if (!opts.dryRun && results.installed.length) {
    say(c.orange('Done.') + ' Restart your agent. Type ' + c.orange('/chisle') + ' (Claude Code) or just start coding.');
    note('If Chisle earns its keep, a star helps others find it: https://github.com/JayPokale/Chisle');
  }
  process.exit(results.failed.length ? 1 : 0);
}

main();
