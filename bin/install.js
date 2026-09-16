#!/usr/bin/env node
// chisle: cross-platform installer.
//
// Detects the AI coding agents on this machine and installs Chisle for each:
//   - Claude Code  → plugin (marketplace add + install), fallback to standalone
//                    hooks + settings.json merge + statusline badge
//   - Pi           → Pi package (extension + skill)
//   - Gemini CLI   → gemini extensions install
//   - Codex        → fenced ruleset appended to ~/.codex/AGENTS.md
//   - OpenCode     → fenced ruleset in ~/.config/opencode/AGENTS.md + skills copy
//   - Hermes       → skills copy in ~/.hermes/skills (Agent Skills standard)
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
  { id: 'pi',       label: 'Pi',            scope: 'global',  detect: 'cmd:pi' },
  { id: 'gemini',   label: 'Gemini CLI',    scope: 'global',  detect: 'cmd:gemini' },
  { id: 'codex',    label: 'Codex CLI',     scope: 'global',  detect: 'cmd:codex||dir:~/.codex' },
  { id: 'opencode', label: 'OpenCode',        scope: 'global',  detect: 'cmd:opencode||dir:~/.config/opencode' },
  { id: 'hermes',   label: 'Hermes Agent',    scope: 'global',  detect: 'cmd:hermes||dir:~/.hermes' },
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
                 noColor: false, help: false, stats: false, update: false, only: [], configDir: null };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    switch (a) {
      case '--dry-run': opts.dryRun = true; break;
      case '--force': opts.force = true; break;
      case '--list': opts.list = true; break;
      case '--stats': opts.stats = true; break;
      // --update is --force narrowed to what is already there: refresh every
      // agent that has Chisle, add it to none that don't.
      case '--update': opts.update = true; opts.force = true; break;
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

// spawnSync reports a missing binary as { status: null, error: ENOENT } and a
// signal death as { status: null, signal }. `(r.status || 0) === 0` reads both
// as success, so a machine without the CLI was told the install succeeded.
// Only an explicit exit code of 0 counts.
function ranOk(r) {
  return !!r && !r.error && r.status === 0;
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

// Home dir for Chisle-managed global targets. CHISLE_HOME overrides it
// (tests, containers); mirrors the CLAUDE_CONFIG_DIR precedent for Claude.
function homeDir() { return process.env.CHISLE_HOME || os.homedir(); }

// ── what is already installed ───────────────────────────────────────────────
// Every install path skips when Chisle is already present, which is right for
// `npx chisle` and useless for an upgrade: the run reports success and changes
// nothing. --update pairs this check with --force so a refresh touches exactly
// the agents that already have it.
function installedFor(id, opts) {
  try {
    switch (id) {
      case 'claude': {
        if (hasCmd('claude')) {
          const r = capture('claude', ['plugin', 'list']);
          if (r.status === 0 && /chisle/i.test(r.stdout || '')) return true;
        }
        const settings = SETTINGS.readSettings(path.join(claudeDir(opts), 'settings.json'));
        const hooks = (settings && settings.hooks) || {};
        for (const event of Object.keys(hooks)) {
          for (const entry of hooks[event] || []) {
            for (const h of (entry && entry.hooks) || []) {
              if (typeof h.command === 'string' && h.command.includes('chisle-')) return true;
            }
          }
        }
        return false;
      }
      case 'pi':
        return hasCmd('pi') && piSources(capture('pi', ['list']).stdout).length > 0;
      case 'gemini': {
        if (!hasCmd('gemini')) return false;
        const r = capture('gemini', ['extensions', 'list']);
        return r.status === 0 && /chisle/i.test(r.stdout || '');
      }
      case 'codex': {
        const md = path.join(homeDir(), '.codex', 'AGENTS.md');
        return fs.existsSync(md) && fs.readFileSync(md, 'utf8').includes(FENCE_BEGIN);
      }
      case 'opencode': {
        try {
          const md = path.join(homeDir(), '.config', 'opencode', 'AGENTS.md');
          if (fs.existsSync(md) && fs.readFileSync(md, 'utf8').includes(FENCE_BEGIN)) return true;
        } catch (_) {}
        return fs.existsSync(path.join(homeDir(), '.config', 'opencode', 'skills', 'chisle', 'SKILL.md'));
      }
      case 'hermes':
        return fs.existsSync(path.join(homeDir(), '.hermes', 'skills', 'chisle', 'SKILL.md'));
      default: {
        const prov = PROVIDERS.find(x => x.id === id);
        return !!(prov && prov.rule && fs.existsSync(path.join(process.cwd(), prov.rule)));
      }
    }
  } catch (e) { return false; }
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
      if (ranOk(r1) && ranOk(r2)) { results.installed.push('claude'); pluginOK = true; }
      else warn('  claude plugin install failed, falling back to standalone hooks');
    }
  } else {
    note('  claude CLI not on PATH, wiring standalone hooks in settings.json');
  }

  if (!pluginOK) {
    const r = installClaudeHooks(ctx);
    if (r === 'ok') results.installed.push('claude-hooks');
    else if (r === 'skip') results.skipped.push(['claude-hooks', 'already wired']);
    else results.failed.push(['claude-hooks', r]);
  } else {
    note('  hooks: plugin manifest handles SessionStart + UserPromptSubmit + PostToolUse');
    // Plugin path won, so drop any standalone wiring left by an earlier run, or
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

// Standalone wiring: copy hooks into <configDir>/chisle-hooks/ and merge
// settings.json. Used when the plugin path is unavailable.
function installClaudeHooks(ctx) {
  const { opts, warn, note } = ctx;
  const cfg = claudeDir(opts);
  const hooksSrc = path.join(REPO_ROOT, 'hooks');
  const hooksDst = path.join(cfg, 'chisle-hooks');
  const settingsPath = path.join(cfg, 'settings.json');
  const HOOK_FILES = ['package.json', 'chisle-config.js', 'chisle-activate.js',
                      'chisle-mode.js', 'chisle-mode-tracker.js', 'chisle-compress-output.js',
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
    else process.stdout.write('  NOTE: existing statusline detected, CHISLE badge NOT added (see docs/install-windows.md).\n');
  }

  SETTINGS.validateHookFields(settings);
  SETTINGS.writeSettings(settingsPath, settings);
  process.stdout.write(`  hooks wired in ${settingsPath}\n`);
  return 'ok';
}

// ── Pi ──────────────────────────────────────────────────────────────────────
function piSources(output) {
  return String(output || '').split('\n').map(line => line.trim())
    .filter(line => /^npm:chisle(?:@|$)/i.test(line) || /^git:.*github\.com\/JayPokale\/Chisle(?:@|$)/i.test(line))
    .map(source => source.replace(/@[^/@]+$/, ''));
}

function installPi(ctx) {
  const { say, note, opts, results } = ctx;
  results.detected++;
  say('→ Pi detected');
  if (!opts.force) {
    const installed = piSources(capture('pi', ['list']).stdout);
    if (installed.length) {
      note('  chisle package already installed (use --force)');
      results.skipped.push(['pi', 'already installed']); process.stdout.write('\n'); return;
    }
  }
  const r = run('pi', ['install', 'npm:chisle'], opts.dryRun);
  if (ranOk(r)) results.installed.push('pi');
  else results.failed.push(['pi', 'pi package install failed']);
  process.stdout.write('\n');
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
  if (ranOk(r)) results.installed.push('gemini');
  else results.failed.push(['gemini', 'gemini extensions install failed']);
  process.stdout.write('\n');
}

// Skills-root helpers for Agent-Skills hosts (OpenCode, Hermes). Both load
// one dir per skill through the host's native `skill` tool, so the bundled
// skills/ tree copies over verbatim: no conversion, no second system
// message, existing user instructions untouched.
function ownedSkillNames() {
  var srcRoot = path.join(REPO_ROOT, 'skills');
  try {
    return fs.readdirSync(srcRoot).filter(function (n) {
      try {
        return fs.statSync(path.join(srcRoot, n)).isDirectory()
          && fs.existsSync(path.join(srcRoot, n, 'SKILL.md'));
      } catch (_) { return false; }
    });
  } catch (_) { return []; }
}

// Overwrites stale files, keeps foreign siblings, never touches files
// outside the named skill dirs. Returns files written.
function copySkills(dstRoot, opts) {
  var names = ownedSkillNames();
  var written = 0;
  for (var i = 0; i < names.length; i++) {
    var src = path.join(REPO_ROOT, 'skills', names[i]);
    var dst = path.join(dstRoot, names[i]);
    var files = fs.readdirSync(src);
    if (!opts.dryRun) fs.mkdirSync(dst, { recursive: true });
    for (var j = 0; j < files.length; j++) {
      var st = null;
      try { st = fs.statSync(path.join(src, files[j])); } catch (_) { continue; }
      if (!st.isFile()) continue;
      if (opts.dryRun) { written++; continue; }
      fs.copyFileSync(path.join(src, files[j]), path.join(dst, files[j]));
      written++;
    }
  }
  return written;
}

// Removes only the skill dirs Chisle owns; foreign skills stay put.
function pruneSkills(dstRoot) {
  var removed = 0;
  var names = ownedSkillNames();
  for (var i = 0; i < names.length; i++) {
    var dst = path.join(dstRoot, names[i]);
    if (fs.existsSync(dst)) {
      fs.rmSync(dst, { recursive: true, force: true });
      removed++;
    }
  }
  return removed;
}

// Fenced AGENTS.md append/refresh for Codex-style targets. Appends after
// existing content (never prepends, never clobbers), refreshes one fenced
// block in place under --force. Returns 'installed', 'refreshed', 'skipped'.
function writeFencedRuleset(target, opts, note) {
  var raw = fs.readFileSync(path.join(REPO_ROOT, 'AGENTS.md'), 'utf8');
  var block = FENCE_BEGIN + '\n' + raw.trimEnd() + '\n' + FENCE_END + '\n';
  fs.mkdirSync(path.dirname(target), { recursive: true });
  var existing = '';
  try { existing = fs.readFileSync(target, 'utf8'); } catch (_) {}
  if (existing.indexOf(FENCE_BEGIN) !== -1) {
    if (!opts.force) {
      note('  ' + target + ' already contains chisle ruleset (--force to refresh)');
      return 'skipped';
    }
    var b = existing.indexOf(FENCE_BEGIN);
    var e = existing.indexOf(FENCE_END, b);
    // A begin marker with no end marker means the file was hand-edited or a
    // write was cut short. Everything after the begin marker is then user
    // content of unknown extent, so refuse rather than guess: rewriting would
    // delete the rest of their global instructions.
    if (e === -1) {
      note('  ' + target + ' has a chisle-begin marker with no chisle-end; leaving it alone');
      note('  remove the stray marker by hand, then re-run');
      return 'skipped';
    }
    var tail = existing.slice(e + FENCE_END.length);
    if (tail.charAt(0) === '\n') tail = tail.slice(1);
    fs.writeFileSync(target, existing.slice(0, b) + block + tail, { mode: 0o644 });
    process.stdout.write('  refreshed ruleset in ' + target + '\n');
    return 'refreshed';
  }
  var sep = '';
  if (existing) {
    if (existing.slice(-2) === '\n\n') sep = '';
    else if (existing.slice(-1) === '\n') sep = '\n';
    else sep = '\n\n';
  }
  fs.writeFileSync(target, existing + sep + block, { mode: 0o644 });
  process.stdout.write('  installed: ' + target + '\n');
  return 'installed';
}

// ── Codex (fenced ruleset in ~/.codex/AGENTS.md) ────────────────────────────
const FENCE_BEGIN = '<!-- chisle-begin -->';
const FENCE_END = '<!-- chisle-end -->';

function installCodex(ctx) {
  const { say, note, opts, results } = ctx;
  results.detected++;
  say('\u2192 Codex detected');
  const target = path.join(homeDir(), '.codex', 'AGENTS.md');

  if (opts.dryRun) { note('  would write chisle ruleset to ' + target); results.installed.push('codex'); process.stdout.write('\n'); return; }

  try {
    const st = writeFencedRuleset(target, opts, note);
    if (st === 'installed') results.installed.push('codex');
    else results.skipped.push(['codex', 'already present']);
  } catch (e) { results.failed.push(['codex', (e && e.message) || 'write failed']); }
  process.stdout.write('\n');
}

// ── OpenCode ─────────────────────────────────────────────────────────────
// Global ruleset (~/.config/opencode/AGENTS.md) carries the always-on output
// axis next to existing user instructions; the bundled skills copy into
// ~/.config/opencode/skills for on-demand loading via the native skill tool
// (the global skills dir is scanned by default, so skills.paths needs no
// edit and no second system message is added).
// Copies the OpenCode compression plugin and the shared compressor core it
// requires into ~/.config/opencode/plugins/. OpenCode auto-discovers any *.js
// or *.ts file in that dir at startup (not *.mjs), and its config dir is
// type:module, so the ESM source ships as chisle.js. Returns the number of
// files written. Never called on a dry run (installOpencode returns early),
// so no dry-run branch.
//
// chisle-hooks/package.json pins the core as CommonJS. Without it the config
// dir's own "type": "module" propagates down to these .js files, and the core
// dies on its first `require` with a ReferenceError that takes the whole
// plugin with it (loadFrom only swallows MODULE_NOT_FOUND). Bun is lenient
// enough not to care; Node is not, so pin it rather than rely on the runtime.
function copyOpencodePlugin() {
  const pluginDir = path.join(homeDir(), '.config', 'opencode', 'plugins');
  const hooksDir = path.join(pluginDir, 'chisle-hooks');
  const files = [
    ['.opencode/plugins/chisle.mjs', path.join(pluginDir, 'chisle.js')],
    ['hooks/chisle-compress-output.js', path.join(hooksDir, 'chisle-compress-output.js')],
    ['hooks/chisle-config.js', path.join(hooksDir, 'chisle-config.js')],
  ];
  fs.mkdirSync(hooksDir, { recursive: true });
  var n = 0;
  for (var i = 0; i < files.length; i++) {
    fs.copyFileSync(path.join(REPO_ROOT, files[i][0]), files[i][1]);
    n++;
  }
  fs.writeFileSync(path.join(hooksDir, 'package.json'), '{ "type": "commonjs" }\n');
  n++;
  return n;
}

function installOpencode(ctx) {
  const { say, note, opts, results } = ctx;
  results.detected++;
  say('\u2192 OpenCode detected');
  const target = path.join(homeDir(), '.config', 'opencode', 'AGENTS.md');
  const skillsDst = path.join(homeDir(), '.config', 'opencode', 'skills');
  const pluginDst = path.join(homeDir(), '.config', 'opencode', 'plugins');

  if (opts.dryRun) {
    note('  would write chisle ruleset to ' + target);
    note('  would copy skills to ' + skillsDst);
    note('  would copy compression plugin to ' + pluginDst);
    results.installed.push('opencode');
    process.stdout.write('\n');
    return;
  }

  try {
    const st = writeFencedRuleset(target, opts, note);
    const n = copySkills(skillsDst, opts);
    process.stdout.write('  installed: ' + n + ' skill file(s) to ' + skillsDst + '\n');
    const p = copyOpencodePlugin();
    process.stdout.write('  installed: ' + p + ' plugin file(s) to ' + pluginDst + '\n');
    if (st === 'installed') results.installed.push('opencode');
    else results.skipped.push(['opencode', 'ruleset already present; skills + plugin refreshed']);
  } catch (e) { results.failed.push(['opencode', (e && e.message) || 'write failed']); }
  process.stdout.write('\n');
}

// ── Hermes ──────────────────────────────────────────────────────────
// Agent-Skills host: bundled skills land verbatim in ~/.hermes/skills, where
// Hermes discovers them as /chisle slash commands. No ruleset is injected:
// Hermes already reads project AGENTS.md, which carries the always-on axis
// when the repo ships it. Portable: honors CHISLE_HOME, no hardcoded paths.
function installHermes(ctx) {
  const { say, opts, results } = ctx;
  results.detected++;
  say('\u2192 Hermes Agent detected');
  const skillsDst = path.join(homeDir(), '.hermes', 'skills');

  if (opts.dryRun) {
    process.stdout.write('  would copy skills to ' + skillsDst + '\n');
    results.installed.push('hermes');
    process.stdout.write('\n');
    return;
  }

  try {
    const n = copySkills(skillsDst, opts);
    process.stdout.write('  installed: ' + n + ' skill file(s) to ' + skillsDst + '\n');
    results.installed.push('hermes');
  } catch (e) { results.failed.push(['hermes', (e && e.message) || 'copy failed']); }
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

  const wants = id => !opts.only.length || opts.only.includes(id);

  if (wants('claude')) {
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
    for (const d of ['chisle-hooks', 'chisle-spill']) {
      const dst = path.join(cfg, d);
      if (fs.existsSync(dst)) { if (!opts.dryRun) fs.rmSync(dst, { recursive: true, force: true }); note(`  removed ${dst}`); touched++; }
    }

    for (const f of ['.chisle-active', '.chisle-session-turns', '.chisle-statusline-suffix',
                     '.chisle-compress-stats.json', '.chisle-compress-last.json', '.chisle-update-check.json']) {
      const p = path.join(cfg, f);
      if (fs.existsSync(p)) { if (!opts.dryRun) { try { fs.unlinkSync(p); } catch (_) {} } note(`  removed ${p}`); touched++; }
    }
  }

  if (wants('pi') && hasCmd('pi')) {
    const sources = piSources(capture('pi', ['list']).stdout);
    for (const source of sources) {
      if (ranOk(run('pi', ['remove', source], opts.dryRun))) touched++;
    }
  }

  if (wants('codex')) {
    const codexMd = path.join(homeDir(), '.codex', 'AGENTS.md');
    if (fs.existsSync(codexMd)) {
      const txt = fs.readFileSync(codexMd, 'utf8');
      if (txt.includes(FENCE_BEGIN)) {
        const stripped = txt.replace(new RegExp(`\\n?${FENCE_BEGIN}[\\s\\S]*?${FENCE_END}\\n?`), '\n').replace(/\n{3,}/g, '\n\n');
        if (!opts.dryRun) fs.writeFileSync(codexMd, stripped, { mode: 0o644 });
        note(`  removed chisle block from ${codexMd}`); touched++;
      }
    }
  }

  if (wants('opencode')) {
    const ocMd = path.join(homeDir(), '.config', 'opencode', 'AGENTS.md');
    if (fs.existsSync(ocMd)) {
      const txt = fs.readFileSync(ocMd, 'utf8');
      const b = txt.indexOf(FENCE_BEGIN);
      const e = b === -1 ? -1 : txt.indexOf(FENCE_END, b);
      if (b !== -1 && e === -1) {
        note('  ' + ocMd + ' has a chisle-begin marker with no chisle-end; leaving it alone');
      } else if (b !== -1) {
        const tail = txt.slice(e + FENCE_END.length).replace(/^\n/, '');
        const stripped = (txt.slice(0, b) + tail).replace(/\n{3,}/g, '\n\n');
        if (!opts.dryRun) fs.writeFileSync(ocMd, stripped, { mode: 0o644 });
        note('  removed chisle block from ' + ocMd); touched++;
      }
    }
    const ocSkills = path.join(homeDir(), '.config', 'opencode', 'skills');
    const ocGone = opts.dryRun ? ownedSkillNames().filter(function (nm) { return fs.existsSync(path.join(ocSkills, nm)); }).length : pruneSkills(ocSkills);
    if (ocGone > 0) { note('  removed ' + ocGone + ' chisle skill dir(s) from ' + ocSkills); touched++; }

    const ocPlugins = path.join(homeDir(), '.config', 'opencode', 'plugins');
    for (const rel of ['chisle.js', 'chisle-hooks']) {
      const dst = path.join(ocPlugins, rel);
      if (fs.existsSync(dst)) { if (!opts.dryRun) fs.rmSync(dst, { recursive: true, force: true }); note('  removed ' + dst); touched++; }
    }
    for (const f of ['chisle-spill', '.chisle-compress-stats.json', '.chisle-compress-last.json']) {
      const p = path.join(homeDir(), '.config', 'opencode', f);
      if (fs.existsSync(p)) { if (!opts.dryRun) fs.rmSync(p, { recursive: true, force: true }); note('  removed ' + p); touched++; }
    }
  }

  if (wants('hermes')) {
    const hSkills = path.join(homeDir(), '.hermes', 'skills');
    const hGone = opts.dryRun ? ownedSkillNames().filter(function (nm) { return fs.existsSync(path.join(hSkills, nm)); }).length : pruneSkills(hSkills);
    if (hGone > 0) { note('  removed ' + hGone + ' chisle skill dir(s) from ' + hSkills); touched++; }
  }

  if (!opts.only.length || opts.only.some(id => PROVIDERS.find(p => p.id === id).scope === 'project')) {
    note('');
    note('Project-scoped rule files (.cursor/, .windsurf/, .clinerules/, .kiro/, .github/copilot-instructions.md)');
    note('live in your project repos, so remove them per-project with git if you added them there.');
  }
  say(touched ? c.green(`\nUninstalled. ${touched} item(s) cleaned.`) : c.yellow('\nNothing to uninstall.'));
}

// ── help / banner ───────────────────────────────────────────────────────────
function printHelp(c) {
  process.stdout.write(`${c.orange('chisle')}: maximum-efficiency dev mode installer

Usage:
  npx chisle [flags]

Flags:
  --list           Detect agents and print them; install nothing
  --stats          Print tool-output savings recorded so far; change nothing
  --update         Refresh every agent that already has Chisle; install none
  --only <id>      Limit install/uninstall to one agent (repeatable)
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
  npx chisle --stats          # what the compressor has saved
  npx chisle@latest --update  # upgrade what is already installed
`);
}

// ── stats ───────────────────────────────────────────────────────────────────
// Reads the compressor's ledger. Input axis only, and deliberately so: chars
// elided have a real baseline (we know exactly what was cut), while the output
// axis has none, since there is no way to know what the model would have written
// without the ruleset, which is what the benchmark arms are for. A counter that
// blended the two would be inventing the interesting half.
function printStats(c, opts) {
  const dir = claudeDir(opts);
  const p = path.join(dir, '.chisle-compress-stats.json');
  process.stdout.write(c.orange('chisle') + ': tool-output savings\n\n');

  let stats = null;
  try {
    if (!fs.lstatSync(p).isSymbolicLink()) {
      const parsed = JSON.parse(fs.readFileSync(p, 'utf8'));
      if (parsed && Number.isFinite(parsed.savedChars) && Number.isFinite(parsed.events)) stats = parsed;
    }
  } catch (e) {}

  if (!stats || stats.events === 0) {
    process.stdout.write('  no compression recorded yet\n\n');
    process.stdout.write(c.dim(`  ledger: ${p}\n`));
    process.stdout.write(c.dim('  it fills as the compressor elides oversized tool output.\n'));
    process.stdout.write(c.dim("  nothing there after real use? check `npx chisle --list` and that Chisle is active.\n"));
    return;
  }

  const chars = stats.savedChars;
  const tokens = Math.floor(chars / 4);
  const per = Math.round(chars / stats.events);
  const fmt = (n) => n.toLocaleString('en-US');
  process.stdout.write(`  saved:      ${c.green(fmt(chars) + ' chars')}  (~${fmt(tokens)} tokens)\n`);
  process.stdout.write(`  outputs:    ${fmt(stats.events)} compressed, ${fmt(per)} chars each on average\n\n`);
  process.stdout.write(c.dim('  A floor, not an estimate: every saved byte also stops being re-sent\n'));
  process.stdout.write(c.dim('  on every later request in that session.\n\n'));
  process.stdout.write(c.dim(`  ledger: ${p}\n`));
  process.stdout.write(c.dim('  per-transcript detail: node benchmarks/replay-compress.js (in a repo clone)\n'));
}

function printList(c) {
  process.stdout.write(c.orange('chisle') + ': detected agents:\n\n');
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
  if (opts.stats) return printStats(c, opts);

  const results = { detected: 0, installed: [], skipped: [], failed: [] };
  const say = (s) => process.stdout.write(s + '\n');
  const note = (s) => process.stdout.write(c.dim(s) + '\n');
  const warn = (s) => process.stdout.write(c.yellow(s) + '\n');
  const ctx = { say, note, warn, opts, results, c };

  if (opts.uninstall) return uninstall(ctx);

  say(c.orange(opts.update ? '╭─ Chisle updater ─╮' : '╭─ Chisle installer ─╮'));
  say(c.dim(opts.dryRun ? '  (dry run, nothing will change)' : '  maximum signal, minimum noise'));
  say('');

  let targets = PROVIDERS.filter(p => opts.only.length ? opts.only.includes(p.id) : detectMatch(p.detect));
  if (opts.update) targets = targets.filter(p => installedFor(p.id, opts));
  if (targets.length === 0) {
    if (opts.update) {
      warn('Nothing to update: Chisle is not installed for any detected agent.');
      note('Run `npx chisle` to install it, or `npx chisle --list` to see what we look for.');
      note('Project-scoped agents (Cursor, Windsurf, Cline, Kiro, Copilot) are per-repo:');
      note('run this from the project that has the rule file.');
      return;
    }
    warn('No supported agents detected.');
    note('Run `npx chisle --list` to see what we look for, or `--only <id>` to force one.');
    return;
  }

  for (const p of targets) {
    if (p.id === 'claude') installClaude(ctx);
    else if (p.id === 'pi') installPi(ctx);
    else if (p.id === 'gemini') installGemini(ctx);
    else if (p.id === 'codex') installCodex(ctx);
    else if (p.id === 'opencode') installOpencode(ctx);
    else if (p.id === 'hermes') installHermes(ctx);
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
    say(c.orange('Done.') + ' Restart your agent. Type ' + c.orange('/chisle') + ' in Claude Code or Pi, or just start coding.');
    note('If Chisle earns its keep, a star helps others find it: https://github.com/JayPokale/Chisle');
  }
  process.exit(results.failed.length ? 1 : 0);
}

main();
