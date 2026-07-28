#!/usr/bin/env node
// Integration tests for chisle-mode-tracker.js — drives it via stdin with a temp
// CLAUDE_CONFIG_DIR and asserts the resulting flag state.
// Run: node --test tests/test_tracker.js

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync } = require('child_process');

const TRACKER = path.join(__dirname, '..', 'hooks', 'chisle-mode-tracker.js');

// Run the tracker with a given prompt against a fresh temp config dir.
// Returns the flag contents after the run (or null if the flag was removed).
function runTracker(prompt, { preActive } = {}) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'chisle-trk-'));
  const flagPath = path.join(dir, '.chisle-active');
  if (preActive) fs.writeFileSync(flagPath, preActive, { mode: 0o600 });

  try {
    execFileSync(process.execPath, [TRACKER], {
      input: JSON.stringify({ prompt }),
      env: { ...process.env, CLAUDE_CONFIG_DIR: dir, CHISLE_DEFAULT_MODE: 'full' },
      encoding: 'utf8',
      timeout: 5000,
    });
  } catch (e) { /* tracker silent-fails; we assert on flag state */ }

  let flag = null;
  try { flag = fs.readFileSync(flagPath, 'utf8').trim(); } catch (e) {}
  fs.rmSync(dir, { recursive: true, force: true });
  return flag;
}

// ── Activation ───────────────────────────────────────────────────────────────

test('/chisle activates at default level', () => {
  assert.equal(runTracker('/chisle'), 'full');
});

test('/chisle ultra activates ultra', () => {
  assert.equal(runTracker('/chisle ultra'), 'ultra');
});

test('natural language "activate chisle" activates', () => {
  assert.equal(runTracker('please activate chisle'), 'full');
});

// ── Deactivation ─────────────────────────────────────────────────────────────

test('"stop chisle" deactivates', () => {
  assert.equal(runTracker('stop chisle', { preActive: 'full' }), null);
});

test('"/chisle off" deactivates', () => {
  assert.equal(runTracker('/chisle off', { preActive: 'full' }), null);
});

test('"normal mode" deactivates', () => {
  assert.equal(runTracker('normal mode', { preActive: 'full' }), null);
});

// ── Regression: must NOT deactivate on unrelated "off"/"stop" ─────────────────

test('REGRESSION: "use chisle to turn off the logger" stays active', () => {
  assert.equal(runTracker('use chisle to turn off the logger', { preActive: 'full' }), 'full');
});

test('REGRESSION: "chisle please stop the server" stays active', () => {
  assert.equal(runTracker('chisle please stop the server', { preActive: 'full' }), 'full');
});
