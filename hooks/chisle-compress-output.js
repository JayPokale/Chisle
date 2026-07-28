#!/usr/bin/env node
// chisle — PostToolUse hook: tool-output compression (the input axis).
//
// Prompt-side rules shrink what the agent WRITES; this shrinks what it READS.
// Oversized tool results (Bash dumps, subagent reports, web fetches) get their
// repetitive middle elided — head kept (command context), tail kept (results/
// errors), error-looking lines salvaged from the cut — and the trimmed version
// replaces what the model sees via `updatedToolOutput`. Deterministic, zero
// LLM, zero network. Small outputs pass through untouched.
//
// Correctness guardrails (why this never touches Read/Edit/Write):
//   - Read output feeds later Edit old_string matching — eliding it makes the
//     model edit against text it never saw. Allowlist below, never a blocklist.
//   - Error lines in the elided middle are salvaged, capped, and kept verbatim.
//   - If compression doesn't shrink the output, the original is kept.
//   - Never throws: a broken hook must not break the tool pipeline.
//
// Two tiers, applied in order:
//   scrub  (output > 1k)  — lossless: strip ANSI escapes, collapse blank-line
//                           runs, collapse ≥4 identical consecutive lines to
//                           one + "[repeated N×]". No information lost.
//   elide  (output > threshold) — head + tail + error salvage, as above.
// Plus dedup: a tool output byte-identical to that tool's immediately previous
// output is replaced by a short marker — the content is already in context.
//
// Compression follows the /chisle flag (off → untouched). Tunables via env:
//   CHISLE_COMPRESS=0                 — kill switch
//   CHISLE_COMPRESS_SCRUB=0           — disable the lossless scrub tier
//   CHISLE_COMPRESS_DEDUP=0           — disable duplicate-output markers
//   CHISLE_COMPRESS_MAX_CHARS         — outputs at/under this size are not elided
//   CHISLE_COMPRESS_HEAD_LINES        — lines kept from the top
//   CHISLE_COMPRESS_TAIL_LINES        — lines kept from the bottom
//   CHISLE_COMPRESS_TOOLS=Bash,Grep   — override the tool allowlist
//
// Savings accrue in <claudeDir>/.chisle-compress-stats.json for the statusline.

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { getClaudeDir, readFlag } = require('./chisle-config');

// One threshold. Env overrides all.
// These are the values the old 'full' level used — the default,
// and the only one the published benchmarks ever ran at.
const THRESHOLDS = { maxChars: 8000, headLines: 60, tailLines: 40 };

// Tools whose output is safe to elide. Read/Edit/Write are absent on purpose:
// their output feeds exact-match edits. mcp__* are read-only info tools.
const SAFE_TOOLS = ['Bash', 'Agent', 'WebFetch', 'WebSearch', 'Grep', 'Glob'];
const SALVAGE_RE = /\b(error|err!|fail(ed|ure|ing)?|exception|traceback|panic|fatal|denied|refused|timed?[ _-]?out|assert(ion)?|segfault|npe|undefined reference|cannot find|not found|warning)\b/i;
const MAX_SALVAGED = 12;      // error lines rescued from the elided middle
const MAX_SALVAGE_LINE = 300; // per-line char cap on salvaged lines

function toolAllowed(name) {
  if (!name || typeof name !== 'string') return false;
  const list = process.env.CHISLE_COMPRESS_TOOLS
    ? process.env.CHISLE_COMPRESS_TOOLS.split(',').map(s => s.trim()).filter(Boolean)
    : SAFE_TOOLS;
  return list.includes(name) || (!process.env.CHISLE_COMPRESS_TOOLS && name.startsWith('mcp__'));
}

