#!/usr/bin/env node
// Integration tests for bin/install.js — runs the real CLI against temp dirs.
// Covers the no-shell-out paths: project rule install, dry-run, list, idempotency.
// Run: node --test tests/test_installer.js

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync } = require('child_process');

const CLI = path.join(__dirname, '..', 'bin', 'install.js');

function runCLI(args, { cwd, env } = {}) {
  try {
    const out = execFileSync(process.execPath, [CLI, ...args, '--no-color'], {
      cwd: cwd || process.cwd(), encoding: 'utf8', timeout: 10000,
      env: env ? { ...process.env, ...env } : process.env,
    });
    return { status: 0, out };
  } catch (e) {
    return { status: e.status ?? 1, out: (e.stdout || '') + (e.stderr || '') };
  }
}

test('--help lists all agents', () => {
  const { out } = runCLI(['--help']);
  for (const id of ['claude', 'pi', 'gemini', 'codex', 'cursor', 'windsurf', 'cline', 'kiro', 'copilot']) {
    assert.match(out, new RegExp(id));
  }
});

test('--list shows detection marks without installing', () => {
  const { out } = runCLI(['--list']);
  assert.match(out, /Claude Code/);
  assert.match(out, /project-scoped/);
});

test('unknown flag exits 2', () => {
  const { status, out } = runCLI(['--frobnicate']);
  assert.equal(status, 2);
  assert.match(out, /unknown flag/);
});

test('--only with bad agent exits 2', () => {
  const { status } = runCLI(['--only', 'notanagent']);
  assert.equal(status, 2);
});

test('project rule install writes into CWD, is idempotent, --force overwrites', () => {
  const proj = fs.mkdtempSync(path.join(os.tmpdir(), 'chisle-proj-'));

  // First install
  let r = runCLI(['--only', 'cursor'], { cwd: proj });
  const ruleFile = path.join(proj, '.cursor', 'rules', 'chisle.mdc');
  assert.ok(fs.existsSync(ruleFile), 'rule file created in project');
  assert.match(r.out, /installed:/);

  // Second install — idempotent skip
  r = runCLI(['--only', 'cursor'], { cwd: proj });
  assert.match(r.out, /already in this project/);

  // Tamper, then --force restores
  fs.writeFileSync(ruleFile, 'TAMPERED');
  r = runCLI(['--only', 'cursor', '--force'], { cwd: proj });
  assert.notEqual(fs.readFileSync(ruleFile, 'utf8'), 'TAMPERED');

  fs.rmSync(proj, { recursive: true, force: true });
});

test('Pi package manifest ships extension and skill', () => {
  const pkg = require('../package.json');
  assert.deepEqual(pkg.pi.extensions, ['./pi-extension/index.js']);
  assert.deepEqual(pkg.pi.skills, ['./skills']);
  assert.ok(pkg.files.includes('pi-extension/'));
  assert.ok(fs.existsSync(path.join(__dirname, '..', 'pi-extension', 'index.js')));
});

test('OMP manifest points at a .cjs entry resolving to the same factory', () => {
  // OMP classifies a CommonJS entry named .js as ESM, so module.exports never
  // reaches the default export and its factory lookup fails. Only the entry
  // filename matters: a required .js dependency is classified correctly.
  // Resolution is `pkg.omp ?? pkg.pi`, so Pi keeps loading index.js and
  // nothing double-loads.
  const pkg = require('../package.json');
  assert.deepEqual(pkg.omp.extensions, ['./pi-extension/index.cjs']);
  assert.deepEqual(pkg.omp.skills, ['./skills']);
  assert.ok(pkg.files.includes('pi-extension/'));
  assert.ok(fs.existsSync(path.join(__dirname, '..', 'pi-extension', 'index.cjs')));
  assert.equal(require('../pi-extension/index.cjs'), require('../pi-extension/index.js'));
});

