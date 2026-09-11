# Benchmarks

## 1. Live 4-arm head-to-head

`run-live.sh` drives authenticated Claude Code or Pi across four arms — vanilla
(no tool), caveman, ponytail, rdxmin — over 6 tasks (3 coding, 3 non-coding).
Each arm differs **only** in the system prompt injected; plugins, tone hooks, and
personal config are neutralized via an isolated `HOME` + config dir holding only
credentials. Competitor prompts resolve from a local clone or the installed
plugin cache. Raw model outputs are committed under `results/raw*/` for audit.

```bash
bash benchmarks/run-live.sh [model] [raw-dir]                 # Claude Code
HARNESS=pi bash benchmarks/run-live.sh [model] [raw-dir]      # Pi; keeps raw JSONL + normalized JSON
node benchmarks/aggregate.js                                  # comparison tables (RAW_DIR= for a fresh dir)
node scripts/build-chart.js                        # regenerate assets/benchmark.svg from all raw dirs
```

Committed suites: `results/raw/` (June, Haiku), `results/raw-sonnet/` (June,
Sonnet), `results/raw-verify/` (July re-verification). Combined ledger, per-task
detail, and the correctness grading live in
[`results/2026-07-07-verify-rerun.md`](./results/2026-07-07-verify-rerun.md);
June writeups: [`2026-06-29-live-4arm.md`](./results/2026-06-29-live-4arm.md),
[`2026-06-29-reliability.md`](./results/2026-06-29-reliability.md). Pi's separate
harness receipt and raw events: [`2026-09-11-pi.md`](./results/2026-09-11-pi.md).

rdxmin is leanest on code; on pure prose a dedicated prose compressor wins on a
good day. The chart and README state this plainly — no cherry-picking.

## 2. Input-axis replay (deterministic, free)

`replay-compress.js` feeds local Claude Code or Pi tool results through the
same compression core the adapters run. Zero LLM calls. Pi's baseline is stored
content after its native 50KB/2,000-line cap, so the reported saving is marginal.
Extension tools require explicit opt-in through `CHISLE_COMPRESS_TOOLS` in both
runtime and replay.

```bash
node benchmarks/replay-compress.js                 # Claude Code
node benchmarks/replay-compress.js pi              # Pi
node benchmarks/replay-compress.js pi <session-dir>
```

Receipts from the maintainer's corpus:
[`results/2026-07-07-input-axis.md`](./results/2026-07-07-input-axis.md).

## What we measure

| Metric | Layer | Why |
|--------|-------|-----|
| Billed output tokens | live | The headline cost number (includes model reasoning) |
| Visible answer size / lines | deterministic | What the user reads; YAGNI proxy |
| Correctness | graded | A short answer that's wrong is not a win |
| Input chars elided | deterministic | The compressor's measured, baselined savings |

The correctness gate matters: compression is only a benefit if the answer still
solves the task. An arm that's 90% shorter but fails the task scores zero.
