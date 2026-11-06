# Benchmarks

Every result behind the [README](../README.md), in full. Each figure is recomputed from the committed raw cells by the scripts named beside it; nothing is estimated except where a section says "simulated". Earlier rounds (June–October 2026, rulesets up to v3.8) are retired; they stay in the git history.

## Output axis: Chisle 3.9 (2026-11-06)

**Side by side.** Chisle 3.8.1 and 3.9 ran in the same session as caveman `ef6050c5e184` and ponytail 4.8.3: the 13 `run-live.sh` prompts on Haiku 4.5, Claude Code 2.1.285, tools off, 25 cells per arm where all five arms completed ([raw cells](../benchmarks/results/raw-nov-sidebyside/), runner [`run-ablation.js`](../benchmarks/run-ablation.js)). Percentages are pooled sums vs the bare model, intervals a 95% bootstrap over cells ([`pooled.js`](../benchmarks/pooled.js)).

| | billed | 95% CI | answer length | answer lines | reasoning | backfires |
|---|--:|--:|--:|--:|--:|--:|
| caveman | 87% | 65–120% | 59% | 55% | 246% | 9 / 25 |
| ponytail | 90% | 66–120% | 62% | 60% | 248% | 12 / 25 |
| Chisle 3.8.1 | 75% | 57–105% | 58% | 55% | 169% | 7 / 25 |
| **Chisle 3.9** | **71%** | **53–104%** | **55%** | **45%** | **157%** | **7 / 25** |

Chisle 3.9 is leanest on every column (tied with 3.8.1 on backfires), but the gap to 3.8.1 is within noise. On Haiku every ruleset raises hidden reasoning; that tax is why billed savings trail the shorter answers.

**Full suite, repo runner.** `run-live.sh`, all 13 prompts × 2 seeds, 26 cells per arm, current ruleset ([raw cells](../benchmarks/results/raw-nov/)):

| | billed | 95% CI | answer length | answer lines | backfires |
|---|--:|--:|--:|--:|--:|
| caveman | 92% | 73–121% | 77% | 80% | 15 / 26 |
| ponytail | 97% | 76–124% | 55% | 53% | 13 / 26 |
| **Chisle 3.9** | **87%** | **75–101%** | 58% | 53% | **9 / 26** |

Chisle bills least and backfires least; ponytail's answers are as short (55% vs 58%, overlapping intervals). Separate runs of the same rival versions have differed by 10–30 points, so compare arms within a run, never across runs.

**Sonnet 5.5.** Bare vs Chisle 3.9, 34 cells ([raw cells](../benchmarks/results/raw-nov-sonnet/)): billed **57%** (95% CI 50–64%), answer length 54%, lines 55%, reasoning **84%**, backfires 5 / 34. Sonnet chooses how long to think, and with the ruleset it thinks less, so unlike Haiku nothing eats the shorter answers.

**Accuracy on Chisle 3.9.** Maths + coding ([raw](../benchmarks/quality/raw-nov/)): 156/156 vs bare 154/156, Fisher p = 0.498. Agentic, 7 fixtures × 6 seeds ([raw](../benchmarks/agentic/raw-nov/)): 38/42 vs 36/42 passed, p = 0.738, context 144.7k vs 148.5k tokens, $0.0503 vs $0.0506 per run. The coding grader used to mark a correct `deepEqual` wrong: test arguments crossed the `vm` realm boundary and failed a plain-object prototype check. Fixed before these cells were graded.

```bash
node benchmarks/run-ablation.js <dir> 2 4 vanilla caveman=<caveman SKILL.md> ponytail=<ponytail SKILL.md> chisle-3.8.1=<v3.8.1 SKILL.md> chisle=skills/chisle/SKILL.md
ARMS=vanilla,caveman,ponytail,chisle-3.8.1,chisle node benchmarks/pooled.js <dir>/*/
MODEL=claude-sonnet-5-5 node benchmarks/run-ablation.js <dir> 2 4 vanilla chisle=skills/chisle/SKILL.md
```

## Tool schemas: `npx chisle tools trim` (2026-11-07)

Same 7 agentic fixtures × 6 seeds, Haiku 4.5. `chisle-trim` is Chisle 3.9 plus the `permissions.deny` list `tools trim` writes for tools a coding loop never calls (Workflow, ScheduleWakeup, ReportFindings, ShareOnboardingGuide, SendFeedback) ([raw cells](../benchmarks/agentic/raw-nov/), `ARMS=vanilla,chisle,chisle-trim RAW_DIR=benchmarks/agentic/raw-nov node benchmarks/agentic/score.js`).

| | passed | first request | context per request | $ per request |
|---|--:|--:|--:|--:|
| bare | 36 / 42 | 21.8k | 24.7k | — |
| Chisle 3.9 | 38 / 42 | 22.0k | 25.8k | $0.00894 |
| **Chisle 3.9 + trim** | 36 / 42 | **18.9k** | **22.7k** | **$0.00801** |

The trim takes 3.1k tokens off every request (−14% on the first, −12% per request on average) and 10% off cost per request. Per run the cost looks flat ($0.0507 vs $0.0503) only because this arm happened to take more turns (6.29 vs 6.02). `Artifact`, the largest schema on the maintainer's machine (~10k tokens), loads only in interactive sessions and is not in this measurement.

**Where 38/42 became 36/42.** The trim arm failed `yagni` on 3 of 6 seeds and `dupepaths` on 3; Chisle 3.9 failed `dupepaths` on 4 and `yagni` on none. All three `yagni` failures are the fixture's planted trap: `RETRY_COUNT=0` returns 3 because the fix used `parseInt(x) || 3` instead of a null check. The bare model fell into the same trap on 3 of 6 seeds in the same run, and no arm ever called a denied tool, so the trim cannot have caused it: 6/6 for Chisle 3.9 was the lucky draw (p = 0.18 for 6/6 vs 3/6).

| fixture | bare | Chisle 3.9 | Chisle 3.9 + trim |
|---|--:|--:|--:|
| dupepaths | 3/6 | 2/6 | 3/6 |
| yagni | 3/6 | 6/6 | 3/6 |
| other five | 30/30 | 30/30 | 30/30 |

## Input axis: tool output and the prompt cache (2026-11-07)

**Compressor.** `node benchmarks/replay-compress.js` replays a session corpus through the shipped compressor, zero LLM calls. On the maintainer's 37 recent sessions (8,698 tool results, 13.7M chars): 150 outputs elided or scrubbed from 1.98M to 1.03M chars (**~48% each**), 7.1% of all session content. `Read`/`Edit`/`Write` are excluded by design; the largest untouched bucket is file views through `sed`/`cat`, which the model asked to see.

**Where the spend goes.** Over 8,459 API requests in 32 of those sessions, price-weighted: cache reads 75%, cache writes 17%, output (including thinking) 7.5%. Average context per request was 433k tokens, so what the context holds matters far more than what the model writes.

**Resume nudge (simulated).** The prompt cache lives about an hour; 135 times a context of 50k+ tokens was re-written from scratch after a break (median gap 222 min), 14% of spend. Replaying the same sessions with a compaction only at breaks over 60 minutes with 150k+ tokens of context, charging the summary read, its output and the re-written prefix, gives 52–56% of today's spend. Chisle shows the hint; the user decides.

**Tool schemas.** The same sessions' prompt snapshots show 114k chars of tool schemas on every request; tools never called in 30 days carried ~5.2k tokens (~15.1k with the once-used `Artifact`): ~1% and ~3% of total spend at this corpus' 433k average context, far more in shorter sessions.
