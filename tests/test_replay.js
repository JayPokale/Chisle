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
  assert.match(result, /per-tool breakdown:/);
  assert.match(result, /bash\s+\d+ outputs\s+[\d,]+ → [\d,]+ chars\s+saved [\d,]+ chars/);
  assert.doesNotMatch(
    result.match(/per-tool breakdown:\n([\s\S]*?)(?:\noutputs with error lines salvaged|$)/)?.[1] || '',
    /read/
  );

  fs.rmSync(dir, { recursive: true, force: true });
});

test('Claude replay never counts a failed tool call as compressible', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'chisle-claude-replay-'));
  const use = (id) => ({ message: { role: 'assistant', content: [{ type: 'tool_use', id, name: 'Bash', input: {} }] } });
  const result = (id, isError) => ({ message: { role: 'user', content: [
    { type: 'tool_result', tool_use_id: id, is_error: isError, content: output(500) },
  ] } });
  fs.writeFileSync(path.join(dir, 'session.jsonl'),
    [use('ok'), result('ok', false), use('bad'), result('bad', true)].map(JSON.stringify).join('\n'));

  const out = execFileSync(process.execPath, [REPLAY, 'claude', dir], { encoding: 'utf8' });
  assert.match(out, /tool_results scanned:\s+2/);
  assert.match(out, /scrubbed\/elided outputs:\s+1 /);
  assert.match(out, /big failed outputs, unreachable: 1 /);

  fs.rmSync(dir, { recursive: true, force: true });
});

test('Claude replay reports per-tool compression savings', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'chisle-claude-breakdown-'));

  const use = (id, name) => ({
    message: {
      role: 'assistant',
      content: [{ type: 'tool_use', id, name, input: {} }],
    },
  });

  const result = (id) => ({
    message: {
      role: 'user',
      content: [{
        type: 'tool_result',
        tool_use_id: id,
        is_error: false,
        content: output(500),
      }],
    },
  });

  fs.writeFileSync(path.join(dir, 'session.jsonl'), [
    use('bash-1', 'Bash'),
    result('bash-1'),
    use('grep-1', 'Grep'),
    result('grep-1'),
  ].map(JSON.stringify).join('\n'));

  const out = execFileSync(
    process.execPath,
    [REPLAY, 'claude', dir],
    { encoding: 'utf8' }
  );

  assert.match(out, /per-tool breakdown:/);
  assert.match(out, /Bash\s+\d+ outputs\s+[\d,]+ → [\d,]+ chars\s+saved [\d,]+ chars/);
  assert.match(out, /Grep\s+\d+ outputs\s+[\d,]+ → [\d,]+ chars\s+saved [\d,]+ chars/);

  fs.rmSync(dir, { recursive: true, force: true });
});
