# 2026-10-01 — The cases where Chisle costs more: fixable or noise?

The re-run had Chisle bill more than a bare model on 11 of 26 cells, and an
agent loop cost ~4% more. Question: which of those can a rule change fix?

## The cells, read one by one

Three of the 11 were within 3–38 tokens of bare. The large ones split into:

- **Explanation tails** (`rest-graphql` 9 → 24 lines, `architecture`, `postmortem`,
  `pooling`): Chisle closed with a recommendation, a threshold or "key elements"
  the prompt never asked for. Suspects: the compare rule demands a *verdict*, and
  "keep every gotcha, caveat" invites extras.
- **A reasoning spike** (`csvpipeline`: thinking 236 → 1,668) ending in a request
  for permission instead of an answer.
- **A clarifying question** (`authflow`): the "ask before the full version" rule.

## A fix, tested: rejected

Variant: "verdict only if asked. Stop once it's answered: no closing tips,
thresholds, recaps or offers." 5 of the backfiring prompts x 3 seeds, Haiku 4.5,
bare / current / fix in one batch. Cells and both rulesets: `raw-backfires/`;
reproduce with `node benchmarks/results/raw-backfires/run.js`.

| 15 cells per arm | billed output | visible chars | lines | backfires |
|---|--:|--:|--:|--:|
| bare | 100% | 100% | 695 | — |
| current | **82%** | **70%** | **359** | 6 / 15 |
| fix | 95% | 83% | 452 | 7 / 15 |

The fix did not help. Per prompt the seeds overlap almost completely
(`rest-graphql`: current 627 / 506 / 459, fix 491 / 634 / 563).

## Why: most backfires are noise

Control: the bare model against itself across seeds. In the re-run it "backfires"
on **13 of 26** cells, in this batch on **15 of 30**: the same prompt varies
**0.18x to 5.57x** between runs. A tool genuinely at 83% of bare would show
~30% backfires from that noise alone; Chisle's 11/26 (42%) is within sampling
error of it. A single cell above 100% says almost nothing; only totals do.

## The one systematic cost, sized

Every request carries the ~900-token ruleset. In the agentic fixtures, with a
~20k prompt, that is ~4%. Across 5,591 requests in one developer's real Claude
Code sessions the median prompt is 248k tokens, so the same 900 tokens are
**0.4%**, and they are a cached prefix billed at a tenth of the input price.
Shrinking them further was tested the same day and weakened the rules
(`2026-10-01-prompt-compression.md`).

## Verdict

No rule change shipped. The ruleset stays as is; what changes is how the numbers
are stated: totals with intervals, backfires next to the bare-vs-bare control.