function envInt(name, fallback) {
  const n = parseInt(process.env[name], 10);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

function limitsFor() {
  const base = THRESHOLDS;
  return {
    maxChars: envInt('CHISLE_COMPRESS_MAX_CHARS', base.maxChars),
    headLines: envInt('CHISLE_COMPRESS_HEAD_LINES', base.headLines),
    tailLines: envInt('CHISLE_COMPRESS_TAIL_LINES', base.tailLines),
  };
}

// Pull a plain-text payload out of tool_response, whatever its shape.
function extractText(response) {
  if (response == null) return null;
  if (typeof response === 'string') return response;
  if (Array.isArray(response)) {
    const parts = response.map(b => (b && typeof b.text === 'string') ? b.text : extractText(b && b.content)).filter(Boolean);
    return parts.length ? parts.join('\n') : null;
  }
  if (typeof response === 'object') {
    const parts = [];
    for (const key of ['stdout', 'stderr', 'output', 'content', 'text', 'result']) {
      const val = response[key];
      if (typeof val === 'string' && val) parts.push(val);
      else if (val && typeof val === 'object') { const t = extractText(val); if (t) parts.push(t); }
    }
    if (parts.length) return parts.join('\n');
    try { return JSON.stringify(response); } catch (e) { return null; }
  }
  return String(response);
}

// ── Tier 1: lossless scrub ───────────────────────────────────────────────────
// ANSI/OSC escapes are invisible to the model; blank runs and identical
// consecutive lines carry their information in one copy.
const ANSI_RE = /\x1b\[[0-9;?]*[ -/]*[@-~]|\x1b\][^\x07\x1b]*(?:\x07|\x1b\\)/g;
const SCRUB_MIN = 1024;      // below this, not worth a hook round-trip
const REPEAT_MIN = 4;        // identical consecutive lines before collapsing
const MIN_WIN = 64;          // emit updated output only if it saves this much

function scrub(text) {
  let t = text.replace(ANSI_RE, '');
  t = t.replace(/[ \t]+$/gm, '');            // trailing whitespace
  t = t.replace(/\n{3,}/g, '\n\n');          // blank-line runs → one blank
  // Collapse runs of identical non-empty lines.
  const lines = t.split('\n');
  const out = [];
  for (let i = 0; i < lines.length; ) {
    let j = i;
    while (j < lines.length && lines[j] === lines[i]) j++;
    const n = j - i;
    if (n >= REPEAT_MIN && lines[i].trim()) {
      out.push(lines[i], `... [chisle: line repeated ${n}×] ...`);
    } else {
      for (let k = 0; k < n; k++) out.push(lines[i]);
    }
    i = j;
  }
  return out.join('\n');
}

// ── Dedup: identical to this tool's previous output ─────────────────────────
// The identical content is already in context verbatim, so a marker loses
// nothing — but ONLY within the same session: a fresh session's context does
// not contain the earlier copy, so state is keyed by session_id and dedup is
// skipped when the payload carries none.
const DEDUP_MIN = 2048;

function dedupCheck(toolName, text, sessionId) {
  if (process.env.CHISLE_COMPRESS_DEDUP === '0') return null;
  if (!sessionId || typeof sessionId !== 'string') return null;
  if (text.length < DEDUP_MIN) return null;
  try {
    const p = path.join(getClaudeDir(), '.chisle-compress-last.json');
    try { if (fs.lstatSync(p).isSymbolicLink()) return null; } catch (e) { if (e.code !== 'ENOENT') return null; }
    let state = {};
    try { state = JSON.parse(fs.readFileSync(p, 'utf8')) || {}; } catch (e) {}
    if (state.session !== sessionId) state = { session: sessionId, tools: {} };
    if (!state.tools || typeof state.tools !== 'object') state.tools = {};
    const hash = crypto.createHash('sha256').update(text).digest('hex');
    const dup = state.tools[toolName] === hash;
    state.tools[toolName] = hash;
    const tmp = p + '.' + process.pid + '.tmp';
    fs.writeFileSync(tmp, JSON.stringify(state), { mode: 0o600 });
    fs.renameSync(tmp, p);
    if (!dup) return null;
    const lines = text.split('\n');
    const preview = lines.slice(0, 5)
      .map(l => l.length > MAX_SALVAGE_LINE ? l.slice(0, MAX_SALVAGE_LINE) + '…' : l);
    return '[chisle: output byte-identical to the previous ' + toolName + ' result — ' +
      text.length.toLocaleString('en-US') + ' chars / ' + lines.length +
      ' lines, unchanged. First lines:]\n' + preview.join('\n');
  } catch (e) { return null; }
}

// ── Tier 2: elision ──────────────────────────────────────────────────────────
// Keep head + tail; salvage error-looking lines from the elided middle so the
// one line that mattered in a 3000-line build log survives the cut.
function compress(text, limits) {
  const { maxChars, headLines, tailLines } = limits;
  const lines = text.split('\n');

  if (lines.length <= headLines + tailLines) {
    // Big in bytes, few lines (one giant line) — hard char cut.
    const keep = Math.floor(maxChars / 2);
    const elided = text.length - 2 * keep;
    if (elided <= 0) return null;
    return text.slice(0, keep) +
      '\n... [chisle: elided ' + elided.toLocaleString('en-US') + ' chars from the middle] ...\n' +
      text.slice(-keep);
  }

  const head = lines.slice(0, headLines);
  const tail = lines.slice(-tailLines);
  const middle = lines.slice(headLines, lines.length - tailLines);

  const salvaged = [];
  for (const line of middle) {
    if (salvaged.length >= MAX_SALVAGED) break;
    if (SALVAGE_RE.test(line)) salvaged.push(line.length > MAX_SALVAGE_LINE ? line.slice(0, MAX_SALVAGE_LINE) + '…' : line);
  }

  const marker = '... [chisle: elided ' + middle.length.toLocaleString('en-US') +
    ' lines — kept first ' + headLines + ', last ' + tailLines +
    (salvaged.length ? ', and ' + salvaged.length + ' error-like line(s) below' : '') + '] ...';

  const out = head.concat([marker], salvaged, tail).join('\n');
  return out.length < text.length ? out : null;
}

// Best-effort savings ledger. Races between parallel tool calls can drop a
// count — stats only, never worth a lock file.
function recordSavings(saved) {
  try {
    const p = path.join(getClaudeDir(), '.chisle-compress-stats.json');
    try { if (fs.lstatSync(p).isSymbolicLink()) return; } catch (e) { if (e.code !== 'ENOENT') return; }
    let stats = { savedChars: 0, events: 0 };
    try {
      const parsed = JSON.parse(fs.readFileSync(p, 'utf8'));
      if (parsed && Number.isFinite(parsed.savedChars) && Number.isFinite(parsed.events)) stats = parsed;
    } catch (e) {}
    stats.savedChars += saved;
    stats.events += 1;
    const tmp = p + '.' + process.pid + '.tmp';
    fs.writeFileSync(tmp, JSON.stringify(stats), { mode: 0o600 });
    fs.renameSync(tmp, p);
  } catch (e) {}
}

// Scrub + elide on plain text → transformed text, or null if no meaningful
// win. Stateless — this is what the replay benchmark measures.
function transform(text, limits) {
  if (!text || text.length <= SCRUB_MIN) return null;
  let t = process.env.CHISLE_COMPRESS_SCRUB === '0' ? text : scrub(text);
  if (t.length > limits.maxChars) {
    const elided = compress(t, limits);
    if (elided != null) t = elided;
  }
  return text.length - t.length >= MIN_WIN ? t : null;
}

// Put the compressed text back into the ORIGINAL response shape.
//
// Claude Code validates updatedToolOutput against the tool's own output schema
// before applying it. Bash results are objects ({stdout, stderr, ...}), so
// handing back a bare string is rejected on every call — the hook appears to
// work, logs savings, and the model still receives the full output. Returning
// null (skip) is always safer than emitting a shape the harness will refuse.
// Reported with the transcript evidence by @sovdchains (#3).
function rebuildResponse(response, updated) {
  if (response == null || typeof response === 'string') return updated;
  if (typeof response === 'object' && !Array.isArray(response)) {
    for (const key of ['stdout', 'output', 'content', 'text', 'result']) {
      if (typeof response[key] === 'string') {
        const out = { ...response, [key]: updated };
        // extractText already folded stderr into the compressed text; leaving
        // the original stderr in place would duplicate it.
        if (key === 'stdout' && typeof response.stderr === 'string') out.stderr = '';
        return out;
      }
    }
  }
  // Unrecognized shape (e.g. MCP content-block arrays). Skip rather than guess:
  // a wrong shape is silently rejected, which is the bug this function fixes.
  return null;
}

// Full pipeline on one hook payload → updated output string, or null to keep
// the original. Pure given (payload, mode, env) except dedup state.
function processPayload(payload, mode) {
  if (!payload || typeof payload !== 'object') return null;
  if (!mode || mode === 'off') return null;
  if (process.env.CHISLE_COMPRESS === '0') return null;
  if (!toolAllowed(payload.tool_name)) return null;

  const text = extractText(payload.tool_response != null ? payload.tool_response : payload.tool_output);
  if (!text) return null;
  const dup = dedupCheck(payload.tool_name, text, payload.session_id);
  if (dup != null && dup.length < text.length) return dup;
  return transform(text, limitsFor());
}

function main() {
  let input = '';
  process.stdin.on('data', chunk => { input += chunk; });
  process.stdin.on('end', () => {
    try {
      const payload = JSON.parse(input.replace(/^﻿/, ''));
      const mode = readFlag(path.join(getClaudeDir(), '.chisle-active'));
      const updated = processPayload(payload, mode);
      if (updated == null) return;
      const response = payload.tool_response != null ? payload.tool_response : payload.tool_output;
      const rebuilt = rebuildResponse(response, updated);
      // Shape we can't safely rebuild — emit nothing and count nothing.
      if (rebuilt == null) return;
      const original = extractText(response);
      // Only after we know a replacement is actually going out, so the stats
      // file stops crediting savings the harness never applied.
      recordSavings(original.length - updated.length);
      process.stdout.write(JSON.stringify({
        hookSpecificOutput: {
          hookEventName: 'PostToolUse',
          updatedToolOutput: rebuilt,
        },
      }));
    } catch (e) {} // silent — never break the tool pipeline
  });
}

if (require.main === module) main();

module.exports = { extractText, rebuildResponse, scrub, compress, transform, limitsFor, toolAllowed, processPayload, THRESHOLDS, SAFE_TOOLS };