test('dry-run changes nothing on disk', () => {
  const proj = fs.mkdtempSync(path.join(os.tmpdir(), 'chisle-dry-'));
  runCLI(['--only', 'cline', '--dry-run'], { cwd: proj });
  assert.ok(!fs.existsSync(path.join(proj, '.clinerules')), 'dry-run wrote nothing');
  fs.rmSync(proj, { recursive: true, force: true });
});

test('Pi install, dry-run, and uninstall delegate settings changes to Pi', { skip: process.platform === 'win32' }, () => {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'chisle-pi-home-'));
  const binDir = fs.mkdtempSync(path.join(os.tmpdir(), 'chisle-pi-bin-'));
  const log = path.join(home, 'pi.log');
  const list = path.join(home, 'pi-list.txt');
  const settings = path.join(home, '.pi', 'agent', 'settings.json');
  fs.mkdirSync(path.dirname(settings), { recursive: true });
  fs.writeFileSync(settings, JSON.stringify({ theme: 'dark', packages: ['npm:foreign'] }));
  const fake = path.join(binDir, 'pi');
  fs.writeFileSync(fake, '#!/bin/sh\necho "$@" >> "$PI_LOG"\n[ "$1" = list ] && cat "$PI_LIST"\nexit 0\n', { mode: 0o755 });
  const env = {
    HOME: home,
    PATH: binDir + path.delimiter + process.env.PATH,
    PI_LOG: log,
    PI_LIST: list,
  };

  let result = runCLI(['--only', 'pi'], { env });
  assert.match(result.out, /Pi detected/);
  assert.match(fs.readFileSync(log, 'utf8'), /^list\ninstall npm:chisle\n$/);
  assert.deepEqual(JSON.parse(fs.readFileSync(settings, 'utf8')), { theme: 'dark', packages: ['npm:foreign'] },
    'installer edited Pi settings instead of delegating to Pi');

  fs.writeFileSync(list, 'User packages:\n  npm:chisle@3.0.0\n');
  fs.writeFileSync(log, '');
  result = runCLI(['--only', 'pi'], { env });
  assert.match(result.out, /already installed/);
  assert.equal(fs.readFileSync(log, 'utf8'), 'list\n');

  fs.writeFileSync(list, '');
  fs.writeFileSync(log, '');
  result = runCLI(['--only', 'pi', '--dry-run'], { env });
  assert.match(result.out, /would run: pi install npm:chisle/);
  assert.equal(fs.readFileSync(log, 'utf8'), 'list\n', 'dry-run invoked mutating Pi command');

  fs.writeFileSync(log, '');
  fs.writeFileSync(list, 'User packages:\n  npm:chisle@3.0.0\n');
  result = runCLI(['--uninstall', '--only', 'pi'], { env });
  assert.match(result.out, /Uninstalled/);
  assert.match(fs.readFileSync(log, 'utf8'), /^list\nremove npm:chisle\n$/);
  assert.deepEqual(JSON.parse(fs.readFileSync(settings, 'utf8')), { theme: 'dark', packages: ['npm:foreign'] },
    'uninstaller edited unrelated Pi settings');

  fs.rmSync(home, { recursive: true, force: true });
  fs.rmSync(binDir, { recursive: true, force: true });
});

test('standalone Claude hook wiring merges + uninstalls cleanly', () => {
  // Drive the standalone path by pointing --config-dir at a temp dir and using
  // --only claude. The claude CLI is likely present, so the plugin path may run;
  // either way the settings.json must remain valid JSON and uninstall must clean.
  const cfg = fs.mkdtempSync(path.join(os.tmpdir(), 'chisle-cfg-'));
  // Pre-seed a user settings.json with foreign content to protect.
  fs.writeFileSync(path.join(cfg, 'settings.json'), JSON.stringify({ model: 'opus' }, null, 2));

  runCLI(['--only', 'claude', '--config-dir', cfg, '--dry-run']);
  // Dry-run must not have altered the seeded file.
  assert.deepEqual(JSON.parse(fs.readFileSync(path.join(cfg, 'settings.json'), 'utf8')), { model: 'opus' });

  // Uninstall against the same dir must not corrupt the foreign settings.
  runCLI(['--uninstall', '--config-dir', cfg]);
  const after = JSON.parse(fs.readFileSync(path.join(cfg, 'settings.json'), 'utf8'));
  assert.equal(after.model, 'opus', 'foreign settings preserved through uninstall');

  fs.rmSync(cfg, { recursive: true, force: true });
});

