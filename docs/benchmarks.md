# Benchmarks

Every result behind the [README](../README.md), in full. Each figure is recomputed from the committed raw cells by the scripts named beside it; nothing is estimated except where a section says "simulated". Earlier rounds (June–October 2026, rulesets up to v3.8) are retired; they stay in the git history.

## Correction (2026-11-23): the tools-off answer runs

The output-axis runs (`run-ablation.js`, `run-live.sh`) call Claude Code with tools switched off, but several prompts say "our app" or "our auth middleware". In every arm, the bare model included, Haiku often answered by writing fake tool-call text (`<function_calls>…`) that ends the turn instead of an answer, and the scorer counted those cells as answers. Cells affected, by run: [`raw-314-sidebyside`](../benchmarks/results/raw-314-sidebyside/) bare 12 / 26, caveman 11, ponytail 10, Chisle 3.13 6, Chisle 8; [`raw-314-sonnet`](../benchmarks/results/raw-314-sonnet/) bare 8 / 24, Chisle 7 / 26; [`raw-314-ladder`](../benchmarks/results/raw-314-ladder/) bare 10 / 24, caveman 11, ponytail 10, Chisle 9; [`raw-nov-sidebyside`](../benchmarks/results/raw-nov-sidebyside/) bare 13 / 27, caveman 6, ponytail 9, Chisle 3.8.1 7, Chisle 7; [`raw-nov`](../benchmarks/results/raw-nov/) bare 8 / 26, caveman 8, ponytail 3, Chisle 4; [`raw-nov-sonnet`](../benchmarks/results/raw-nov-sonnet/) bare 10 / 35, Chisle 8 / 36. Every output-axis and Sonnet figure in the sections below compares answers with aborted tool calls and is superseded by the clean rerun; the cells stay for the record. Since this date every prompt ends with the same note for every arm ("Standalone question: there is no codebase and no tool access here."), and [`pooled.js`](../benchmarks/pooled.js) counts fake tool calls as non-answers and judges code answers by prompt kind (its length rule had also counted short code answers as non-answers). Unaffected: the agentic runs (tools on), the accuracy suite (a required answer format, graded; no cell failed it) and the input axis (no model calls).

## Output axis, clean rerun (2026-11-23)

Haiku 4.5, Claude Code 2.1.323, tools off with the standalone note, all arms in one session. Rivals: caveman `ef6050c5e184`, ponytail 4.8.3. No arm gave a fake tool call or a non-answer. Pooled sums vs the bare model, 95% bootstrap intervals ([`pooled.js`](../benchmarks/pooled.js)).

**Main suite**, the 13 `run-live.sh` prompts × 3 seeds, 39 answers per arm ([raw cells](../benchmarks/results/raw-314-direct/), [every prompt and answer](../benchmarks/results/raw-314-direct/ANSWERS.md)). The README chart is built from it.

| | billed | 95% CI | answer length | 95% CI | answer lines | reasoning | backfires |
|---|--:|--:|--:|--:|--:|--:|--:|
| caveman | 96% | 83–111% | 76% | 68–83% | 81% | 156% | 19 / 39 |
| ponytail | 115% | 96–136% | 70% | 61–79% | 61% | 248% | 24 / 39 |
| **Chisle 3.14** | **91%** | **78–106%** | **61%** | **53–70%** | **55%** | 179% | **16 / 39** |
| chisle-C (not shipped) | 92% | 81–105% | 62% | 54–70% | 57% | 183% | 12 / 39 |

**Ladder suite**, 12 coding asks where the platform already has the answer plus three root-cause fixes (`SUITES=ladder`, committed before its first run), × 2 seeds, 24 answers per arm ([raw cells](../benchmarks/results/raw-314-ladder-direct/), [every prompt and answer](../benchmarks/results/raw-314-ladder-direct/ANSWERS.md)).

| | billed | 95% CI | answer length | 95% CI | answer lines | reasoning | backfires |
|---|--:|--:|--:|--:|--:|--:|--:|
| caveman | 92% | 74–114% | 72% | 65–80% | 72% | 122% | 6 / 24 |
| ponytail | 106% | 88–126% | 57% | 47–67% | 47% | 181% | 13 / 24 |
| **Chisle 3.14** | **90%** | **78–105%** | **51%** | **44–59%** | **42%** | 151% | 7 / 24 |

