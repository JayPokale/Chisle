#!/usr/bin/env node
// Tool-output compressor tests — correctness guardrails and never-crash.
// Run: node --test tests/test_compress.js

const { test } = require('node:test');
const assert = require('node:assert/strict');

const {
  extractText, rebuildResponse, scrub, compress, transform, limitsFor, toolAllowed, processPayload, THRESHOLDS,
} = require('../hooks/chisle-compress-output');

const FULL = THRESHOLDS;

function bigOutput(lines, prefix) {
  return Array.from({ length: lines }, (_, i) => `${prefix || 'line'} ${i} ${'x'.repeat(80)}`).join('\n');
}

// ── extractText ──────────────────────────────────────────────────────────────

test('extractText handles string, object, and array shapes', () => {
  assert.equal(extractText('plain'), 'plain');
  assert.equal(extractText({ stdout: 'out', stderr: 'err' }), 'out\nerr');
  assert.equal(extractText([{ type: 'text', text: 'a' }, { type: 'text', text: 'b' }]), 'a\nb');
  assert.equal(extractText(null), null);
});

// ── compress ─────────────────────────────────────────────────────────────────

test('compress keeps head and tail, elides middle', () => {
  const text = bigOutput(500);
  const out = compress(text, FULL);
  assert.ok(out.length < text.length);
  assert.ok(out.startsWith('line 0 '));
  assert.ok(out.trimEnd().endsWith('x'.repeat(80)));
  assert.ok(out.includes('line 499 '));         // tail survived
  assert.ok(out.includes('[chisle: elided'));      // marker present
  assert.ok(!out.includes('line 250 '));        // middle gone
});

test('compress salvages error lines from the elided middle', () => {
  const lines = bigOutput(500).split('\n');
  lines[250] = 'FATAL ERROR: connection refused at db.js:42';
  const out = compress(lines.join('\n'), FULL);
  assert.ok(out.includes('FATAL ERROR: connection refused at db.js:42'));
  assert.ok(out.includes('error-like line(s) below'));
});

test('compress hard-cuts a single giant line by chars', () => {
  const text = 'y'.repeat(50000);
  const out = compress(text, FULL);
  assert.ok(out.length < text.length);
  assert.ok(out.includes('elided'));
});

test('compress returns null when no win', () => {
  assert.equal(compress('short', FULL), null);
});

// ── scrub (lossless tier) ────────────────────────────────────────────────────

test('scrub strips ANSI escapes', () => {
  const out = scrub('\x1b[31mFAIL\x1b[0m test_foo\n\x1b]0;title\x07plain');
  assert.equal(out, 'FAIL test_foo\nplain');
});

test('scrub collapses identical consecutive lines', () => {
  const out = scrub(Array(10).fill('WARN: retrying connection').join('\n'));
  assert.ok(out.includes('WARN: retrying connection'));
  assert.ok(out.includes('[chisle: line repeated 10×]'));
  assert.equal(out.split('\n').length, 2);
});

test('scrub keeps short repeats and blank structure', () => {
  const src = 'a\na\na\n\nb';               // 3 repeats < threshold of 4
  assert.equal(scrub(src), src);
  assert.equal(scrub('x\n\n\n\n\ny'), 'x\n\ny');  // blank run → one blank
});

test('transform scrubs medium outputs below the elision threshold', () => {
  const noisy = Array(50).fill('\x1b[32m✓\x1b[0m ok').join('\n') + '\n' + 'tail '.repeat(300);
  assert.ok(noisy.length < THRESHOLDS.maxChars);
  const out = transform(noisy, THRESHOLDS);
  assert.ok(out && out.length < noisy.length);
  assert.ok(!out.includes('\x1b['));
});

test('transform returns null when the win is trivial', () => {
  const clean = 'z'.repeat(2000);            // nothing to scrub, under maxChars
  assert.equal(transform(clean, THRESHOLDS), null);
});

test('transform still elides oversized outputs after scrubbing', () => {
  const out = transform(bigOutput(500), THRESHOLDS);
  assert.ok(out.includes('[chisle: elided'));
});

