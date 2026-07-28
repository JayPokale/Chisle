#!/usr/bin/env node
// Tests for bin/lib/settings.js — the settings.json mutation logic.
// This touches real user config in production, so the merge/uninstall round
// trip must be airtight.
// Run: node --test tests/test_settings.js

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');

const S = require('../bin/lib/settings.js');

function tmp() { return fs.mkdtempSync(path.join(os.tmpdir(), 'chisle-set-')); }

// ── stripJsonComments ────────────────────────────────────────────────────────

test('stripJsonComments removes // and /* */ but spares strings', () => {
  const src = '{\n  "a": 1, // line\n  /* block */ "b": "http://x", \n}';
  const out = S.stripJsonComments(src);
  const parsed = JSON.parse(out);
  assert.equal(parsed.a, 1);
  assert.equal(parsed.b, 'http://x'); // // inside string survived
});

test('readSettings parses JSONC with trailing commas', () => {
  const dir = tmp();
  const p = path.join(dir, 'settings.json');
  fs.writeFileSync(p, '{ "x": 1, /* c */ "y": 2, }');
  assert.deepEqual(S.readSettings(p), { x: 1, y: 2 });
  fs.rmSync(dir, { recursive: true });
});

test('readSettings returns {} for missing, null for garbage', () => {
  assert.deepEqual(S.readSettings('/tmp/chisle-nope-xyz.json'), {});
  const dir = tmp();
  const p = path.join(dir, 's.json');
  fs.writeFileSync(p, '{ this is not json at all ::: }');
  assert.equal(S.readSettings(p), null);
  fs.rmSync(dir, { recursive: true });
});

// ── addCommandHook idempotency ───────────────────────────────────────────────

test('addCommandHook adds once, second call is a no-op', () => {
  const s = {};
  const a = S.addCommandHook(s, 'SessionStart', { command: 'node /x/chisle-activate.js', marker: 'chisle-activate' });
  const b = S.addCommandHook(s, 'SessionStart', { command: 'node /x/chisle-activate.js', marker: 'chisle-activate' });
  assert.equal(a, true);
  assert.equal(b, false);
  assert.equal(s.hooks.SessionStart.length, 1);
});

test('addCommandHook preserves a foreign hook already present', () => {
  const s = { hooks: { SessionStart: [{ hooks: [{ type: 'command', command: 'node /other/thing.js' }] }] } };
  S.addCommandHook(s, 'SessionStart', { command: 'node /x/chisle-activate.js', marker: 'chisle-activate' });
  assert.equal(s.hooks.SessionStart.length, 2); // foreign one untouched
});

// ── removeHooks (uninstall) ──────────────────────────────────────────────────

test('removeHooks strips only chisle entries, leaves foreign ones', () => {
  const s = { hooks: { SessionStart: [
    { hooks: [{ type: 'command', command: 'node /x/chisle-activate.js' }] },
    { hooks: [{ type: 'command', command: 'node /other/keep.js' }] },
  ] } };
  const removed = S.removeHooks(s, 'chisle-');
  assert.equal(removed, 1);
  assert.equal(s.hooks.SessionStart.length, 1);
  assert.match(s.hooks.SessionStart[0].hooks[0].command, /keep\.js/);
});

test('install then uninstall round-trips to original', () => {
  const original = { model: 'opus', hooks: { SessionStart: [{ hooks: [{ type: 'command', command: 'node /foo/bar.js' }] }] } };
  const s = JSON.parse(JSON.stringify(original));
  S.addCommandHook(s, 'SessionStart', { command: 'node /x/chisle-activate.js', marker: 'chisle-activate' });
  S.addCommandHook(s, 'UserPromptSubmit', { command: 'node /x/chisle-mode-tracker.js', marker: 'chisle-mode-tracker' });
  S.removeHooks(s, 'chisle-');
  assert.deepEqual(s, original); // user's original config restored exactly
});

// ── validateHookFields ───────────────────────────────────────────────────────

test('validateHookFields drops malformed entries before write', () => {
  const s = { hooks: { SessionStart: [
    { hooks: [{ type: 'command', command: 'ok' }] },
    { hooks: [{ type: 'command' }] },          // missing command → drop
    { nope: true },                            // no hooks array → drop
  ] } };
  S.validateHookFields(s);
  assert.equal(s.hooks.SessionStart.length, 1);
});

// ── atomic write ─────────────────────────────────────────────────────────────

test('writeSettings produces valid JSON with trailing newline', () => {
  const dir = tmp();
  const p = path.join(dir, 'settings.json');
  S.writeSettings(p, { a: 1 });
  const raw = fs.readFileSync(p, 'utf8');
  assert.ok(raw.endsWith('\n'));
  assert.deepEqual(JSON.parse(raw), { a: 1 });
  fs.rmSync(dir, { recursive: true });
});