Chisle writes the shortest answers in both suites, and that gap is outside the noise (main suite 61% vs caveman 76%). Billed tokens favour Chisle too, but narrowly (91% vs 96%, 90% vs 92%) and inside the intervals: on Haiku every ruleset raises hidden reasoning, which eats most of the shorter answers. `chisle-C` ([its text](../benchmarks/results/raw-314-direct/chisle-C.SKILL.md)) is a 1.6k-character rewrite of the ruleset aimed at that reasoning; it made no difference, and an earlier run where it beat caveman was itself contaminated by fake tool calls. It also scored 156/156 on the accuracy suite.

```bash
node benchmarks/run-ablation.js benchmarks/results/raw-314-direct 3 6 vanilla caveman=<caveman SKILL.md> ponytail=<ponytail SKILL.md> chisle=skills/chisle/SKILL.md chisle-C=benchmarks/results/raw-314-direct/chisle-C.SKILL.md
SUITES=ladder node benchmarks/run-ablation.js benchmarks/results/raw-314-ladder-direct 2 6 vanilla caveman=<caveman SKILL.md> ponytail=<ponytail SKILL.md> chisle=skills/chisle/SKILL.md
ARMS=vanilla,caveman,ponytail,chisle,chisle-C node benchmarks/pooled.js benchmarks/results/raw-314-direct/*/
node scripts/build-chart.js
```

## Chisle 3.14 (2026-11-19)

The full suite again, with Chisle 3.13 beside 3.14. The two ship the same ruleset (unchanged since 3.10), so wherever only the ruleset is measured, the gap between them is run-to-run noise; they differ only in the hooks, which the agentic and input-axis sections measure. Rivals: caveman `ef6050c5e184`, ponytail 4.8.3, as before. Some results go against Chisle and are reported as measured.

**Output axis, side by side.** Haiku 4.5, Claude Code, tools off, the 13 `run-live.sh` prompts × 2 seeds, 26 answers per arm, all five arms in one session ([raw cells](../benchmarks/results/raw-314-sidebyside/), [every prompt and answer](../benchmarks/results/raw-314-sidebyside/ANSWERS.md)). Pooled sums vs the bare model, 95% bootstrap intervals ([`pooled.js`](../benchmarks/pooled.js)).

| | billed | 95% CI | answer length | 95% CI | answer lines | reasoning | backfires | non-answers |
|---|--:|--:|--:|--:|--:|--:|--:|--:|
| caveman | 69% | 56–84% | 56% | 44–68% | 67% | 144% | 9 / 26 | 4 |
| ponytail | 80% | 64–105% | 63% | 49–82% | 67% | 182% | 14 / 26 | 4 |
| Chisle 3.13 | 70% | 57–87% | 47% | 38–59% | 49% | 204% | 8 / 26 | 3 |
| **Chisle 3.14** | **69%** | **59–81%** | **51%** | **43–59%** | **46%** | **172%** | **7 / 26** | **0** |

Billed tokens tie with caveman this run (69% each, against 87% for caveman in the 3.9 run). Chisle writes the shortest answers, backfires least and is the only arm that answered every prompt. On the 20 prompts every arm answered: billed Chisle 3.14 75%, caveman 77%, Chisle 3.13 80%, ponytail 92%. Hidden reasoning rises with every ruleset on Haiku, as before.

**Sonnet 5.5.** Bare vs Chisle 3.14, 12 prompts × 2 seeds ([raw cells](../benchmarks/results/raw-314-sonnet/), [every prompt and answer](../benchmarks/results/raw-314-sonnet/ANSWERS.md)): billed **53%** (95% CI 44–63%), answer length 49% (40–59%), lines 51%, reasoning 102%, backfires 4 / 24. The 13th prompt, `authflow`, is out of both arms: the bare model's answer ran past the runner's 4-minute limit on three tries.

**Accuracy.** Maths + coding, 52 problems × 3 seeds, Haiku 4.5 ([raw](../benchmarks/quality/raw-314/)): bare 156/156, Chisle 3.14 156/156, no item scored differently. Chisle used 85% of the bare model's output tokens and wrote answers 79% as long.