// ── dedup ────────────────────────────────────────────────────────────────────

test('identical consecutive tool output becomes a marker (isolated config dir)', () => {
  const dir = require('fs').mkdtempSync(require('path').join(require('os').tmpdir(), 'chisle-dedup-'));
  const saved = process.env.CLAUDE_CONFIG_DIR;
  process.env.CLAUDE_CONFIG_DIR = dir;
  try {
    const payload = { tool_name: 'Bash', session_id: 'sess-1', tool_response: 'FAIL test_x\n' + 'ctx '.repeat(1000) };
    const first = processPayload(payload, 'on');
    const second = processPayload(payload, 'on');
    assert.ok(second && second.includes('byte-identical to the previous Bash result'));
    assert.ok(second.includes('FAIL test_x'));          // first lines kept
    assert.notDeepEqual(first, second);                  // only the repeat is deduped
    const third = processPayload({ tool_name: 'Bash', session_id: 'sess-1', tool_response: 'different '.repeat(300) }, 'on');
    assert.ok(third == null || !third.includes('byte-identical'));
    // New session must NOT dedup against the old one — the earlier copy is
    // not in the new session's context.
    const newSession = processPayload({ ...payload, session_id: 'sess-2' }, 'on');
    assert.ok(newSession == null || !newSession.includes('byte-identical'));
    // No session_id (portability unknowns) → dedup skipped entirely.
    const noSess = processPayload({ tool_name: 'Bash', tool_response: payload.tool_response }, 'on');
    assert.ok(noSess == null || !noSess.includes('byte-identical'));
  } finally {
    if (saved !== undefined) process.env.CLAUDE_CONFIG_DIR = saved;
    else delete process.env.CLAUDE_CONFIG_DIR;
    require('fs').rmSync(dir, { recursive: true, force: true });
  }
});

test('REGRESSION: two hook copies on ONE tool call must not dedup each other', () => {
  const dir = require('fs').mkdtempSync(require('path').join(require('os').tmpdir(), 'chisle-dupreg-'));
  const saved = process.env.CLAUDE_CONFIG_DIR;
  process.env.CLAUDE_CONFIG_DIR = dir;
  try {
    const call = {
      tool_name: 'Bash', session_id: 'sess-1', tool_use_id: 'toolu_01AAA',
      tool_response: 'line one never seen before\n' + 'payload '.repeat(400),
    };
    const copyA = processPayload(call, 'on');   // plugin-manifest registration
    const copyB = processPayload(call, 'on');   // settings.json registration
    assert.ok(copyA == null || !copyA.includes('byte-identical'));
    assert.ok(copyB == null || !copyB.includes('byte-identical'),
      'second registration falsely deduped a first-seen output');

    // A genuine re-run of the same command is a different tool call, so the
    // real dedup must still fire.
    const rerun = processPayload({ ...call, tool_use_id: 'toolu_02BBB' }, 'on');
    assert.ok(rerun && rerun.includes('byte-identical to the previous Bash result'));
  } finally {
    if (saved !== undefined) process.env.CLAUDE_CONFIG_DIR = saved;
    else delete process.env.CLAUDE_CONFIG_DIR;
    require('fs').rmSync(dir, { recursive: true, force: true });
  }
});

// ── limitsFor ────────────────────────────────────────────────────────────────

test('one threshold set, no levels', () => {
  assert.equal(limitsFor().maxChars, THRESHOLDS.maxChars);
  assert.equal(limitsFor().headLines, THRESHOLDS.headLines);
  assert.equal(limitsFor().tailLines, THRESHOLDS.tailLines);
});

test('env vars override thresholds', () => {
  process.env.CHISLE_COMPRESS_MAX_CHARS = '1234';
  assert.equal(limitsFor().maxChars, 1234);
  delete process.env.CHISLE_COMPRESS_MAX_CHARS;
});

// ── toolAllowed — the correctness allowlist ──────────────────────────────────

test('Read/Edit/Write are NEVER compressed (Edit old_string correctness)', () => {
  assert.equal(toolAllowed('Read'), false);
  assert.equal(toolAllowed('Edit'), false);
  assert.equal(toolAllowed('Write'), false);
  assert.equal(toolAllowed('NotebookEdit'), false);
});