// Regression for #4: the plugin path and the standalone path both registering
// the hooks made two copies run per tool call, and the shared dedup state file
// then reported first-seen output as a duplicate of itself.
test('REGRESSION: plugin path removes leftover standalone hook entries', { skip: process.platform === 'win32' }, () => {
  const cfg = fs.mkdtempSync(path.join(os.tmpdir(), 'chisle-conv-'));
  const binDir = fs.mkdtempSync(path.join(os.tmpdir(), 'chisle-fakebin-'));
  // A `claude` that reports the plugin as installed, so installClaude() takes
  // the plugin branch without shelling out to a real marketplace.
  const fake = path.join(binDir, 'claude');
  fs.writeFileSync(fake, '#!/bin/sh\necho chisle\nexit 0\n', { mode: 0o755 });

  // Seed the state an affected machine is in: standalone wiring plus a foreign
  // hook that must survive.
  fs.writeFileSync(path.join(cfg, 'settings.json'), JSON.stringify({
    model: 'opus',
    hooks: {
      PostToolUse: [
        { hooks: [{ type: 'command', command: 'node ~/.claude/chisle-hooks/chisle-compress-output.js' }] },
        { hooks: [{ type: 'command', command: 'node ~/.claude/other/keep-me.js' }] },
      ],
    },
  }, null, 2));

  const env = { PATH: binDir + path.delimiter + process.env.PATH };
  runCLI(['--only', 'claude', '--config-dir', cfg], { env });

  const after = JSON.parse(fs.readFileSync(path.join(cfg, 'settings.json'), 'utf8'));
  const cmds = ((after.hooks && after.hooks.PostToolUse) || [])
    .flatMap(e => (e.hooks || []).map(h => h.command));
  assert.ok(!cmds.some(c => c.includes('chisle-')), 'standalone chisle hook still registered');
  assert.ok(cmds.some(c => c.includes('keep-me.js')), 'foreign hook removed');
  assert.equal(after.model, 'opus');

  fs.rmSync(cfg, { recursive: true, force: true });
  fs.rmSync(binDir, { recursive: true, force: true });
});

// ── --stats ─────────────────────────────────────────────────────────────────
// The ledger is written by the compressor hook, so these tests seed it directly
// and assert the CLI reports what is actually there, never an estimate.

test('--stats reports the ledger and changes nothing', () => {
  const cfg = fs.mkdtempSync(path.join(os.tmpdir(), 'chisle-stats-'));
  const ledger = path.join(cfg, '.chisle-compress-stats.json');
  fs.writeFileSync(ledger, JSON.stringify({ savedChars: 88967, events: 18 }));
  const before = fs.readFileSync(ledger, 'utf8');

  const r = runCLI(['--stats', '--config-dir', cfg]);
  assert.equal(r.status, 0);
  assert.match(r.out, /88,967 chars/);
  assert.match(r.out, /22,241 tokens/);   // chars / 4, floored
  assert.match(r.out, /18 compressed/);
  assert.equal(fs.readFileSync(ledger, 'utf8'), before, '--stats must be read-only');
  assert.equal(fs.readdirSync(cfg).length, 1, '--stats must not create files');

  fs.rmSync(cfg, { recursive: true, force: true });
});

