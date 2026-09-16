// chisle — OpenCode plugin: tool-output compression (the input axis).
//
// Prompt-side rules (the fenced ruleset the installer writes into
// ~/.config/opencode/AGENTS.md) shrink what the model WRITES. This plugin
// shrinks what it READS: oversized tool results (bash dumps, subagent reports,
// web fetches, MCP payloads) get their repetitive middle elided — head kept,
// tail kept, error lines salvaged — before the model sees them. Deterministic,
// zero LLM, zero network. Read/Edit/Write output is never touched.
//
// OpenCode exposes two relevant plugin hooks. `tool.execute.after` receives a
// completed tool result whose `output.output` is the plain text the model will
// see; mutating it in place also persists onto the stored tool part, so every
// later turn reuses the compressed form. `experimental.chat.messages.transform`
// runs just before parts are converted to model messages, a request-time safety
// net that re-compresses any full output the store still holds (e.g. recorded
// before this plugin was installed). Neither needs a schema rebuild.
//
// Load it by installing via `npx chisle --only opencode`, which drops this file
// and the shared compressor core into ~/.config/opencode/plugins/. OpenCode
// loads every file in that dir at startup.
//
// Tunables (shared with the Claude/Pi/Copilot compressor, see chisle-config):
//   CHISLE_COMPRESS=0            kill switch
//   CHISLE_DEFAULT_MODE=off      disable by default (env or ~/.config/chisle)
//   CHISLE_COMPRESS_MAX_CHARS    outputs at/under this size are not elided
//   CHISLE_COMPRESS_TOOLS=bash,… override the tool allowlist

import { createRequire } from 'module';
import path from 'path';
import { fileURLToPath } from 'url';

const require = createRequire(import.meta.url);
const __dirname = path.dirname(fileURLToPath(import.meta.url));

// The compressor core is CommonJS. When installed by `chisle --only opencode`
// it sits in ./chisle-hooks/; running straight from the repo it's ../../hooks/.
function loadFrom(names) {
  for (const rel of names) {
    try { return require(rel); }
    catch (e) { if (e && e.code !== 'MODULE_NOT_FOUND' && e.code !== 'ERR_MODULE_NOT_FOUND') throw e; }
  }
  return null;
}

const core = loadFrom([
  './chisle-hooks/chisle-compress-output.js',
  '../../hooks/chisle-compress-output.js',
]);
const config = loadFrom([
  './chisle-hooks/chisle-config.js',
  '../../hooks/chisle-config.js',
]) || { getDefaultMode: () => 'on' };

const compressForOpencode = core && core.compressForOpencode;
const getDefaultMode = config.getDefaultMode || (() => 'on');

// Already compressed: our elision marker. Skip such text so a second pass
// (messages.transform after tool.execute.after already ran) never nests a
// marker or eats an earlier salvage block. Keeps compression idempotent.
const CHISLE_MARK = '[chisle:';

export default async () => {
  return {
    // Compress oversized read-only tool output before the model sees it.
    // Never throws: a broken compressor must not break the tool pipeline.
    //
    // For outputs under OpenCode's on-disk store limits (~50 KB / 2000 lines)
    // output.output is the FULL text and mutating it here persists onto the
    // tool part's state.output — so every later turn sees the compressed form.
    // Larger outputs reach this hook already replaced by OpenCode with a notice
    // plus a retained tail; that tail still compresses here.
    'tool.execute.after': async (input, output) => {
      try {
        if (!compressForOpencode) return;
        // MCP tools can hand back a content[] array rather than a string;
        // built-ins give a string. Only the string case is ours to touch.
        if (!output || typeof output.output !== 'string') return;
        if (output.output.includes(CHISLE_MARK)) return;
        const updated = compressForOpencode(input && input.tool, output.output, { mode: getDefaultMode() });
        if (updated != null && updated.length < output.output.length) {
          output.output = updated;
        }
      } catch (e) { /* keep the original output */ }
    },

    // Request-time safety net over completed tool parts. Runs after MCP
    // normalization and BEFORE OpenCode converts parts to model messages
    // (and before compaction summarization), so it re-applies compression to
    // any full output that reached the model store uncompressed — e.g. parts
    // recorded before this plugin was installed. Skips parts already carrying
    // our marker, so each part is compressed at most once; the elided original
    // still spills to disk exactly as it does on the tool.execute.after path.
    'experimental.chat.messages.transform': async (_input, output) => {
      try {
        if (!compressForOpencode) return;
        if (!output || !Array.isArray(output.messages)) return;
        const mode = getDefaultMode();
        for (const msg of output.messages) {
          const parts = msg && msg.parts;
          if (!Array.isArray(parts)) continue;
          for (const part of parts) {
            if (!part || part.type !== 'tool') continue;
            const st = part.state;
            if (!st || st.status !== 'completed' || typeof st.output !== 'string') continue;
            if (st.output.includes(CHISLE_MARK)) continue;
            const updated = compressForOpencode(part.tool, st.output, { mode });
            if (updated != null && updated.length < st.output.length) {
              st.output = updated;
            }
          }
        }
      } catch (e) { /* leave messages untouched */ }
    },
  };
};