test('Bash, Agent, mcp__ tools are compressible', () => {
  assert.equal(toolAllowed('Bash'), true);
  assert.equal(toolAllowed('Agent'), true);
  assert.equal(toolAllowed('mcp__tokensave__tokensave_read'), true);
});

test('CHISLE_COMPRESS_TOOLS overrides the allowlist', () => {
  process.env.CHISLE_COMPRESS_TOOLS = 'Grep';
  assert.equal(toolAllowed('Bash'), false);
  assert.equal(toolAllowed('Grep'), true);
  assert.equal(toolAllowed('mcp__x__y'), false); // override disables mcp__ default
  delete process.env.CHISLE_COMPRESS_TOOLS;
});

// ── processPayload — full pipeline ───────────────────────────────────────────

test('processPayload compresses a big Bash output', () => {
  const out = processPayload({ tool_name: 'Bash', tool_response: { stdout: bigOutput(500) } }, 'on');
  assert.ok(out && out.includes('[chisle: elided'));
});

test('processPayload passes small outputs through (null)', () => {
  assert.equal(processPayload({ tool_name: 'Bash', tool_response: 'tiny' }, 'on'), null);
});

test('processPayload does nothing when mode is off or missing', () => {
  const payload = { tool_name: 'Bash', tool_response: bigOutput(500) };
  assert.equal(processPayload(payload, 'off'), null);
  assert.equal(processPayload(payload, null), null);
});

test('CHISLE_COMPRESS=0 is a kill switch', () => {
  process.env.CHISLE_COMPRESS = '0';
  assert.equal(processPayload({ tool_name: 'Bash', tool_response: bigOutput(500) }, 'on'), null);
  delete process.env.CHISLE_COMPRESS;
});

test('processPayload never throws on garbage', () => {
  assert.equal(processPayload(null, 'on'), null);
  assert.equal(processPayload({}, 'on'), null);
  assert.equal(processPayload({ tool_name: 'Bash' }, 'on'), null);
  assert.equal(processPayload({ tool_name: 'Bash', tool_response: 12345 }, 'on'), null);
});

// ── rebuildResponse: the replacement must match the tool's output shape ──────
// Regression guard for #3 (@sovdchains): emitting a bare string for an
// object-shaped tool made Claude Code reject every replacement, so the
// compressor silently did nothing while still logging savings.

test('REGRESSION #3: object-shaped response stays an object', () => {
  const res = { stdout: 'original', stderr: '', interrupted: false };
  const out = rebuildResponse(res, 'compressed');
  assert.equal(typeof out, 'object');
  assert.equal(out.stdout, 'compressed');
  // untouched fields survive, or the harness rejects on the schema again
  assert.equal(out.interrupted, false);
});

test('REGRESSION #3: stderr is blanked so it is not duplicated', () => {
  // extractText folds stderr into the compressed text; leaving it would repeat it
  const out = rebuildResponse({ stdout: 'a', stderr: 'boom' }, 'a\nboom');
  assert.equal(out.stdout, 'a\nboom');
  assert.equal(out.stderr, '');
});

test('string-shaped response stays a string', () => {
  assert.equal(rebuildResponse('original', 'compressed'), 'compressed');
  assert.equal(rebuildResponse(null, 'compressed'), 'compressed');
});

test('alternative string carriers are found', () => {
  assert.equal(rebuildResponse({ output: 'x' }, 'c').output, 'c');
  assert.equal(rebuildResponse({ result: 'x' }, 'c').result, 'c');
  assert.equal(rebuildResponse({ text: 'x' }, 'c').text, 'c');
});

test('unknown shapes are skipped, never guessed', () => {
  // a wrong guess is silently rejected by the harness — the bug we are fixing
  assert.equal(rebuildResponse([{ type: 'text', text: 'x' }], 'c'), null);
  assert.equal(rebuildResponse({ content: [{ text: 'x' }] }, 'c'), null);
  assert.equal(rebuildResponse({ nothing: 1 }, 'c'), null);
});
