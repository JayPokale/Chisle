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
const { requestedMode } = require('../hooks/chisle-mode');

// Run the tracker with a given prompt against a fresh temp config dir.
// Returns the flag contents after the run (or null if the flag was removed).
function runTracker(prompt, { preActive, defaultMode = 'on' } = {}) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'chisle-trk-'));
  const flagPath = path.join(dir, '.chisle-active');
  if (preActive) fs.writeFileSync(flagPath, preActive, { mode: 0o600 });

  try {
    execFileSync(process.execPath, [TRACKER], {
      input: JSON.stringify({ prompt }),
      env: { ...process.env, CLAUDE_CONFIG_DIR: dir, CHISLE_DEFAULT_MODE: defaultMode },
      encoding: 'utf8',
      timeout: 5000,
    });
  } catch (e) { /* tracker silent-fails; we assert on flag state */ }

  let flag = null;
  try { flag = fs.readFileSync(flagPath, 'utf8').trim(); } catch (e) {}
  fs.rmSync(dir, { recursive: true, force: true });
  return flag;
}

test('shared parser only deactivates when off-verb targets Chisle', () => {
  assert.equal(requestedMode('stop chisle'), 'off');
  assert.equal(requestedMode('normal mode'), 'off');
  assert.equal(requestedMode('use chisle to turn off the logger'), 'on');
  assert.equal(requestedMode('chisle please stop the server'), null);
});

// ── Activation ───────────────────────────────────────────────────────────────

test('/chisle activates at default level', () => {
  assert.equal(runTracker('/chisle'), 'on');
});

test('a leftover level argument still just activates', () => {
  // /chisle lite|full|ultra used to select an intensity. One mode now, so any
  // stray argument is ignored rather than rejected — old muscle memory works.
  assert.equal(runTracker('/chisle full'), 'on');
  assert.equal(runTracker('/chisle ultra'), 'on');
});

test('natural language "activate chisle" activates', () => {
  assert.equal(runTracker('please activate chisle'), 'on');
});

test('/chisle explicitly activates when default mode is off', () => {
  assert.equal(runTracker('/chisle', { defaultMode: 'off' }), 'on');
});

// ── Deactivation ─────────────────────────────────────────────────────────────

test('"stop chisle" deactivates', () => {
  assert.equal(runTracker('stop chisle', { preActive: 'on' }), null);
});

test('"/chisle off" deactivates', () => {
  assert.equal(runTracker('/chisle off', { preActive: 'on' }), null);
});

test('"normal mode" deactivates', () => {
  assert.equal(runTracker('normal mode', { preActive: 'on' }), null);
});

// ── Regression: must NOT deactivate on unrelated "off"/"stop" ─────────────────

test('REGRESSION: "use chisle to turn off the logger" stays active', () => {
  assert.equal(runTracker('use chisle to turn off the logger', { preActive: 'on' }), 'on');
});

test('REGRESSION: "chisle please stop the server" stays active', () => {
  assert.equal(runTracker('chisle please stop the server', { preActive: 'on' }), 'on');
});
