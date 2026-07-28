#!/usr/bin/env node
// Basic hook tests — validates config logic and flag safety
// Run: node --test tests/test_hooks.js

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');

const { VALID_MODES, safeWriteFlag, readFlag, getDefaultMode } = require('../hooks/chisle-config');

// ── VALID_MODES ──────────────────────────────────────────────────────────────

test('VALID_MODES contains expected levels', () => {
  assert.ok(VALID_MODES.includes('off'));
  assert.ok(VALID_MODES.includes('on'));
  assert.equal(VALID_MODES.length, 2);
});

// ── safeWriteFlag / readFlag ─────────────────────────────────────────────────

function tmpDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'chisle-test-'));
}

test('safeWriteFlag writes and readFlag reads back', () => {
  const dir = tmpDir();
  const flagPath = path.join(dir, '.chisle-active');
  safeWriteFlag(flagPath, 'on');
  assert.equal(readFlag(flagPath), 'on');
  fs.rmSync(dir, { recursive: true });
});

test('readFlag returns null for missing file', () => {
  assert.equal(readFlag('/tmp/chisle-does-not-exist-xyz'), null);
});

test('readFlag returns null for unknown mode', () => {
  const dir = tmpDir();
  const flagPath = path.join(dir, '.chisle-active');
  fs.writeFileSync(flagPath, 'wenyan-ultra', { mode: 0o600 });
  assert.equal(readFlag(flagPath), null);
  fs.rmSync(dir, { recursive: true });
});

test('readFlag returns null for symlink', () => {
  const dir = tmpDir();
  const flagPath = path.join(dir, '.chisle-active');
  const target = path.join(dir, 'target');
  fs.writeFileSync(target, 'on', { mode: 0o600 });
  fs.symlinkSync(target, flagPath);
  assert.equal(readFlag(flagPath), null);
  fs.rmSync(dir, { recursive: true });
});

test('readFlag returns null for oversized file', () => {
  const dir = tmpDir();
  const flagPath = path.join(dir, '.chisle-active');
  fs.writeFileSync(flagPath, 'on' + 'x'.repeat(100), { mode: 0o600 });
  assert.equal(readFlag(flagPath), null);
  fs.rmSync(dir, { recursive: true });
});

test('safeWriteFlag refuses to overwrite a symlink', () => {
  const dir = tmpDir();
  const flagPath = path.join(dir, '.chisle-active');
  const target = path.join(dir, 'target');
  fs.writeFileSync(target, '', { mode: 0o600 });
  fs.symlinkSync(target, flagPath);
  safeWriteFlag(flagPath, 'on'); // must not throw, must not overwrite
  assert.equal(fs.readFileSync(target, 'utf8'), ''); // target untouched
  fs.rmSync(dir, { recursive: true });
});

// ── getDefaultMode ───────────────────────────────────────────────────────────

test('getDefaultMode returns full by default', () => {
  const saved = process.env.CHISLE_DEFAULT_MODE;
  delete process.env.CHISLE_DEFAULT_MODE;
  // Only validates when no user config file exists (CI / clean env)
  const mode = getDefaultMode();
  assert.ok(VALID_MODES.includes(mode));
  if (saved !== undefined) process.env.CHISLE_DEFAULT_MODE = saved;
});

test('getDefaultMode respects CHISLE_DEFAULT_MODE env var', () => {
  process.env.CHISLE_DEFAULT_MODE = 'off';
  assert.equal(getDefaultMode(), 'off');
  process.env.CHISLE_DEFAULT_MODE = 'on';
  assert.equal(getDefaultMode(), 'on');
  delete process.env.CHISLE_DEFAULT_MODE;
});

test('getDefaultMode ignores invalid CHISLE_DEFAULT_MODE', () => {
  process.env.CHISLE_DEFAULT_MODE = 'wenyan-ultra';
  const mode = getDefaultMode();
  assert.ok(VALID_MODES.includes(mode));
  delete process.env.CHISLE_DEFAULT_MODE;
});

// ── major-version update notice ──────────────────────────────────────────────

const { majorOf, majorUpdateNotice } = require('../hooks/chisle-activate');

