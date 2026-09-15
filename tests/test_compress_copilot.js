#!/usr/bin/env node
// Tool-output compressor — GitHub Copilot CLI payload-shape tests.
// Run: node --test tests/test_compress_copilot.js
//
// Kept as a separate file from test_compress.js on purpose: it only touches
// the new Copilot-specific surface (isCopilotPayload, copilotToolAllowed,
// SAFE_TOOLS_COPILOT, and the Copilot branches inside processPayload/main),
// so it can be reviewed and, if needed, reverted independently of the
// existing Claude/Pi test suite.

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');

const {
  isCopilotPayload, copilotToolAllowed, processPayload, SAFE_TOOLS_COPILOT,
} = require('../hooks/chisle-compress-output');

function bigOutput(lines, prefix) {
  return Array.from({ length: lines }, (_, i) => `${prefix || 'line'} ${i} ${'x'.repeat(80)}`).join('\n');
}

function copilotPayload(overrides) {
  return Object.assign({
    sessionId: 'copilot-sess-1',
    timestamp: 1700000000000,
    cwd: 'C:\\test',
    toolName: 'bash',
    toolArgs: {},
    toolResult: { resultType: 'success', textResultForLlm: bigOutput(500) },
  }, overrides);
}

// ── shape detection ──────────────────────────────────────────────────────────

test('isCopilotPayload recognizes the flat camelCase shape, not Claude/Pi shape', () => {
  assert.equal(isCopilotPayload(copilotPayload()), true);
  assert.equal(isCopilotPayload({ tool_name: 'Bash', tool_response: 'x' }), false);
  assert.equal(isCopilotPayload(null), false);
  assert.equal(isCopilotPayload({ toolName: 'bash' }), false); // toolResult missing
});

// ── copilotToolAllowed — mirrors toolAllowed's allow/deny split for Copilot ──

test('Copilot: view/create/edit (Read/Edit/Write equivalents) are NEVER compressed', () => {
  assert.equal(copilotToolAllowed('view'), false);
  assert.equal(copilotToolAllowed('create'), false);
  assert.equal(copilotToolAllowed('edit'), false);
});

test('Copilot: bash/powershell/grep/glob/web_fetch/web_search/task are compressible', () => {
  for (const t of SAFE_TOOLS_COPILOT) assert.equal(copilotToolAllowed(t), true);
});

test('Copilot: CHISLE_COMPRESS_TOOLS overrides the Copilot allowlist too', () => {
  process.env.CHISLE_COMPRESS_TOOLS = 'bash';
  assert.equal(copilotToolAllowed('grep'), false);
  assert.equal(copilotToolAllowed('bash'), true);
  delete process.env.CHISLE_COMPRESS_TOOLS;
});

// ── processPayload — Copilot branch of the full pipeline ────────────────────