**Agentic.** 7 fixtures × 5 seeds, Haiku 4.5, ruleset plus each version's own hooks, paired by fixture and seed ([raw cells](../benchmarks/agentic/raw-314/); the 3.13 arm ran from a `v3.13.0` checkout with its own runner and `plugin.json`). Ratios are pooled vs the bare agent with 95% paired-bootstrap intervals.

| | passed | context / run | cost / run | turns | tool output read |
|---|--:|--:|--:|--:|--:|
| bare agent | 31 / 35 | 147.5k | $0.0487 | 5.80 | 6,924 chars |
| Chisle 3.13 | 32 / 35 | 163.6k (111%, 95–127%) | $0.0531 (**109%, 102–117%**) | 6.17 | 7,442 chars |
| **Chisle 3.14** | 31 / 35 | **143.3k (97%, 83–110%)** | $0.0510 (105%, 95–114%) | 5.46 | 5,965 chars |

3.14 vs 3.13 directly: context **88%** (78–98%), tool output read **80%** (54–94%), turns 88% (77–100%), cost 96% (89–104%). The change is the PreToolUse wrapper: on `noisylog`, whose `npm test` fails, the agent read 76,111 chars of tool output bare, 57,548 with 3.13 and **6,862** with 3.14. Against the bare agent, 3.13 cost 9% more (an interval clear of 100%); 3.14's 5% is inside the noise. Pass rates do not separate (Fisher p = 1.0).

