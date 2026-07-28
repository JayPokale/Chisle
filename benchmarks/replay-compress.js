#!/usr/bin/env node
// chisle — replay benchmark for the tool-output compressor (input axis).
//
// Feeds every tool_result in your local Claude Code transcripts through the
// SAME code the shipped hook runs (hooks/chisle-compress-output.js) and reports
// what it would have saved. Deterministic, zero LLM calls, zero network —
// reads ~/.claude/projects/**/*.jsonl and prints a table.
//
// Usage:
//   node benchmarks/replay-compress.js
//   node benchmarks/replay-compress.js ultra      # any of: lite full ultra

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { extractText, transform, limitsFor, toolAllowed } = require('../hooks/chisle-compress-output');

const limits = limitsFor();
const root = process.env.CLAUDE_CONFIG_DIR
  ? path.join(process.env.CLAUDE_CONFIG_DIR, 'projects')
  : path.join(require('os').homedir(), '.claude', 'projects');

let sessionChars = 0;                  // all message content (tool + text)
const t = { results: 0, chars: 0, eligible: 0, before: 0, after: 0, salvaged: 0,
            dedup: 0, dedupChars: 0 };
const skippedByTool = {};              // big outputs we refuse to touch (Read etc.)

function walk(d) {
  let entries;
  try { entries = fs.readdirSync(d, { withFileTypes: true }); } catch (e) { return; }
  for (const e of entries) {
    const p = path.join(d, e.name);
    if (e.isDirectory()) walk(p);
    else if (e.name.endsWith('.jsonl')) scan(p);
  }
}

function scan(f) {
  let lines;
  try { lines = fs.readFileSync(f, 'utf8').split('\n'); } catch (e) { return; }
  const idName = {};
  const lastHash = {};   // per-session, per-tool — mirrors the hook's dedup
  for (const l of lines) {
    if (!l) continue;
    let j; try { j = JSON.parse(l); } catch (e) { continue; }
    const m = j.message;
    if (!m || !m.content) continue;
    if (typeof m.content === 'string') { sessionChars += m.content.length; continue; }
    if (!Array.isArray(m.content)) continue;
    for (const b of m.content) {
      if (b.type === 'text') sessionChars += (b.text || '').length;
      else if (b.type === 'tool_use') idName[b.id] = b.name;
      else if (b.type === 'tool_result') {
        const text = extractText(b.content);
        const n = text ? text.length : 0;
        sessionChars += n; t.results++; t.chars += n;
        if (!text) continue;
        const name = idName[b.tool_use_id] || '?';
        if (!toolAllowed(name)) {
          if (n > limits.maxChars) skippedByTool[name] = (skippedByTool[name] || 0) + n;
          continue;
        }
        if (n >= 2048) {
          const h = crypto.createHash('sha256').update(text).digest('hex');
          if (lastHash[name] === h) { t.dedup++; t.dedupChars += n - 300; lastHash[name] = h; continue; }
          lastHash[name] = h;
        }
        const out = transform(text, limits);
        if (out == null) continue;
        t.eligible++; t.before += n; t.after += out.length;
        if (out.includes('error-like line(s) below')) t.salvaged++;
      }
    }
  }
}

walk(root);

const saved = t.before - t.after + t.dedupChars;
const pct = (a, b) => b ? (100 * a / b).toFixed(1) + '%' : 'n/a';
console.log(`chisle-compress replay — maxChars=${limits.maxChars}, head=${limits.headLines}, tail=${limits.tailLines}`);
console.log(`transcript root: ${root}\n`);
console.log(`tool_results scanned:        ${t.results.toLocaleString('en-US')}  (${t.chars.toLocaleString('en-US')} chars)`);
console.log(`scrubbed/elided outputs:     ${t.eligible.toLocaleString('en-US')}  (${t.before.toLocaleString('en-US')} → ${t.after.toLocaleString('en-US')} chars)`);
console.log(`deduped repeat outputs:      ${t.dedup.toLocaleString('en-US')}  (~${t.dedupChars.toLocaleString('en-US')} chars)`);
console.log(`saved:                       ${saved.toLocaleString('en-US')} chars (~${Math.round(saved / 4).toLocaleString('en-US')} tokens)`);
console.log(`  = ${pct(saved, t.chars)} of all tool output, ${pct(saved, sessionChars)} of all session content`);
console.log(`outputs with error lines salvaged from the cut: ${t.salvaged}`);
const skipped = Object.entries(skippedByTool).sort((a, b) => b[1] - a[1]);
if (skipped.length) {
  console.log(`\nbig outputs NOT touched (correctness allowlist):`);
  for (const [name, chars] of skipped) console.log(`  ${name.padEnd(20)} ${chars.toLocaleString('en-US')} chars`);
}