test('--stats says so plainly when nothing has been recorded', () => {
  const cfg = fs.mkdtempSync(path.join(os.tmpdir(), 'chisle-stats-empty-'));
  const r = runCLI(['--stats', '--config-dir', cfg]);
  assert.equal(r.status, 0);
  assert.match(r.out, /no compression recorded yet/);
  assert.doesNotMatch(r.out, /NaN|undefined/);
  fs.rmSync(cfg, { recursive: true, force: true });
});

test('--stats survives a corrupt or hostile ledger', () => {
  const cfg = fs.mkdtempSync(path.join(os.tmpdir(), 'chisle-stats-bad-'));
  for (const junk of ['{', 'null', '{"savedChars":"lots","events":3}', '[]']) {
    fs.writeFileSync(path.join(cfg, '.chisle-compress-stats.json'), junk);
    const r = runCLI(['--stats', '--config-dir', cfg]);
    assert.equal(r.status, 0, `crashed on ${junk}`);
    assert.match(r.out, /no compression recorded yet/, `trusted ${junk}`);
  }
  fs.rmSync(cfg, { recursive: true, force: true });
});

test('--stats refuses to follow a symlinked ledger', { skip: process.platform === 'win32' }, () => {
  const cfg = fs.mkdtempSync(path.join(os.tmpdir(), 'chisle-stats-link-'));
  const real = path.join(cfg, 'elsewhere.json');
  fs.writeFileSync(real, JSON.stringify({ savedChars: 99999, events: 7 }));
  fs.symlinkSync(real, path.join(cfg, '.chisle-compress-stats.json'));

  const r = runCLI(['--stats', '--config-dir', cfg]);
  assert.equal(r.status, 0);
  assert.doesNotMatch(r.out, /99,999/, 'followed a symlink');
  fs.rmSync(cfg, { recursive: true, force: true });
});

test('--help and --list advertise --stats', () => {
  assert.match(runCLI(['--help']).out, /--stats/);
});

// ── --update ────────────────────────────────────────────────────────────────
// The bug this flag exists for: `npx chisle` skips whatever is already there,
// so the documented upgrade command reported success and changed nothing.

test('--update refreshes an installed Pi package instead of skipping it', { skip: process.platform === 'win32' }, () => {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'chisle-upd-home-'));
  const binDir = fs.mkdtempSync(path.join(os.tmpdir(), 'chisle-upd-bin-'));
  const log = path.join(home, 'pi.log');
  const list = path.join(home, 'pi-list.txt');
  fs.writeFileSync(list, 'User packages:\n  npm:chisle@3.0.0\n');
  fs.writeFileSync(path.join(binDir, 'pi'),
    '#!/bin/sh\necho "$@" >> "$PI_LOG"\n[ "$1" = list ] && cat "$PI_LIST"\nexit 0\n', { mode: 0o755 });
  const env = { HOME: home, PATH: binDir + path.delimiter + process.env.PATH, PI_LOG: log, PI_LIST: list };

  // plain install: sees it, leaves it alone
  const plain = runCLI(['--only', 'pi'], { env });
  assert.match(plain.out, /already installed/);

  // update: reinstalls the same agent
  fs.writeFileSync(log, '');
  const upd = runCLI(['--only', 'pi', '--update'], { env });
  assert.match(upd.out, /Chisle updater/);
  assert.doesNotMatch(upd.out, /already installed/);
  assert.match(fs.readFileSync(log, 'utf8'), /install npm:chisle/, '--update did not reinstall');

  fs.rmSync(home, { recursive: true, force: true });
  fs.rmSync(binDir, { recursive: true, force: true });
});

