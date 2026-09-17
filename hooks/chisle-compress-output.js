#!/usr/bin/env node
// chisle — PostToolUse hook: tool-output compression (the input axis).
//
// Prompt-side rules shrink what the agent WRITES; this shrinks what it READS.
// Oversized tool results (Bash dumps, subagent reports, web fetches) get their
// repetitive middle elided — head kept (command context), tail kept (results/
// errors), error-looking lines salvaged from the cut — and the trimmed version
// replaces what the model sees. Deterministic, zero LLM, zero network. Small
// outputs pass through untouched.
//
// Two harnesses call into this same core:
//   - Claude Code / Pi: `updatedToolOutput`, snake_case payload
//     (tool_name, tool_response, session_id, tool_use_id), gated behind the
//     /chisle on/off flag file (see chisle-config.js: getDefaultMode/readFlag).
//   - GitHub Copilot CLI: `modifiedResult.textResultForLlm`, camelCase flat
//     payload (toolName, toolResult.textResultForLlm, sessionId). Copilot has
//     no /chisle-equivalent mode toggle (no UserPromptSubmit-driven flag), so
//     compression is always-on for Copilot once the hook is installed —
//     exactly like the static ruleset Copilot already gets unconditionally
//     (see README: "the always-on ruleset still ships to every other agent").
//     CHISLE_COMPRESS=0 is still honored as the one kill switch for both.
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
// Compression follows the /chisle flag for Claude/Pi (off → untouched); it is
// unconditional for Copilot (see above). Tunables via env, shared across all
// three harnesses:
//   CHISLE_COMPRESS=0                 — kill switch
//   CHISLE_COMPRESS_SCRUB=0           — disable the lossless scrub tier
//   CHISLE_COMPRESS_DEDUP=0           — disable duplicate-output markers
//   CHISLE_COMPRESS_MAX_CHARS         — outputs at/under this size are not elided
//   CHISLE_COMPRESS_HEAD_LINES        — lines kept from the top
//   CHISLE_COMPRESS_TAIL_LINES        — lines kept from the bottom
//   CHISLE_COMPRESS_TOOLS=Bash,Grep   — override the tool allowlist (both harnesses)
//   CHISLE_COMPRESS_SPILL=0           — elide without writing the recovery copy
//
// Savings accrue in <stateDir>/.chisle-compress-stats.json for the statusline
// (Claude/Pi: <claudeDir>; Copilot: <copilotDir>, see chisle-config.js).
// Elided originals spill to <stateDir>/chisle-spill/ so the dropped middle can
// be grepped back instead of re-running the command; the newest 40 are kept.

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { getClaudeDir, getCopilotDir, getOpencodeDir, readFlag } = require('./chisle-config');

// One threshold. Env overrides all.
// These are the values the old 'full' level used — the default,
// and the only one the published benchmarks ever ran at.
const THRESHOLDS = { maxChars: 8000, headLines: 60, tailLines: 40 };

// Tools whose output is safe to elide. Read/Edit/Write are absent on purpose:
// their output feeds exact-match edits. mcp__* are read-only info tools.
const SAFE_TOOLS = ['Bash', 'Agent', 'WebFetch', 'WebSearch', 'Grep', 'Glob'];

// The correctness invariant, enforced rather than merely defaulted: these tools'
// output feeds later exact-match edits, so eliding it makes the model edit text
// it never saw. CHISLE_COMPRESS_TOOLS is an override for the *allowlist*, not a
// way to switch this off — the Pi extension (NEVER_COMPRESS) and the OpenCode
// path (UNSAFE_TOOLS_OPENCODE) have always checked it first, and this is the
// same guard for the Claude/Pi hook payloads.
const NEVER_COMPRESS = ['read', 'edit', 'write', 'multiedit', 'notebookedit', 'notebookread'];

// Copilot CLI's own runtime tool names (lowercase, no mcp__ prefix scheme).
// Same allowlist rule as SAFE_TOOLS: Copilot's Read/Edit/Write equivalents
// are `view`/`create`/`edit` and are deliberately absent here too. Verified
// against Copilot CLI's real tool set, not guessed — see the accompanying PR
// description for the live-verification evidence (Beyin chisle-port project).
const SAFE_TOOLS_COPILOT = ['bash', 'powershell', 'grep', 'glob', 'web_fetch', 'web_search', 'task'];
// Copilot's Read/Edit/Write family, hard-blocked for the same reason as
// NEVER_COMPRESS above — not merely absent from the allowlist.
const NEVER_COMPRESS_COPILOT = ['view', 'create', 'edit', 'str_replace', 'insert'];

