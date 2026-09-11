#!/usr/bin/env node
// Deterministic replay benchmark for Chisle's tool-output compressor.
//
// Usage:
//   node benchmarks/replay-compress.js                 # Claude Code sessions
//   node benchmarks/replay-compress.js pi              # Pi sessions
//   node benchmarks/replay-compress.js pi /path/to/sessions

const fs = require('fs');
const path = require('path');
const os = require('os');
const crypto = require('crypto');
const {
  duplicateMarker, extractText, transform, limitsFor, toolAllowed,
} = require('../hooks/chisle-compress-output');
const { piToolAllowed } = require('../pi-extension');

const args = process.argv.slice(2);
const harness = ['claude', 'pi'].includes(args[0]) ? args.shift() : 'claude';
const limits = limitsFor();
const root = args[0] || (harness === 'pi'
  ? process.env.PI_CODING_AGENT_SESSION_DIR || path.join(
    process.env.PI_CODING_AGENT_DIR || path.join(os.homedir(), '.pi', 'agent'), 'sessions')
  : path.join(process.env.CLAUDE_CONFIG_DIR || path.join(os.homedir(), '.claude'), 'projects'));
const allowed = harness === 'pi' ? piToolAllowed : toolAllowed;

let sessionChars = 0;
const totals = {
  results: 0, chars: 0, eligible: 0, before: 0, after: 0, salvaged: 0,
  dedup: 0, dedupChars: 0,
};
const skippedByTool = {};

function walk(dir) {
  let entries;
  try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch (_) { return; }
  for (const entry of entries) {
    const file = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(file);
    else if (entry.name.endsWith('.jsonl')) scan(file);
  }
}

function contentChars(content) {
  if (typeof content === 'string') return content.length;
  if (!Array.isArray(content)) return 0;
  return content.reduce((sum, block) => sum + (block && block.type === 'text' ? (block.text || '').length : 0), 0);
}

function account(name, text, lastHash, allowDedup) {
  const size = text ? text.length : 0;
  sessionChars += size;
  totals.results++;
  totals.chars += size;
  if (!text) return;
  if (!allowed(name)) {
    if (size > limits.maxChars) skippedByTool[name] = (skippedByTool[name] || 0) + size;
    return;
  }

  if (allowDedup && process.env.CHISLE_COMPRESS_DEDUP !== '0' && size >= 2048) {
    const hash = crypto.createHash('sha256').update(text).digest('hex');
    if (lastHash[name] === hash) {
      const marker = duplicateMarker(name, text);
      totals.dedup++;
      totals.dedupChars += size - marker.length;
      return;
    }
    lastHash[name] = hash;
  }

  const output = transform(text, limits);
  if (output == null) return;
  totals.eligible++;
  totals.before += size;
  totals.after += output.length;
  if (output.includes('error-like line(s) below')) totals.salvaged++;
}

function scan(file) {
  let lines;
  try { lines = fs.readFileSync(file, 'utf8').split('\n'); } catch (_) { return; }
  if (harness === 'pi') return scanPi(lines);
  scanClaude(lines);
}

function scanClaude(lines) {
  const idName = {};
  const lastHash = {};
  for (const line of lines) {
    if (!line) continue;
    let entry; try { entry = JSON.parse(line); } catch (_) { continue; }
    const message = entry.message;
    if (!message || !message.content) continue;
    if (typeof message.content === 'string') { sessionChars += message.content.length; continue; }
    if (!Array.isArray(message.content)) continue;
    for (const block of message.content) {
      if (block.type === 'text') sessionChars += (block.text || '').length;
      else if (block.type === 'tool_use') idName[block.id] = block.name;
      else if (block.type === 'tool_result') {
        account(idName[block.tool_use_id] || '?', extractText(block.content), lastHash, true);
      }
    }
  }
}

function scanPi(lines) {
  for (const line of lines) {
    if (!line) continue;
    let entry; try { entry = JSON.parse(line); } catch (_) { continue; }
    if (entry.type === 'custom_message') {
      sessionChars += contentChars(entry.content);
      continue;
    }
    if (entry.type === 'compaction' || entry.type === 'branch_summary') {
      sessionChars += String(entry.summary || '').length;
      continue;
    }
    if (entry.type !== 'message' || !entry.message) continue;
    const message = entry.message;
    if (message.role === 'toolResult') {
      // Stored Pi content is already capped at 50KB/2000 lines. Savings here
      // are marginal over that native truncation. Dedup stays excluded because
      // JSONL source order cannot reconstruct parallel tool completion order.
      account(message.toolName || '?', extractText(message.content), {}, false);
    } else {
      sessionChars += contentChars(message.content);
    }
  }
}

walk(root);

const saved = totals.before - totals.after + totals.dedupChars;
const pct = (a, b) => b ? (100 * a / b).toFixed(1) + '%' : 'n/a';
console.log(`chisle-compress replay (${harness}) — maxChars=${limits.maxChars}, head=${limits.headLines}, tail=${limits.tailLines}`);
console.log(`transcript root: ${root}`);
if (harness === 'pi') console.log('baseline: persisted Pi output after native 50KB/2000-line truncation (marginal savings)');
console.log('');
console.log(`tool_results scanned:        ${totals.results.toLocaleString('en-US')}  (${totals.chars.toLocaleString('en-US')} chars)`);
console.log(`scrubbed/elided outputs:     ${totals.eligible.toLocaleString('en-US')}  (${totals.before.toLocaleString('en-US')} → ${totals.after.toLocaleString('en-US')} chars)`);
console.log(`deduped repeat outputs:      ${totals.dedup.toLocaleString('en-US')}  (${totals.dedupChars.toLocaleString('en-US')} chars)`);
console.log(`saved:                       ${saved.toLocaleString('en-US')} chars (~${Math.round(saved / 4).toLocaleString('en-US')} tokens)`);
console.log(`  = ${pct(saved, totals.chars)} of all tool output, ${pct(saved, sessionChars)} of all session content`);
console.log(`outputs with error lines salvaged from the cut: ${totals.salvaged}`);
const skipped = Object.entries(skippedByTool).sort((a, b) => b[1] - a[1]);
if (skipped.length) {
  console.log('\nbig outputs NOT touched (correctness allowlist):');
  for (const [name, chars] of skipped) console.log(`  ${name.padEnd(20)} ${chars.toLocaleString('en-US')} chars`);
}
