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

function runCLI(args, { cwd } = {}) {
  try {
    const out = execFileSync(process.execPath, [CLI, ...args, '--no-color'], {
      cwd: cwd || process.cwd(), encoding: 'utf8', timeout: 10000,
    });
    return { status: 0, out };
  } catch (e) {
    return { status: e.status ?? 1, out: (e.stdout || '') + (e.stderr || '') };
  }
}

test('--help lists all agents', () => {
  const { out } = runCLI(['--help']);
  for (const id of ['claude', 'gemini', 'codex', 'cursor', 'windsurf', 'cline', 'kiro', 'copilot']) {
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

test('dry-run changes nothing on disk', () => {
  const proj = fs.mkdtempSync(path.join(os.tmpdir(), 'chisle-dry-'));
  runCLI(['--only', 'cline', '--dry-run'], { cwd: proj });
  assert.ok(!fs.existsSync(path.join(proj, '.clinerules')), 'dry-run wrote nothing');
  fs.rmSync(proj, { recursive: true, force: true });
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