test('processPayload compresses a big Copilot bash output', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'chisle-copilot-'));
  const saved = process.env.COPILOT_HOME;
  process.env.COPILOT_HOME = dir;
  try {
    const out = processPayload(copilotPayload(), 'on');
    assert.ok(out && out.includes('[chisle: elided'));
  } finally {
    if (saved !== undefined) process.env.COPILOT_HOME = saved; else delete process.env.COPILOT_HOME;
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('processPayload passes small Copilot outputs through (null)', () => {
  const out = processPayload(copilotPayload({ toolResult: { resultType: 'success', textResultForLlm: 'tiny' } }), 'on');
  assert.equal(out, null);
});

test('processPayload never touches view/create/edit for Copilot', () => {
  const out = processPayload(copilotPayload({ toolName: 'view' }), 'on');
  assert.equal(out, null);
});

test('Copilot dedup: identical consecutive output becomes a marker, isolated per state dir', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'chisle-copilot-dedup-'));
  const saved = process.env.COPILOT_HOME;
  process.env.COPILOT_HOME = dir;
  try {
    const payload = copilotPayload({
      toolResult: { resultType: 'success', textResultForLlm: 'FAIL test_x\n' + 'ctx '.repeat(1000) },
    });
    const first = processPayload(payload, 'on');
    const second = processPayload(payload, 'on');
    assert.ok(second && second.includes('byte-identical to the previous bash result'));
    assert.notDeepEqual(first, second);

    // New session must not dedup against the old one.
    const newSession = processPayload({ ...payload, sessionId: 'copilot-sess-2' }, 'on');
    assert.ok(newSession == null || !newSession.includes('byte-identical'));
  } finally {
    if (saved !== undefined) process.env.COPILOT_HOME = saved; else delete process.env.COPILOT_HOME;
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('Copilot dedup is skipped silently when sessionId is absent', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'chisle-copilot-nosess-'));
  const saved = process.env.COPILOT_HOME;
  process.env.COPILOT_HOME = dir;
  try {
    const payload = copilotPayload({ sessionId: undefined, toolResult: { resultType: 'success', textResultForLlm: 'z '.repeat(2000) } });
    delete payload.sessionId;
    const first = processPayload(payload, 'on');
    const second = processPayload(payload, 'on');
    assert.ok(first == null || !first.includes('byte-identical'));
    assert.ok(second == null || !second.includes('byte-identical'));
  } finally {
    if (saved !== undefined) process.env.COPILOT_HOME = saved; else delete process.env.COPILOT_HOME;
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('CHISLE_COMPRESS=0 kill switch also applies to the Copilot branch', () => {
  process.env.CHISLE_COMPRESS = '0';
  assert.equal(processPayload(copilotPayload(), 'on'), null);
  delete process.env.CHISLE_COMPRESS;
});

// ── main() end-to-end: Copilot's own modifiedResult output shape ────────────
// The only way to exercise main()'s mode-selection (always 'on' for a
// Copilot-shaped payload, no flag-file read) and its
// { modifiedResult: { textResultForLlm } } output builder is to run the
// script as Copilot CLI itself would: JSON on stdin, JSON on stdout.

test('main(): Copilot payload on stdin produces modifiedResult on stdout', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'chisle-copilot-main-'));
  try {
    const scriptPath = path.join(__dirname, '..', 'hooks', 'chisle-compress-output.js');
    const payload = copilotPayload();
    const r = spawnSync(process.execPath, [scriptPath], {
      input: JSON.stringify(payload),
      encoding: 'utf8',
      env: Object.assign({}, process.env, { COPILOT_HOME: dir }),
    });
    assert.equal(r.status, 0);
    const out = JSON.parse(r.stdout);
    assert.equal(out.modifiedResult.resultType, 'success');
    assert.ok(out.modifiedResult.textResultForLlm.includes('[chisle: elided'));
    assert.equal(out.hookSpecificOutput, undefined); // never the Claude/Pi shape
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('main(): small Copilot output produces no stdout at all', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'chisle-copilot-main-noop-'));
  try {
    const scriptPath = path.join(__dirname, '..', 'hooks', 'chisle-compress-output.js');
    const payload = copilotPayload({ toolResult: { resultType: 'success', textResultForLlm: 'tiny' } });
    const r = spawnSync(process.execPath, [scriptPath], {
      input: JSON.stringify(payload),
      encoding: 'utf8',
      env: Object.assign({}, process.env, { COPILOT_HOME: dir }),
    });
    assert.equal(r.status, 0);
    assert.equal(r.stdout, '');
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('main(): a failed tool call keeps its resultType through compression', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'chisle-copilot-main-err-'));
  try {
    const scriptPath = path.join(__dirname, '..', 'hooks', 'chisle-compress-output.js');
    const payload = copilotPayload({
      toolResult: { resultType: 'error', textResultForLlm: bigOutput(500) },
    });
    const r = spawnSync(process.execPath, [scriptPath], {
      input: JSON.stringify(payload),
      encoding: 'utf8',
      env: Object.assign({}, process.env, { COPILOT_HOME: dir }),
    });
    assert.equal(r.status, 0);
    const out = JSON.parse(r.stdout);
    assert.equal(out.modifiedResult.resultType, 'error'); // not relabeled 'success'
    assert.ok(out.modifiedResult.textResultForLlm.includes('[chisle: elided'));
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
