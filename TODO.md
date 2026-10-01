# 🧨 Chisle TODO / Roadmap

Ideas not yet shipped. Same rule as the code: nothing lands without receipts.

---

## Tool-output compression (a second axis)

**Status:** ✅ shipped 2026-07-07 (`hooks/chisle-compress-output.js`, v0.2.0)

PostToolUse hook that mechanically shrinks oversized tool results before the
model sees them: head + tail kept, middle elided, error-looking lines salvaged
from the cut, swapped in via `updatedToolOutput`. Deterministic, zero LLM,
zero network, zero deps. One env-overridable 8k threshold; savings accrue in a
ledger the statusline renders (`⇣9k tok`).

Answers to the ship-gating questions (receipts:
[`benchmarks/results/2026-07-07-input-axis.md`](benchmarks/results/2026-07-07-input-axis.md)):

- [x] **What % of session tokens is tool output?** 67.5% of message content
      across 171 real transcripts (gut said 15–40%, which was low). Outputs >8k chars are
      4% of tool results but 25% of all session content.
- [x] **Does eliding the middle ever hurt correctness?** Two real risks found
      and closed by design: (1) `Read` output feeds `Edit` old_string matching,
      so compression is allowlist-only (Bash/Agent/WebFetch/WebSearch/Grep/Glob/
      `mcp__*`), never Read/Edit/Write; (2) the one error line in a 3000-line
      log can live in the middle, so the salvage regex rescues up to 12 error-like
      lines from the cut. Kill switch: `CHISLE_COMPRESS=0`.
- [x] **Track the `/chisle` mode?** Yes, with one 8k threshold, env-overridable;
      `off` (and "stop chisle") disables entirely.
- [x] **Savings ledger?** `<claudeDir>/.chisle-compress-stats.json`, measured chars
      (real baseline exists, unlike output-side), rendered by both statuslines.

Still open:

- [x] **Pi portability.** Pi's `tool_result` rewrite event now carries both axes,
      `/chisle`, and the status badge. Marginal replay after Pi's native
      truncation saved 27.4% of persisted tool-output chars. Cursor / Windsurf /
      Cline / Codex still lack a post-tool rewrite hook; Context Diet remains
      their prevention layer.
- [ ] Adversarial correctness benchmark for eliding, same bar as the output
      axis's 0/14: N real debugging tasks where the needed line was in an
      elided region, did the agent recover? **Narrowed 2026-10-01:** failing
      commands are out of reach (Claude Code sends them to
      `PostToolUseFailure`, which cannot rewrite output), so this only applies
      to successful outputs with an important mid-log line (warnings, logs).

## Open from 2026-10-01

- [ ] **Agent loops cost more with Chisle.** Six fixtures x 6 seeds: context
      +16% (95% CI +1% to +34%), cost +6.8% (CI -1% to +15%), pass rate tied.
      Easy fixtures show the clean part: ~+4%, the ~900-token ruleset times
      ~5 requests. Diagnose the rest with the tool-call logs the runner now
      records: `ARMS=vanilla,chisle FIXTURES=noisylog,dupepaths,reuse
      RAW_DIR=benchmarks/agentic/raw-diag node benchmarks/agentic/run.js
      claude-haiku-4-5-20251001 3` resumes the partial run (usage limit hit:
      vanilla 3/3 per fixture, chisle 1/3). First look: bare also verifies
      with `| tail -20`, so the context diet is not the obvious culprit;
      Chisle explored `dupepaths` in more calls (two `ls` + `package.json`
      vs one `find`).
- [ ] Decide on a release only after that: the trim, the structure-rule
      propagation and the doc corrections are ready under [Unreleased], but
      the agent-loop result argues against advertising lower session cost.

## Ideas not yet started

- **Read-tool prevention telemetry.** The biggest whale (5.6M big chars) is
  whole-file `Read`s the compressor must not touch. Context Diet rules attack
  it prompt-side; measure whether Read volume actually drops in post-diet
  sessions before claiming the win.
- **Session-history distillation.** On `compact`, old tool outputs are pure
  dead weight; a SessionStart(matcher=compact) hook could re-inject only the
  chisle ruleset instead of letting compaction re-summarize it. Needs measurement.