test('--update installs nothing new and says why', { skip: process.platform === 'win32' }, () => {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'chisle-upd-none-'));
  const binDir = fs.mkdtempSync(path.join(os.tmpdir(), 'chisle-upd-none-bin-'));
  const log = path.join(home, 'pi.log');
  const list = path.join(home, 'pi-list.txt');
  fs.writeFileSync(list, 'User packages:\n  npm:something-else@1.0.0\n');
  fs.writeFileSync(path.join(binDir, 'pi'),
    '#!/bin/sh\necho "$@" >> "$PI_LOG"\n[ "$1" = list ] && cat "$PI_LIST"\nexit 0\n', { mode: 0o755 });
  const env = { HOME: home, PATH: binDir + path.delimiter + process.env.PATH, PI_LOG: log, PI_LIST: list };

  const r = runCLI(['--only', 'pi', '--update'], { env });
  assert.match(r.out, /Nothing to update/);
  assert.doesNotMatch(fs.readFileSync(log, 'utf8'), /install/, '--update installed an absent agent');

  fs.rmSync(home, { recursive: true, force: true });
  fs.rmSync(binDir, { recursive: true, force: true });
});

test('--update refreshes a project rule file in place', () => {
  const proj = fs.mkdtempSync(path.join(os.tmpdir(), 'chisle-upd-proj-'));
  const rule = path.join(proj, '.clinerules', 'chisle.md');

  runCLI(['--only', 'cline'], { cwd: proj });
  assert.ok(fs.existsSync(rule));
  fs.writeFileSync(rule, 'stale copy from an older release\n');

  const r = runCLI(['--only', 'cline', '--update'], { cwd: proj });
  assert.match(r.out, /Chisle updater/);
  assert.doesNotMatch(fs.readFileSync(rule, 'utf8'), /stale copy/, '--update left a stale rule file');

  fs.rmSync(proj, { recursive: true, force: true });
});

test('--update is read-only under --dry-run', { skip: process.platform === 'win32' }, () => {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'chisle-upd-dry-'));
  const binDir = fs.mkdtempSync(path.join(os.tmpdir(), 'chisle-upd-dry-bin-'));
  const log = path.join(home, 'pi.log');
  const list = path.join(home, 'pi-list.txt');
  fs.writeFileSync(list, 'User packages:\n  npm:chisle@3.0.0\n');
  fs.writeFileSync(path.join(binDir, 'pi'),
    '#!/bin/sh\necho "$@" >> "$PI_LOG"\n[ "$1" = list ] && cat "$PI_LIST"\nexit 0\n', { mode: 0o755 });
  const env = { HOME: home, PATH: binDir + path.delimiter + process.env.PATH, PI_LOG: log, PI_LIST: list };

  const r = runCLI(['--only', 'pi', '--update', '--dry-run'], { env });
  assert.match(r.out, /would run: pi install npm:chisle/);
  assert.doesNotMatch(fs.readFileSync(log, 'utf8'), /install/, 'dry-run mutated');

  fs.rmSync(home, { recursive: true, force: true });
  fs.rmSync(binDir, { recursive: true, force: true });
});

test('--help advertises --update', () => {
  assert.match(runCLI(['--help']).out, /--update/);
});
// ── OpenCode + Hermes ────────────────────────────────────────────────────────
// Global agents. CHISLE_HOME redirects the home dir so tests never touch
// the real ~/.config/opencode or ~/.hermes. Runs on win32 too (no shell).

function mkHome() { return fs.mkdtempSync(path.join(os.tmpdir(), 'chisle-home-')); }

function repoSkill(rel) { return fs.readFileSync(path.join(__dirname, '..', 'skills', rel), 'utf8'); }

test('--help and --list advertise opencode + hermes', () => {
  assert.match(runCLI(['--help']).out, /opencode/);
  assert.match(runCLI(['--help']).out, /hermes/);
  assert.match(runCLI(['--list']).out, /OpenCode/);
  assert.match(runCLI(['--list']).out, /Hermes/);
});