**Noisy-command tasks, against the rivals (2026-11-23).** Three agentic fixtures where the agent has to run commands with large output: `noisylog` (a failing `npm test`, 17k-char log), `greensuite` (add hour units to a parser and keep a 391-test suite green, 16k chars per `npm test`) and `gitregress` (a 159-line refactor commit, 16.5k-char diff, hides a tax-before-discount bug; the fix must keep the commit's renames). `greensuite` and `gitregress` were added on 2026-11-23, before any run that includes them. Haiku 4.5, Claude Code 2.1.323, 3 seeds; arms are the bare agent, caveman and ponytail (each skill appended as a system prompt) and Chisle 3.14 (ruleset plus its shipped hooks). No arm uses RTK. All 36 runs passed the hidden test. Raw cells: [`raw-noisylog`](../benchmarks/agentic/raw-noisylog/), [`raw-commands`](../benchmarks/agentic/raw-commands/); the README's cost chart is built from them.

| cost / run | bare agent | caveman | ponytail | **Chisle 3.14** |
|---|--:|--:|--:|--:|
| `noisylog` | $0.0698 | 109% | 93% | **73%** |
| `greensuite` | $0.0739 | 98% | 112% | **80%** |
| `gitregress` | $0.0914 | 155% | 119% | **111%** |
| all three, total | $0.2351 | 123% | 109% | **90%** |

| tool output read / run | bare agent | caveman | ponytail | **Chisle 3.14** |
|---|--:|--:|--:|--:|
| `noisylog` | 12,108 chars | 17,934 | 11,837 | **1,423** |
| `greensuite` | 16,656 | 17,320 | 17,450 | **2,024** |
| `gitregress` | 18,379 | 36,228 | 27,399 | **9,177** |

Chisle is the cheapest ruleset on all three tasks but costs more than the bare agent on `gitregress`. No run there read the whole diff (each went file by file), so the filters saved mainly on `npm test` (11,555 → 103 chars); two of the three Chisle runs first opened the wrong commit and took 20 and 18 turns ($0.129, $0.117), the third 9 ($0.060). With 3 seeds a cell, per-task gaps under about 20% are noise.

**Input axis.** Deterministic, no model calls.

- Command corpus, 37 commands (14 held out, written before the 3.14 filters), chars the model reads ([`replay-commands.js`](../benchmarks/replay-commands.js), `CHISLE_PREV=<v3.13.0 checkout>` for the 3.13 arm): bare 100%, Chisle 3.12 (no filters) 57%, Chisle 3.13 47%, **Chisle 3.14 28%**, RTK 0.42.4 84%, RTK + Chisle 3.14 27%. Held out only: 3.13 34%, 3.14 31%, RTK 84%. Failed runs: 3.13 100% (untouched), 3.14 5%, RTK 92%. Chisle 3.14's output is smaller than RTK's on 31 commands, RTK's on 5, and 1 ties; RTK's five are where it drops information (directory names in `wc`, `.` in `ls`, a 7-char hash, three missing commit headers in `git log --stat`). caveman and ponytail are rulesets with no tool-output hook, so they read 100% by construction. Per-command data: [`raw-314-commands/commands.json`](../benchmarks/results/raw-314-commands/commands.json); the README's terminal chart is built from it (`node scripts/build-chart.js`).
- Real sessions, the maintainer's 33,449 tool results (50.8M chars), replayed through the compressor ([`replay-compress.js`](../benchmarks/replay-compress.js)): saved 3.70M chars with filters off, 3.71M with 3.13's filters, **3.85M** with 3.14's. Small, because those sessions already ran under RTK and most of their Bash calls are `python3`, `sed` and `cat`.

```bash
node benchmarks/run-ablation.js benchmarks/results/raw-314-sidebyside 2 4 vanilla caveman=<caveman SKILL.md> ponytail=<ponytail SKILL.md> chisle-3.13=<v3.13.0 SKILL.md> chisle=skills/chisle/SKILL.md
ARMS=vanilla,caveman,ponytail,chisle-3.13,chisle node benchmarks/pooled.js benchmarks/results/raw-314-sidebyside/*/
MODEL=claude-sonnet-5-5 node benchmarks/run-ablation.js benchmarks/results/raw-314-sonnet 2 4 vanilla chisle=skills/chisle/SKILL.md
RAW_DIR=benchmarks/quality/raw-314 node benchmarks/quality/run.js claude-haiku-4-5-20251001 3 4
ARMS=vanilla,chisle-hook RAW_DIR=benchmarks/agentic/raw-314 node benchmarks/agentic/run.js claude-haiku-4-5-20251001 5 5
ARMS=vanilla,chisle-hook-3.13,chisle-hook RAW_DIR=benchmarks/agentic/raw-314 node benchmarks/agentic/score.js
FIXTURES=greensuite,gitregress ARMS=vanilla,caveman,ponytail,chisle-hook RAW_DIR=benchmarks/agentic/raw-commands node benchmarks/agentic/run.js claude-haiku-4-5-20251001 3 6
CHISLE_PREV=<v3.13.0 checkout> node benchmarks/replay-commands.js <fixtures-dir>
node benchmarks/answers.js benchmarks/results/raw-314-sidebyside
```

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

**Skill descriptions.** `tools trim` also lists skills the model never invoked as `skillOverrides: "name-only"`. Base request ("Say OK", Haiku 4.5): with the maintainer's config, 65 unused skills name-only took it from 24,185 to 23,248 tokens (−937). In the isolated benchmark harness, which loads only Claude Code's bundled skills, the saving is ~110 tokens, below that harness's startup variance (it loads 15–31 skills depending on sync timing, about ±1k tokens), so no agentic arm was run for it. Errors cannot rise from it: across all 126 agentic runs no skill was ever invoked, and a name-only skill stays callable.

## Input axis: tool output and the prompt cache (2026-11-07)

**Compressor.** `node benchmarks/replay-compress.js` replays a session corpus through the shipped compressor, zero LLM calls. On the maintainer's 37 recent sessions (8,698 tool results, 13.7M chars): 150 outputs elided or scrubbed from 1.98M to 1.03M chars (**~48% each**), 7.1% of all session content. `Read`/`Edit`/`Write` are excluded by design; the largest untouched bucket is file views through `sed`/`cat`, which the model asked to see.

**Where the spend goes.** Over 8,459 API requests in 32 of those sessions, price-weighted: cache reads 75%, cache writes 17%, output (including thinking) 7.5%. Average context per request was 433k tokens, so what the context holds matters far more than what the model writes.

**Resume nudge (simulated).** The prompt cache lives about an hour; 135 times a context of 50k+ tokens was re-written from scratch after a break (median gap 222 min), 14% of spend. Replaying the same sessions with a compaction only at breaks over 60 minutes with 150k+ tokens of context, charging the summary read, its output and the re-written prefix, gives 52–56% of today's spend. Chisle shows the hint; the user decides.

**Tool schemas.** The same sessions' prompt snapshots show 114k chars of tool schemas on every request; tools never called in 30 days carried ~5.2k tokens (~15.1k with the once-used `Artifact`): ~1% and ~3% of total spend at this corpus' 433k average context, far more in shorter sessions.
