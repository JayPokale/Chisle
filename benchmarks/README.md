# Benchmarks

## Results at a glance

Every number below is regenerated from the committed `raw*/` data by the
deterministic graders in this directory — no LLM calls, no hand-copied figures.
Reproduce with the commands in each section.

| suite | what it answers | headline | verdict |
|-------|-----------------|----------|---------|
| [1. Live 4-arm](#1-live-4-arm-head-to-head) | Does the ruleset cut billed output? | 33% of vanilla tokens overall (27% coding, 73% non-coding) | **win on cost**, thin on prose |
| [2. Input-axis replay](#2-input-axis-replay-deterministic-free) | How much tool output can be safely elided? | ~45–47% per eligible output; 1.3–2.1% of session content | **real but small** at session scale |
| [3. Correctness](#3-correctness-suites-maths--coding-auto-graded) | Does terseness make the model wrong? | 156/156 vs 155/156, Fisher p = 1.000 | **null result** — no quality cost |
| [4. Agentic](#4-agentic-suite-real-repos-hidden-tests) | Does it help in a real repo? | 80.0% vs 81.7% pass, Fisher p = 1.000 | **null result** — tie within noise |

The two null results are the important ones: Chisle's claim is that it cuts cost
**without** costing correctness, and a null on quality is exactly what supports
that. It is not evidence that Chisle makes the model smarter.

## What we measure

| Metric | Layer | Why |
|--------|-------|-----|
| Billed output tokens | live | The headline cost number (includes model reasoning) |
| Visible answer size / lines | deterministic | What the user reads; YAGNI proxy |
| Correctness | graded | A short answer that's wrong is not a win |
| Input chars elided | deterministic | The compressor's measured, baselined savings |

The correctness gate matters: compression is only a benefit if the answer still
solves the task. An arm that's 90% shorter but fails the task scores zero.

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

### Results — billed output tokens as % of vanilla (lower = leaner)

`node benchmarks/aggregate.js`, over the committed suites. rdxmin is Chisle
(historical key, matches the raw filenames).

| segment | vanilla | caveman | ponytail | **rdxmin** |
|---------|--------:|--------:|---------:|-----------:|
| coding | 100% | 36% | 33% | **27%** |
| non-coding | 100% | 99% | 115% | **73%** |
| all | 100% | 45% | 45% | **33%** |

Raw totals behind that (billed tokens / answer lines, n cells):

| segment | vanilla | caveman | ponytail | **rdxmin** |
|---------|--------:|--------:|---------:|-----------:|
| coding | 7766t / 298L (n=3) | 2818t / 118L (n=3) | 2592t / 56L (n=3) | **2075t / 43L (n=3)** |
| non-coding | 1327t / 46L (n=3) | 1310t / 42L (n=3) | 1525t / 75L (n=3) | **966t / 19L (n=3)** |
| all | 9093t / 344L (n=6) | 4128t / 160L (n=6) | 4117t / 131L (n=6) | **3041t / 62L (n=6)** |

n=6 tasks per arm is small — treat the split between caveman and ponytail as
noise, and only the vanilla-vs-rest gap as load-bearing.

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

### Results — what the compressor actually elides

Measured over the maintainer's own session corpus (19.3M chars). Tool output is
**67.5%** of all session content, but the outputs big enough to compress are rare:

| mode | outputs touched | chars before → after | saved | % of session content |
|------|----------------:|---------------------:|------:|---------------------:|
| full | 53 | 549,432 → 304,182 | 245,250 (~61k tok) | 1.3% |
| ultra | 106 | 876,738 → 465,068 | 411,670 (~103k tok) | 2.1% |

Per eligible output that is **~45–47% smaller**, but only ~4% of tool results
clear the 8k threshold, so the session-level number stays low. `Read`/`Edit`
output dominates the big-output bucket (5.62M chars) and is deliberately
excluded — eliding it would make the model edit text it never saw.

Receipts from the maintainer's corpus:
[`results/2026-07-07-input-axis.md`](./results/2026-07-07-input-axis.md).

## 3. Correctness suites (maths + coding, auto-graded)

`quality/` asks the question the cost suites cannot: does the ruleset change how
often the model is **right**? 32 maths problems graded by exact match, 20 coding
problems graded by hidden unit tests, no judge model.

```bash
node benchmarks/quality/run.js [model] [seeds] [parallel]
node benchmarks/quality/grade.js
```

### Results — accuracy (auto-graded, no judge model)

| arm | n | correct | accuracy | mean output tokens | mean answer chars |
|-----|--:|--------:|---------:|-------------------:|------------------:|
| vanilla | 156 | 155 | 99.4% | 802 | 480 |
| **chisle** | 156 | **156** | **100.0%** | **723** | **336** |

Fisher exact, two-sided: **p = 1.000** — not separable from noise at this cell
count. The single vanilla miss (`code/deepequal`, seed 1) is one cell, not a
trend. Read this as *no detectable quality cost*, not as an accuracy gain;
30% fewer answer chars at the same correctness is the actual result.

## 4. Agentic suite (real repos, hidden tests)

`agentic/` drives the real agent with real tools across five fixture repos, each
with a planted trap (an existing helper that should be reused, a shared bug with
three call sites, a config ask that invites a framework). The agent never sees
the test.

```bash
node benchmarks/agentic/run.js [model] [seeds] [parallel]
node benchmarks/agentic/score.js
```

### Results — hidden-test pass rate and cost

| arm | n | passed | pass rate | new files | net LOC | deps | out tokens | context tokens | $ / run |
|-----|--:|-------:|----------:|----------:|--------:|-----:|-----------:|---------------:|--------:|
| vanilla | 60 | 49 | 81.7% | 0.20 | 3.7 | 0.00 | 1171 | 67832 | 0.0269 |
| **chisle** | 60 | 48 | 80.0% | 0.20 | **2.9** | 0.00 | **1083** | **64695** | 0.0276 |

Fisher exact, two-sided: **p = 1.000**. Per fixture:

| fixture | vanilla | chisle | Fisher p |
|---------|--------:|-------:|---------:|
| dupepaths | 4/12 | 4/12 | 1.000 |
| reuse | 12/12 | 12/12 | 1.000 |
| rootcause | 12/12 | 12/12 | 1.000 |
| stdlib | 12/12 | 12/12 | 1.000 |
| yagni | 9/12 | 8/12 | 1.000 |

Chisle loses one net cell (`yagni`), writes a slightly shorter diff, and pulls
~4.6% less context — and costs marginally **more** per run ($0.0276 vs $0.0269),
because cheaper output does not offset the ruleset's own prompt tokens at this
task size. `dupepaths` fails in both arms 8/12 of the time: the fixture is hard
for the model, not a discriminator between arms.

Both scorers print Fisher exact p-values, Wilson intervals and every failing
cell. Results:
[`results/2026-09-14-quality-and-agentic.md`](./results/2026-09-14-quality-and-agentic.md)
— which reports a **null result** on answer quality and a cost saving that is
real for prose and negligible for code.
