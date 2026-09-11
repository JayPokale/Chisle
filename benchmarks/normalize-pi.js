#!/usr/bin/env node
// Convert Pi's raw JSONL event stream to aggregate.js's existing cell schema.

const fs = require('node:fs');

const file = process.argv[2];
if (!file) {
  process.stderr.write('usage: node benchmarks/normalize-pi.js <events.jsonl>\n');
  process.exit(2);
}

let outputTokens = 0;
let result = '';
let isError = false;
for (const line of fs.readFileSync(file, 'utf8').split('\n')) {
  if (!line) continue;
  let event; try { event = JSON.parse(line); } catch (_) { continue; }
  if (event.type !== 'message_end' || !event.message || event.message.role !== 'assistant') continue;
  const message = event.message;
  outputTokens += message.usage && Number.isFinite(message.usage.output) ? message.usage.output : 0;
  result = Array.isArray(message.content)
    ? message.content.filter(block => block.type === 'text').map(block => block.text || '').join('\n')
    : String(message.content || '');
  isError ||= message.stopReason === 'error';
}

process.stdout.write(JSON.stringify({
  harness: 'pi',
  is_error: isError || !result,
  result,
  usage: { output_tokens: outputTokens },
}, null, 2) + '\n');
