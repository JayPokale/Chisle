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
