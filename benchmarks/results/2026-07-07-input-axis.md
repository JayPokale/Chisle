# 2026-07-07 — Input axis: tool-output share + compressor replay

The TODO gated tool-output compression on one question: *what % of session
tokens is tool output?* Gut said 15–40%. Measured: worse.

## Method

Deterministic, zero LLM calls. Two scripts over every local Claude Code
transcript (`~/.claude/projects/**/*.jsonl`, 171 session files, one developer,
~5 weeks of real work — coding-heavy):

1. **Share scan** — sum chars of `tool_result` content vs. assistant/user text.
2. **Replay** (`benchmarks/replay-compress.js`, committed) — feed every
   `tool_result` through the exact code the shipped hook runs
   (`hooks/chisle-compress-output.js`) and count what it would have elided.

Chars ≈ tokens/4 throughout. Reproduce on your own transcripts:
`node benchmarks/replay-compress.js`.

## Finding 1 — tool output dominates the context window

| segment | chars | share |
|---|--:|--:|
| tool output | 13.0M | **67.5%** |
| assistant text | 3.0M | 15.6% |
| user text | 3.3M | 16.9% |

Outputs over 8k chars are only **4%** of tool results but hold **25% of ALL
session content**. The context window is mostly machine dumps nobody reads
twice.

## Finding 2 — where the big outputs come from

| tool | big (>8k) outputs | big chars | compressible? |
|---|--:|--:|---|
| Read | 327 | 5.62M | **no** — feeds `Edit` old_string matching; eliding it makes the model edit text it never saw |
| Bash | 36 | 0.45M | yes |
| Agent | 3 | 0.07M | yes |
| Edit | 1 | 0.13M | no (same family) |

This split forced the design: **allowlist, never blocklist**. The hook touches
Bash/Agent/WebFetch/WebSearch/Grep/Glob/`mcp__*` and nothing else. The Read
whale is attacked by *prevention* instead — the ruleset's new "Context Diet"
section (Grep before Read, offset/limit, filter at the source).

## Finding 3 — replay results

With the v0.2.0 scrub tier (lossless: ANSI strip, blank-run and repeated-line
collapse — applies to medium outputs the elision threshold ignores):

| mode | outputs touched | chars before → after | saved | % of session content |
|---|--:|--:|--:|--:|
| full | 53 | 549,432 → 304,182 | 245,250 (~61k tok) | 1.3% |
| ultra | 106 | 876,738 → 465,068 | 411,670 (~103k tok) | 2.1% |

Per eligible output: **~45–47% smaller**. Error-looking lines were salvaged
from the elided middle in 10 (full) / 19 (ultra) outputs — the failure mode
that makes naive head+tail eliding dangerous.

The dedup tier (byte-identical same-session repeat of a tool's previous
output → one-line marker) scored **0 hits on this corpus** — outputs here were
already source-filtered by rtk, and real reruns usually differ by timestamps.
It stays because the test-rerun case is real and its cost is zero, but per
house rules it's labeled speculative until it earns a number
(`RDX_COMPRESS_DEDUP=0` to disable).

## Finding 4 — the resend multiplier (why 1.2% understates it)

A tool output isn't billed once. It rides in the context window of **every
subsequent API request** in the session. For the 39 outputs compressed in full
mode, the median had **171 subsequent requests** in its session; summing
saved-chars × subsequent-requests gives ~372M chars (~93M input tokens) of
context that would simply never have been re-sent. Most of that would have been
cache-read-discounted, so don't read it as 93M full-price tokens — but the
one-shot figure (60k) is the floor, not the estimate.

## Honest caveats

- One developer's corpus, Read-heavy usage. A CI-babysitting or log-grepping
  workflow would see several × more (its whales are Bash).
- Chars/4 is a rough token proxy for code-heavy text.
- Correctness of eliding is guarded (allowlist + error salvage + head/tail),
  not yet adversarially benchmarked like the output axis's backfire ledger.
  Kill switch: `RDX_COMPRESS=0`.
