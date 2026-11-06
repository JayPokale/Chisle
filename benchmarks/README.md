# Benchmarks

Every number below is recomputed from the committed `raw*/` cells by the
scripts in this directory; no hand-copied figures. Full tables, intervals and
reading notes: [docs/benchmarks.md](../docs/benchmarks.md). Earlier rounds
(June–October 2026) are retired and live in the git history.

## Results at a glance (Chisle 3.9, November 2026)

| suite | what it answers | result |
|-------|-----------------|--------|
| [Side by side](#1-side-by-side-and-live-suites) | Does the ruleset cut billed output, against the rivals? | 71% of bare on Haiku 4.5 (3.8.1: 75%, caveman 87%, ponytail 90%); 57% on Sonnet 5.5 |
| [Correctness](#2-correctness-maths--coding-auto-graded) | Does terseness make the model wrong? | 156/156 vs bare 154/156, Fisher p = 0.498 |
| [Agentic](#3-agentic-real-repos-hidden-tests) | Does it hold up in a real repo loop? | 38/42 vs bare 36/42, p = 0.738; with `tools trim`, −10% cost per request |
| [Replay](#4-input-axis-replay-deterministic-free) | How much tool output is safely elided? | ~48% per oversized output, 7.1% of session content |

The correctness and agentic results are deliberate null results: the claim is
that Chisle cuts cost **without** costing correctness, not that it makes the
model smarter.

## What we measure

| Metric | Why |
|--------|-----|
| Billed output tokens | the cost number, reasoning included |
| Answer length / lines | what the user reads |
| Correctness | a short answer that is wrong scores zero |
| Context per request | what every turn re-reads; the bulk of real spend |

## 1. Side-by-side and live suites

`run-ablation.js` runs any number of named rulesets in one session, so old and
new Chisle answer the same prompts beside caveman and ponytail; `run-live.sh`
is the four-arm runner the prompts come from. Tools are off (`--tools ""`), so
each cell is one answer. Score with `pooled.js` (pooled ratio of sums vs bare,
95% bootstrap).

```bash
node benchmarks/run-ablation.js <dir> 2 4 vanilla caveman=<SKILL.md> ponytail=<SKILL.md> chisle=skills/chisle/SKILL.md
MODEL=claude-sonnet-5-5 node benchmarks/run-ablation.js <dir> 2 4 vanilla chisle=skills/chisle/SKILL.md
bash benchmarks/run-live.sh claude-haiku-4-5-20251001 benchmarks/results/<dir>/default-s1
ARMS=vanilla,caveman,ponytail,chisle node benchmarks/pooled.js benchmarks/results/raw-nov/*/
```

Cells: [`results/raw-nov-sidebyside/`](results/raw-nov-sidebyside/),
[`results/raw-nov-sonnet/`](results/raw-nov-sonnet/),
[`results/raw-nov/`](results/raw-nov/).

## 2. Correctness (maths + coding, auto-graded)

32 maths problems graded by exact match, 20 coding problems by hidden unit
tests, no judge model. Details: [quality/README.md](quality/README.md).

```bash
RAW_DIR=benchmarks/quality/raw-nov node benchmarks/quality/run.js claude-haiku-4-5-20251001 3 4
RAW_DIR=benchmarks/quality/raw-nov node benchmarks/quality/grade.js
```

## 3. Agentic (real repos, hidden tests)

Seven fixture repos with planted traps, driven by the real agent with real
tools; the test arrives only after the run. Arms: `vanilla`, `chisle`,
`chisle-hook`, `chisle-trim`, `ponytail`. Details:
[agentic/README.md](agentic/README.md).

```bash
ARMS=vanilla,chisle,chisle-trim RAW_DIR=benchmarks/agentic/raw-nov node benchmarks/agentic/run.js claude-haiku-4-5-20251001 6 3
ARMS=vanilla,chisle,chisle-trim RAW_DIR=benchmarks/agentic/raw-nov node benchmarks/agentic/score.js
```

## 4. Input-axis replay (deterministic, free)

`replay-compress.js` feeds your own local Claude Code or Pi tool results through
the shipped compressor. Zero LLM calls; your sessions stay on your machine.

```bash
node benchmarks/replay-compress.js          # Claude Code
node benchmarks/replay-compress.js pi       # Pi
```