const SALVAGE_RE = /\b(error|err!|fail(ed|ure|ing)?|exception|traceback|panic|fatal|denied|refused|timed?[ _-]?out|assert(ion)?|segfault|npe|undefined reference|cannot find|not found|warning)\b/i;
const MAX_SALVAGED = 12;      // error lines rescued from the elided middle
const MAX_SALVAGE_LINE = 300; // per-line char cap on salvaged lines

function toolAllowed(name) {
  if (!name || typeof name !== 'string') return false;
  if (NEVER_COMPRESS.includes(name.toLowerCase())) return false;
  const list = process.env.CHISLE_COMPRESS_TOOLS
    ? process.env.CHISLE_COMPRESS_TOOLS.split(',').map(s => s.trim()).filter(Boolean)
    : SAFE_TOOLS;
  return list.includes(name) || (!process.env.CHISLE_COMPRESS_TOOLS && name.startsWith('mcp__'));
}

// Same override semantics as toolAllowed, against Copilot's tool-name scheme.
function copilotToolAllowed(name) {
  if (!name || typeof name !== 'string') return false;
  if (NEVER_COMPRESS_COPILOT.includes(name.toLowerCase())) return false;
  const list = process.env.CHISLE_COMPRESS_TOOLS
    ? process.env.CHISLE_COMPRESS_TOOLS.split(',').map(s => s.trim()).filter(Boolean)
    : SAFE_TOOLS_COPILOT;
  return list.includes(name);
}

// OpenCode runtime tool names are lowercase (bash, grep, glob, webfetch, ...)
// and MCP tools are `server_tool` (an underscore), not Claude's mcp__ prefix.
// read/edit/write/patch are excluded on purpose: their output feeds exact-match
// edits, exactly as SAFE_TOOLS omits Read/Edit/Write.
const SAFE_TOOLS_OPENCODE = ['bash', 'grep', 'glob', 'webfetch', 'websearch', 'task', 'list'];
const UNSAFE_TOOLS_OPENCODE = ['read', 'edit', 'write', 'patch', 'todowrite', 'todoread'];

function opencodeToolAllowed(name) {
  if (!name || typeof name !== 'string') return false;
  const lower = name.toLowerCase();
  // read/edit/write/patch are never compressed, even via CHISLE_COMPRESS_TOOLS:
  // their output feeds exact-match edits (the invariant INSTALL.md promises).
  if (UNSAFE_TOOLS_OPENCODE.includes(lower)) return false;
  if (process.env.CHISLE_COMPRESS_TOOLS) {
    return process.env.CHISLE_COMPRESS_TOOLS
      .split(',').map(s => s.trim()).filter(Boolean).includes(name);
  }
  if (SAFE_TOOLS_OPENCODE.includes(lower)) return true;
  // Heuristic: underscore = MCP `server_tool`, treated as read-only info tool
  // like SAFE_TOOLS' mcp__ clause. Set CHISLE_COMPRESS_TOOLS to override if a
  // custom underscore-named tool ever needs protecting.
  return name.includes('_');
}

// One OpenCode tool_result → replacement string, or null to keep the original.
// The plugin passes output.output (already a plain string), so no extractText/
// rebuild dance is needed — just gate on mode/kill-switch/allowlist and reuse
// the shared scrub+elide core. stateDir keeps spill/recovery beside OpenCode's
// config (CHISLE_STATE_DIR overrides, used by tests).
//
// Fires for the common case: outputs under OpenCode's own on-disk store limits
// (~50 KB / 2000 lines) arrive here FULL, both in tool.execute.after (whose
// mutation persists to the tool part's state.output) and again, request-time,
// in experimental.chat.messages.transform. Larger outputs arrive as OpenCode's
// notice plus a retained tail; the tail still compresses here.
function compressForOpencode(toolName, text, opts) {
  opts = opts || {};
  if (opts.mode === 'off') return null;
  if (process.env.CHISLE_COMPRESS === '0') return null;
  if (!opencodeToolAllowed(toolName)) return null;
  if (typeof text !== 'string' || !text) return null;
  const stateDir = opts.stateDir || process.env.CHISLE_STATE_DIR || getOpencodeDir();
  return transform(text, limitsFor(), toolName, stateDir);
}