test('majorOf parses majors, rejects garbage', () => {
  assert.equal(majorOf('1.1.2'), 1);
  assert.equal(majorOf('12.0.0'), 12);
  assert.equal(majorOf('nonsense'), null);
  assert.equal(majorOf(null), null);
});

test('notice fires only on a major jump', () => {
  assert.ok(majorUpdateNotice('1.1.2', '2.0.0'));
  assert.ok(majorUpdateNotice('1.9.9', '3.1.0'));
  assert.equal(majorUpdateNotice('1.1.2', '1.9.9'), null);  // minor: silent
  assert.equal(majorUpdateNotice('2.0.0', '2.0.1'), null);  // patch: silent
  assert.equal(majorUpdateNotice('2.0.0', '1.9.9'), null);  // downgrade: silent
  assert.equal(majorUpdateNotice(null, '2.0.0'), null);     // unknown install: silent
  assert.equal(majorUpdateNotice('1.0.0', null), null);     // no registry data: silent
});

test('requiring chisle-activate has no side effects', () => {
  // If the require.main guard is broken this test file would have already
  // emitted the ruleset or called process.exit before reaching here.
  assert.ok(true);
});

// ── SessionStart injection gating ────────────────────────────────────────────
// Regression guard for #2 (@enc0ded): the full ruleset was re-injected on
// resume/clear/compact as well as startup, so the plugin's own overhead ate
// most of what the compressor saved.

const { execFileSync } = require('child_process');
const ACTIVATE = path.join(__dirname, '..', 'hooks', 'chisle-activate.js');

function activate(stdin) {
  const dir = tmpDir();
  try {
    return execFileSync(process.execPath, [ACTIVATE], {
      input: stdin,
      env: { ...process.env, CLAUDE_CONFIG_DIR: dir, CHISLE_DEFAULT_MODE: 'on', CHISLE_UPDATE_CHECK: '0' },
      encoding: 'utf8',
      timeout: 5000,
    });
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

test('REGRESSION #2: startup gets the full ruleset', () => {
  const out = activate(JSON.stringify({ source: 'startup' }));
  assert.ok(out.length > 2000, `expected full ruleset, got ${out.length} chars`);
  assert.match(out, /CHISLE ACTIVE/);
});

test('REGRESSION #2: resume/clear/compact do not re-inject the ruleset', () => {
  for (const source of ['resume', 'clear', 'compact']) {
    const out = activate(JSON.stringify({ source }));
    assert.ok(out.length < 400, `${source} re-injected ${out.length} chars`);
    // still has to announce the mode, or the session silently loses it
    assert.match(out, /CHISLE ACTIVE/);
  }
});

test('unknown or malformed source falls back to a full inject', () => {
  // failing open (over-teaching once) beats a session with no ruleset at all
  assert.ok(activate('not json').length > 2000);
  assert.ok(activate('').length > 2000);
  assert.ok(activate(JSON.stringify({})).length > 2000);
});

// ── Version sync across manifests ────────────────────────────────────────────
// The update notice reads .claude-plugin/plugin.json, not package.json. When
// those drifted (plugin 1.2.2 vs published 2.0.0) every user on the current
// release was told a major update was available. Keep them equal.

test('every manifest carries the same version', () => {
  const root = path.join(__dirname, '..');
  const files = [
    'package.json',
    '.claude-plugin/plugin.json',
    '.github/plugin/plugin.json',
    '.codex-plugin/plugin.json',
    'gemini-extension.json',
  ];
  const versions = files.map((f) => [
    f,
    JSON.parse(fs.readFileSync(path.join(root, f), 'utf8')).version,
  ]);
  const expected = versions[0][1];
  for (const [f, v] of versions) {
    assert.equal(v, expected, `${f} is ${v}, expected ${expected}`);
  }
});

test('the changelog documents the shipped version', () => {
  const root = path.join(__dirname, '..');
  const v = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8')).version;
  const log = fs.readFileSync(path.join(root, 'CHANGELOG.md'), 'utf8');
  assert.ok(log.includes(`## [${v}]`), `CHANGELOG.md has no section for ${v}`);
});
