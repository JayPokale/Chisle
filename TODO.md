# 🧨 Chisle — TODO / Roadmap

Ideas not yet shipped. Same rule as the code: nothing lands without receipts.

---

## Tool-output compression (a second axis)

**Status:** ✅ shipped 2026-07-07 (`hooks/chisle-compress-output.js`, v0.2.0)

PostToolUse hook that mechanically shrinks oversized tool results before the
model sees them — head + tail kept, middle elided, error-looking lines salvaged
from the cut — swapped in via `updatedToolOutput`. Deterministic, zero LLM,
zero network, zero deps. Thresholds track the `/chisle` level; savings accrue in a
ledger the statusline renders (`⇣9k tok`).

Answers to the ship-gating questions (receipts:
[`benchmarks/results/2026-07-07-input-axis.md`](benchmarks/results/2026-07-07-input-axis.md)):

- [x] **What % of session tokens is tool output?** 67.5% of message content
      across 171 real transcripts (gut said 15–40% — low). Outputs >8k chars are
      4% of tool results but 25% of all session content.
- [x] **Does eliding the middle ever hurt correctness?** Two real risks found
      and closed by design: (1) `Read` output feeds `Edit` old_string matching —
      so compression is allowlist-only (Bash/Agent/WebFetch/WebSearch/Grep/Glob/
      `mcp__*`), never Read/Edit/Write; (2) the one error line in a 3000-line
      log can live in the middle — salvage regex rescues up to 12 error-like
      lines from the cut. Kill switch: `CHISLE_COMPRESS=0`.
- [x] **Track the `/chisle` mode?** Yes — lite 16k / full 8k / ultra 5k char
      thresholds, env-overridable; `off` (and "stop chisle") disables entirely.
- [x] **Savings ledger?** `<claudeDir>/.chisle-compress-stats.json`, measured chars
      (real baseline exists, unlike output-side), rendered by both statuslines.

Still open:

- [ ] Portability: `updatedToolOutput` is Claude Code-specific. Cursor /
      Windsurf / Cline / Codex have no post-tool output rewrite hook today —
      Claude-only feature in the multi-agent lineup for now. Partial mitigation
      shipped everywhere: the ruleset's "Context Diet" section (prevention
      beats surgery — Grep before Read, offset/limit, filter at the source).
- [ ] Adversarial correctness benchmark for eliding, same bar as the output
      axis's 0/14 — N real debugging tasks where the needed line was in an
      elided region, did the agent recover?

## Ideas not yet started

- **Read-tool prevention telemetry.** The biggest whale (5.6M big chars) is
  whole-file `Read`s the compressor must not touch. Context Diet rules attack
  it prompt-side; measure whether Read volume actually drops in post-diet
  sessions before claiming the win.
- **Session-history distillation.** On `compact`, old tool outputs are pure
  dead weight; a SessionStart(matcher=compact) hook could re-inject only the
  chisle ruleset instead of letting compaction re-summarize it. Needs measurement.
