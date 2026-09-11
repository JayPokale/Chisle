#!/usr/bin/env node

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

const REPLAY = path.join(__dirname, '..', 'benchmarks', 'replay-compress.js');
const NORMALIZE = path.join(__dirname, '..', 'benchmarks', 'normalize-pi.js');

function output(lines) {
  return Array.from({ length: lines }, (_, i) => `line ${i} ${'x'.repeat(80)}`).join('\n');
}

test('Pi live JSONL normalizes to the existing benchmark cell schema', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'chisle-pi-live-'));
  const file = path.join(dir, 'events.jsonl');
  fs.writeFileSync(file, [
    JSON.stringify({ type: 'session', version: 3 }),
    JSON.stringify({ type: 'message_end', message: {
      role: 'assistant', content: [{ type: 'text', text: 'answer' }],
      usage: { output: 42 }, stopReason: 'stop',
    } }),
  ].join('\n'));

  const result = JSON.parse(execFileSync(process.execPath, [NORMALIZE, file], { encoding: 'utf8' }));
  assert.deepEqual(result, {
    harness: 'pi', is_error: false, result: 'answer', usage: { output_tokens: 42 },
  });
  fs.rmSync(dir, { recursive: true, force: true });
});

test('Pi replay reads toolResult messages and reports marginal post-truncation savings', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'chisle-pi-replay-'));
  const entries = [
    { type: 'session', version: 3, id: 'session', cwd: '/tmp' },
    { type: 'message', id: '1', parentId: null, message: {
      role: 'toolResult', toolName: 'bash', toolCallId: 'call-1',
      content: [{ type: 'text', text: output(500) }], isError: false,
    } },
    { type: 'message', id: '2', parentId: '1', message: {
      role: 'toolResult', toolName: 'read', toolCallId: 'call-2',
      content: [{ type: 'text', text: output(500) }], isError: false,
    } },
  ];
  fs.writeFileSync(path.join(dir, 'session.jsonl'), entries.map(JSON.stringify).join('\n'));

  const result = execFileSync(process.execPath, [REPLAY, 'pi', dir], { encoding: 'utf8' });
  assert.match(result, /replay \(pi\)/);
  assert.match(result, /marginal savings/);
  assert.match(result, /tool_results scanned:\s+2/);
  assert.match(result, /read\s+[\d,]+ chars/);
  assert.doesNotMatch(result, /saved:\s+0 chars/);

  fs.rmSync(dir, { recursive: true, force: true });
});