// Copilot CLI's postToolUse payload is flat and camelCase:
//   { sessionId, timestamp, cwd, toolName, toolArgs,
//     toolResult: { resultType: "success", textResultForLlm: string } }
// Detected structurally (no explicit "harness" field exists on either
// payload shape), by the presence of toolResult.textResultForLlm together
// with the camelCase toolName — Claude/Pi payloads use tool_name/tool_response
// and never carry this shape.
function isCopilotPayload(payload) {
  return !!(payload && typeof payload.toolName === 'string' &&
    payload.toolResult && typeof payload.toolResult.textResultForLlm === 'string');
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
// Also handles Copilot's already-flat textResultForLlm string unchanged.
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

function duplicateMarker(toolName, text, reference = 'previous') {
  const lines = text.split('\n');
  const prior = reference === 'previous' ? 'the previous' : 'an earlier';
  const preview = lines.slice(0, 5)
    .map(l => l.length > MAX_SALVAGE_LINE ? l.slice(0, MAX_SALVAGE_LINE) + '…' : l);
  return '[chisle: output byte-identical to ' + prior + ' ' + toolName + ' result — ' +
    text.length.toLocaleString('en-US') + ' chars / ' + lines.length +
    ' lines, unchanged. First lines:]\n' + preview.join('\n');
}

// `stateDir` defaults to getClaudeDir() so every existing Claude/Pi call site
// and test (none of which pass a third argument) keeps its exact prior
// behaviour. Copilot's caller (processPayload, below) passes getCopilotDir().
function dedupCheck(toolName, text, sessionId, toolUseId, stateDir) {
  if (process.env.CHISLE_COMPRESS_DEDUP === '0') return null;
  if (!sessionId || typeof sessionId !== 'string') return null;
  if (text.length < DEDUP_MIN) return null;
  try {
    const dir = stateDir || getClaudeDir();
    const p = path.join(dir, '.chisle-compress-last.json');
    try { if (fs.lstatSync(p).isSymbolicLink()) return null; } catch (e) { if (e.code !== 'ENOENT') return null; }
    let state = {};
    try { state = JSON.parse(fs.readFileSync(p, 'utf8')) || {}; } catch (e) {}
    if (state.session !== sessionId) state = { session: sessionId, tools: {} };
    if (!state.tools || typeof state.tools !== 'object') state.tools = {};
    const hash = crypto.createHash('sha256').update(text).digest('hex');
    // A second hook invocation for the SAME tool call is not the model seeing
    // the output twice. That happens whenever this hook is registered more than
    // once (plugin manifest + a leftover settings.json entry), because both
    // copies share this state file: copy A stores the hash, copy B matches it
    // and reports first-seen output as a duplicate of itself. Old string-valued
    // entries read through `rec`, so an existing state file needs no migration,
    // and a payload with no tool_use_id keeps today's exact behaviour.
    const prev = state.tools[toolName];
    const rec = (prev && typeof prev === 'object') ? prev : { hash: prev, id: null };
    const sameCall = !!(toolUseId && rec.id && rec.id === toolUseId);
    const dup = rec.hash === hash && !sameCall;
    state.tools[toolName] = { hash, id: toolUseId || rec.id || null };
    fs.mkdirSync(dir, { recursive: true });
    const tmp = p + '.' + process.pid + '.tmp';
    fs.writeFileSync(tmp, JSON.stringify(state), { mode: 0o600 });
    fs.renameSync(tmp, p);
    return dup ? duplicateMarker(toolName, text) : null;
  } catch (e) { return null; }
}

// ── Tier 2: elision ──────────────────────────────────────────────────────────
// Keep head + tail; salvage error-looking lines from the elided middle so the
// one line that mattered in a 3000-line build log survives the cut.
// ── recoverable elision ─────────────────────────────────────────────────────
// Elision used to destroy the middle. If the agent then needed a line from it,
// its only recourse was re-running the command: more expensive than the elision
// saved, and wrong outright when the command is not idempotent (a test run, a
// build, `git log` at a moment in time). So the full text spills to disk first
// and the marker carries the path. Recovery becomes a targeted grep instead of
// a re-run. Best-effort throughout: if the spill fails, the elision still
// happens, it just loses the escape hatch.
const SPILL_DIR = 'chisle-spill';
const SPILL_KEEP = 40;

function spillDir(stateDir) {
  return path.join(stateDir || getClaudeDir(), SPILL_DIR);
}

// Keep the directory bounded. Oldest-first by mtime; cheap enough at this size
// and it runs at most once per elided output.
function pruneSpill(dir) {
  try {
    const files = fs.readdirSync(dir)
      .filter(f => f.endsWith('.txt'))
      .map(f => { const p = path.join(dir, f); return { p, t: fs.statSync(p).mtimeMs }; })
      .sort((a, b) => b.t - a.t);
    for (const f of files.slice(SPILL_KEEP)) { try { fs.unlinkSync(f.p); } catch (e) {} }
  } catch (e) {}
}

function spill(text, toolName, stateDir) {
  if (process.env.CHISLE_COMPRESS_SPILL === '0') return null;
  try {
    const dir = spillDir(stateDir);
    fs.mkdirSync(dir, { recursive: true, mode: 0o700 });
    const hash = crypto.createHash('sha256').update(text).digest('hex').slice(0, 12);
    const safeTool = String(toolName || 'tool').replace(/[^A-Za-z0-9_-]/g, '') || 'tool';
    const file = path.join(dir, `${safeTool}-${hash}.txt`);
    if (!fs.existsSync(file)) fs.writeFileSync(file, text, { mode: 0o600 });
    pruneSpill(dir);
    return file;
  } catch (e) { return null; }
}

function compress(text, limits, spillPath) {
  const { maxChars, headLines, tailLines } = limits;
  const lines = text.split('\n');
  const recover = spillPath ? ' Full output: ' + spillPath + ' (grep it, do not re-run)' : '';

  if (lines.length <= headLines + tailLines) {
    // Big in bytes, few lines (one giant line): hard char cut.
    const keep = Math.floor(maxChars / 2);
    const elided = text.length - 2 * keep;
    if (elided <= 0) return null;
    return text.slice(0, keep) +
      '\n... [chisle: elided ' + elided.toLocaleString('en-US') + ' chars from the middle.' + recover + '] ...\n' +
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
    ' lines, kept first ' + headLines + ', last ' + tailLines +
    (salvaged.length ? ', and ' + salvaged.length + ' error-like line(s) below' : '') +
    '.' + recover + '] ...';

  const out = head.concat([marker], salvaged, tail).join('\n');
  return out.length < text.length ? out : null;
}

// Best-effort savings ledger. Races between parallel tool calls can drop a
// count — stats only, never worth a lock file.
function recordSavings(saved, stateDir) {
  try {
    const dir = stateDir || getClaudeDir();
    const p = path.join(dir, '.chisle-compress-stats.json');
    try { if (fs.lstatSync(p).isSymbolicLink()) return; } catch (e) { if (e.code !== 'ENOENT') return; }
    let stats = { savedChars: 0, events: 0 };
    try {
      const parsed = JSON.parse(fs.readFileSync(p, 'utf8'));
      if (parsed && Number.isFinite(parsed.savedChars) && Number.isFinite(parsed.events)) stats = parsed;
    } catch (e) {}
    stats.savedChars += saved;
    stats.events += 1;
    fs.mkdirSync(dir, { recursive: true });
    const tmp = p + '.' + process.pid + '.tmp';
    fs.writeFileSync(tmp, JSON.stringify(stats), { mode: 0o600 });
    fs.renameSync(tmp, p);
  } catch (e) {}
}

// Scrub + elide on plain text → transformed text, or null if no meaningful
// win. Stateless (aside from the spill side-effect) — this is what the
// replay benchmark measures for Claude/Pi.
function transform(text, limits, toolName, stateDir) {
  if (!text || text.length <= SCRUB_MIN) return null;
  let t = process.env.CHISLE_COMPRESS_SCRUB === '0' ? text : scrub(text);
  if (t.length > limits.maxChars) {
    const elided = compress(t, limits, toolName ? spill(t, toolName, stateDir) : null);
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
//
// Not used for Copilot: its toolResult.textResultForLlm is already a flat
// string, so main() builds { modifiedResult: { textResultForLlm } } directly
// and never calls this function for a Copilot-shaped payload.
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
// the original. Pure given (payload, mode, env) except dedup/spill/stats state.
//
// `mode` keeps meaning "off disables everything" for Claude/Pi, exactly as
// before. For a Copilot-shaped payload the caller (main()) always passes
// 'on' — Copilot has no /chisle toggle to read a flag file for — so this
// function's Copilot branch below never actually sees 'off' in practice, but
// still honors it if a future caller passes it explicitly.
function processPayload(payload, mode) {
  if (!payload || typeof payload !== 'object') return null;
  if (!mode || mode === 'off') return null;
  if (process.env.CHISLE_COMPRESS === '0') return null;

  if (isCopilotPayload(payload)) {
    const toolName = payload.toolName;
    if (!copilotToolAllowed(toolName)) return null;
    const text = payload.toolResult.textResultForLlm;
    if (!text) return null;
    const stateDir = getCopilotDir();
    const dup = dedupCheck(toolName, text, payload.sessionId, null, stateDir);
    if (dup != null && dup.length < text.length) return dup;
    return transform(text, limitsFor(), toolName, stateDir);
  }

  if (!toolAllowed(payload.tool_name)) return null;
  const text = extractText(payload.tool_response != null ? payload.tool_response : payload.tool_output);
  if (!text) return null;
  const dup = dedupCheck(payload.tool_name, text, payload.session_id, payload.tool_use_id, getClaudeDir());
  if (dup != null && dup.length < text.length) return dup;
  return transform(text, limitsFor(), payload.tool_name, getClaudeDir());
}

function main() {
  let input = '';
  process.stdin.on('data', chunk => { input += chunk; });
  process.stdin.on('end', () => {
    try {
      const payload = JSON.parse(input.replace(/^﻿/, ''));
      const copilot = isCopilotPayload(payload);

      // Copilot has no /chisle mode-toggle mechanism (no UserPromptSubmit
      // hook wired for it yet, so there is nothing to flip a flag file with):
      // treat it as always-on, matching the always-on ruleset it already
      // gets. Claude/Pi keep reading the real flag file exactly as before.
      const mode = copilot ? 'on' : readFlag(path.join(getClaudeDir(), '.chisle-active'));

      const updated = processPayload(payload, mode);
      if (updated == null) return;

      if (copilot) {
        const original = payload.toolResult.textResultForLlm;
        recordSavings(original.length - updated.length, getCopilotDir());
        // Echo back the result type we were handed. Hard-coding 'success'
        // would relabel a failed tool call as a successful one on its way to
        // the model — the compressor only ever rewrites text, never status.
        const resultType = payload.toolResult.resultType || 'success';
        process.stdout.write(JSON.stringify({
          modifiedResult: { resultType, textResultForLlm: updated },
        }));
        return;
      }

      const response = payload.tool_response != null ? payload.tool_response : payload.tool_output;
      const rebuilt = rebuildResponse(response, updated);
      // Shape we can't safely rebuild — emit nothing and count nothing.
      if (rebuilt == null) return;
      const original = extractText(response);
      // Only after we know a replacement is actually going out, so the stats
      // file stops crediting savings the harness never applied.
      recordSavings(original.length - updated.length, getClaudeDir());
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

module.exports = {
  extractText, rebuildResponse, scrub, compress, transform, limitsFor, toolAllowed, processPayload,
  duplicateMarker, THRESHOLDS, SAFE_TOOLS, NEVER_COMPRESS,
  // Copilot-specific additions (see PR description for rationale):
  isCopilotPayload, copilotToolAllowed, SAFE_TOOLS_COPILOT, NEVER_COMPRESS_COPILOT,
  // OpenCode-specific additions (plugin uses tool.execute.after +
  // experimental.chat.messages.transform):
  opencodeToolAllowed, compressForOpencode, SAFE_TOOLS_OPENCODE,
};