test('opencode install appends fenced ruleset, preserves user content, copies skills', () => {
  const home = mkHome();
  const env = { CHISLE_HOME: home };
  const agents = path.join(home, '.config', 'opencode', 'AGENTS.md');
  const skills = path.join(home, '.config', 'opencode', 'skills');
  fs.mkdirSync(path.dirname(agents), { recursive: true });
  fs.writeFileSync(agents, '# my setup\n\nmy instructions.\n');

  const r = runCLI(['--only', 'opencode'], { env });
  assert.match(r.out, /installed:/);
  const txt = fs.readFileSync(agents, 'utf8');
  assert.ok(txt.startsWith('# my setup\n\nmy instructions.\n'), 'user instructions moved or clobbered');
  assert.ok(txt.includes('<!-- chisle-begin -->') && txt.includes('<!-- chisle-end -->'));
  assert.equal(txt.indexOf('<!-- chisle-begin -->'), txt.lastIndexOf('<!-- chisle-begin -->'), 'fence duplicated');
  for (const s of ['chisle', 'chisle-audit', 'chisle-help', 'chisle-review']) {
    assert.equal(fs.readFileSync(path.join(skills, s, 'SKILL.md'), 'utf8'), repoSkill(s + '/SKILL.md'), s + ' not verbatim');
  }

  // Compression plugin + its zero-dep core land in plugins/.
  const plugins = path.join(home, '.config', 'opencode', 'plugins');
  assert.ok(fs.existsSync(path.join(plugins, 'chisle.js')), 'plugin not installed');
  assert.ok(fs.existsSync(path.join(plugins, 'chisle-hooks', 'chisle-compress-output.js')), 'compressor core not installed');
  assert.ok(fs.existsSync(path.join(plugins, 'chisle-hooks', 'chisle-config.js')), 'config core not installed');
  // The CJS core must stay CJS even though OpenCode's config dir is type:module,
  // which would otherwise propagate down and kill it on its first `require`.
  assert.equal(
    JSON.parse(fs.readFileSync(path.join(plugins, 'chisle-hooks', 'package.json'), 'utf8')).type,
    'commonjs', 'compressor core not pinned to commonjs');

  // Second run: ruleset skipped, never duplicated; skills refreshed.
  const r2 = runCLI(['--only', 'opencode'], { env });
  assert.match(r2.out, /already contains chisle ruleset/);
  const txt2 = fs.readFileSync(agents, 'utf8');
  assert.equal(txt2.indexOf('<!-- chisle-begin -->'), txt2.lastIndexOf('<!-- chisle-begin -->'));
  assert.ok(txt2.startsWith('# my setup'), 'reinstall moved user content');

  // Stale fence refreshes under --update, user content survives.
  fs.writeFileSync(agents, txt2.replace(/# Chisle[\s\S]*<!-- chisle-end -->/, 'STALE\n<!-- chisle-end -->'));
  runCLI(['--only', 'opencode', '--update'], { env });
  const txt3 = fs.readFileSync(agents, 'utf8');
  assert.doesNotMatch(txt3, /STALE/);
  assert.ok(txt3.startsWith('# my setup'), 'update moved user content');

  // Uninstall removes the block + owned skills, restores user content.
  fs.mkdirSync(path.join(skills, 'foreign'), { recursive: true });
  fs.writeFileSync(path.join(skills, 'foreign', 'SKILL.md'), 'not ours');
  const u = runCLI(['--uninstall', '--only', 'opencode'], { env });
  assert.match(u.out, /removed chisle block/);
  const after = fs.readFileSync(agents, 'utf8');
  assert.ok(after.startsWith('# my setup'), 'uninstall ate user content');
  assert.doesNotMatch(after, /chisle-begin/);
  assert.ok(!fs.existsSync(path.join(skills, 'chisle')), 'owned skill left behind');
  assert.equal(fs.readFileSync(path.join(skills, 'foreign', 'SKILL.md'), 'utf8'), 'not ours', 'foreign skill touched');
  assert.ok(!fs.existsSync(path.join(plugins, 'chisle.js')), 'plugin left behind');
  assert.ok(!fs.existsSync(path.join(plugins, 'chisle-hooks')), 'plugin core left behind');

  fs.rmSync(home, { recursive: true, force: true });
});

test('hermes install copies skills verbatim, uninstall prunes only owned', () => {
  const home = mkHome();
  const env = { CHISLE_HOME: home };
  const skills = path.join(home, '.hermes', 'skills');

  const r = runCLI(['--only', 'hermes'], { env });
  assert.match(r.out, /Hermes Agent detected/);
  for (const s of ['chisle', 'chisle-audit', 'chisle-help', 'chisle-review']) {
    assert.equal(fs.readFileSync(path.join(skills, s, 'SKILL.md'), 'utf8'), repoSkill(s + '/SKILL.md'), s + ' not verbatim');
  }

  fs.mkdirSync(path.join(skills, 'mine'), { recursive: true });
  fs.writeFileSync(path.join(skills, 'mine', 'SKILL.md'), 'mine');
  const u = runCLI(['--uninstall', '--only', 'hermes'], { env });
  assert.match(u.out, /Uninstalled/);
  assert.ok(!fs.existsSync(path.join(skills, 'chisle')));
  assert.equal(fs.readFileSync(path.join(skills, 'mine', 'SKILL.md'), 'utf8'), 'mine');

  fs.rmSync(home, { recursive: true, force: true });
});

test('opencode+hermes dry-run changes nothing on disk', () => {
  const home = mkHome();
  const env = { CHISLE_HOME: home };
  runCLI(['--only', 'opencode', '--only', 'hermes', '--dry-run'], { env });
  assert.deepEqual(fs.readdirSync(home), [], 'dry-run wrote into CHISLE_HOME');
  fs.rmSync(home, { recursive: true, force: true });
});

test('a fence missing its end marker is left alone, not truncated', () => {
  // A begin marker with no end marker means a hand edit or a cut-short write.
  // Everything after it is user content of unknown extent, so both refresh and
  // uninstall must refuse. Slicing to the end marker unconditionally would eat
  // the rest of the user's global instructions.
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'chisle-fence-'));
  const env = { CHISLE_HOME: home };
  const body = 'my rules\n\n<!-- chisle-begin -->\nstale\n\nKEEP THIS\n';

  for (const [id, rel] of [['codex', ['.codex', 'AGENTS.md']], ['opencode', ['.config', 'opencode', 'AGENTS.md']]]) {
    const md = path.join(home, ...rel);
    fs.mkdirSync(path.dirname(md), { recursive: true });

    fs.writeFileSync(md, body);
    let r = runCLI(['--only', id, '--force'], { env });
    assert.match(r.out, /no chisle-end/, id + ': no warning');
    assert.equal(fs.readFileSync(md, 'utf8'), body, id + ': --force rewrote a malformed fence');

    fs.writeFileSync(md, body);
    r = runCLI(['--uninstall', '--only', id], { env });
    assert.equal(fs.readFileSync(md, 'utf8'), body, id + ': uninstall ate user content');
  }

  fs.rmSync(home, { recursive: true, force: true });
});
test('codex fenced install still works via shared helper (refactor guard)', () => {
  const home = mkHome();
  const env = { CHISLE_HOME: home };
  const agents = path.join(home, '.codex', 'AGENTS.md');

  runCLI(['--only', 'codex'], { env });
  assert.ok(fs.readFileSync(agents, 'utf8').includes('<!-- chisle-begin -->'));
  const r = runCLI(['--only', 'codex'], { env });
  assert.match(r.out, /already contains chisle ruleset/);
  runCLI(['--uninstall', '--only', 'codex'], { env });
  assert.doesNotMatch(fs.readFileSync(agents, 'utf8'), /chisle-begin/);

  fs.rmSync(home, { recursive: true, force: true });
});
