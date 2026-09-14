# Does the ruleset make the answers better? — 2026-09-14

**Short answer: no, and it does not make them worse either.** Across 312
auto-graded single-turn cells and 120 agentic cells on real repos, the accuracy
difference between the bare agent and Chisle is indistinguishable from noise
(p = 1.000 on both). What survives is the cost side, and even that is smaller in
an agentic loop than the output-axis headline suggests.

This writeup exists because the existing suites measure how *short* the answers
are and grade correctness by hand at a ceiling (24/24). Neither can support a
claim about answer quality, so two new suites were built to test it directly.

Model: `claude-haiku-4-5-20251001`. Arms differ only in whether
`skills/chisle/SKILL.md` is appended as a system prompt. Isolated `HOME` +
config dir with credentials only, so no personal settings, plugins or
`CLAUDE.md` leak in. Cells with no counterpart in the other arm are excluded so
the seed sets stay matched.

## 1. Correctness: maths and coding

32 maths problems and 20 coding problems, 3 seeds per arm, 312 cells.
Maths is graded by exact match on a required `ANSWER:` line; code is graded by
unit tests the model never sees. No judge model is involved anywhere.

## Accuracy (auto-graded, no judge model)

| suite | arm | n | correct | accuracy | format-clean | mean output tokens | mean answer chars |
|-------|-----|--:|--------:|---------:|-------------:|-------------------:|------------------:|
| code base | vanilla | 36 | 35 | 97.2% | 100.0% | 933 | 447 |
| code base | chisle | 36 | 36 | 100.0% | 100.0% | 966 | 403 |
| code hard | vanilla | 24 | 24 | 100.0% | 100.0% | 1610 | 500 |
| code hard | chisle | 24 | 24 | 100.0% | 100.0% | 1454 | 474 |
| math base | vanilla | 60 | 60 | 100.0% | 81.7% | 501 | 444 |
| math base | chisle | 60 | 60 | 100.0% | 83.3% | 396 | 236 |
| math hard | vanilla | 36 | 36 | 100.0% | 100.0% | 635 | 562 |
| math hard | chisle | 36 | 36 | 100.0% | 100.0% | 538 | 345 |
| all | vanilla | 156 | 155 | 99.4% | 92.9% | 802 | 480 |
| all | chisle | 156 | 156 | 100.0% | 93.6% | 723 | 336 |

## Significance

vanilla 155/156, 95% CI 96.5%–99.9%
chisle  156/156, 95% CI 97.6%–100.0%
Fisher exact, two-sided: p = 1.000 — not separable from noise at this cell count.

## Items where the arms disagree (negative = Chisle worse)

| item | vanilla | chisle |
|------|--------:|-------:|
| code/deepequal | 2/3 | 3/3 |

## Every failed cell

| arm | suite | item | seed | why |
|-----|-------|------|-----:|-----|
| vanilla | code | deepequal | 1 | [{"x":1,"y":[1,2]},{"y":[1,2],"x":1}] -> false want true |


**Reading it.** Both arms are at the ceiling. The single failure in 312 cells is
the bare agent getting `deepEqual` wrong on key ordering. A one-cell difference
at n=156 per arm is nothing — the Fisher test says so, and it should be reported
as nothing.

The real finding here is the **cost column at unchanged accuracy**: maths runs
21% fewer output tokens (501 to 396) and the visible answer is 30% shorter
overall (480 to 336 chars), with correctness untouched. On coding the token
saving mostly vanishes — the base coding tier is actually 4% *more* expensive
under Chisle — because the answer is mostly a code block, and the ruleset
explicitly leaves code blocks alone.

The `format-clean` column tracks a separate thing: whether the reply obeyed the
requested output format exactly rather than writing `2 km/h` where `2` was
asked for. The arms are level there too (92.9% vs 93.6%).

## 2. Agentic: five repos, hidden tests

Five fixture repos, each with a planted trap, 12 seeds per arm, 120 cells. The
agent works with real tools in a copy of the repo; the test is copied in
afterwards. See [`../agentic/README.md`](../agentic/README.md) for what each
fixture traps.

## Hidden-test pass rate by fixture

| fixture | vanilla | chisle | Fisher p |
|---------|--------:|-------:|---------:|
| dupepaths | 4/12 | 4/12 | 1.000 |
| reuse | 12/12 | 12/12 | 1.000 |
| rootcause | 12/12 | 12/12 | 1.000 |
| stdlib | 12/12 | 12/12 | 1.000 |
| yagni | 9/12 | 8/12 | 1.000 |

## Overall

| arm | n | passed | pass rate | new files | net LOC | deps added | out tokens | context tokens | $ / run |
|-----|--:|-------:|----------:|----------:|--------:|-----------:|-----------:|---------------:|--------:|
| vanilla | 60 | 49 | 81.7% | 0.20 | 3.7 | 0.00 | 1171 | 67832 | 0.0269 |
| chisle | 60 | 48 | 80.0% | 0.20 | 2.9 | 0.00 | 1083 | 64695 | 0.0276 |

## Significance

vanilla 49/60, 95% CI 70.1%–89.4%
chisle  48/60, 95% CI 68.2%–88.2%
Fisher exact, two-sided: p = 1.000 — not separable from noise at this cell count.

## Every failed cell

| arm | fixture | seed | first failing assertion |
|-----|---------|-----:|-------------------------|
| chisle | dupepaths | 10 | FAIL receipt-neg -> "TOTAL $-4.50" want "TOTAL -$4.50" |
| chisle | dupepaths | 11 | FAIL receipt-neg -> "TOTAL $-4.50" want "TOTAL -$4.50" |
| chisle | dupepaths | 12 | FAIL receipt-neg -> "TOTAL $-4.50" want "TOTAL -$4.50" |
| chisle | dupepaths | 2 | FAIL receipt-neg -> "TOTAL $-4.50" want "TOTAL -$4.50" |
| chisle | dupepaths | 4 | FAIL receipt-neg -> "TOTAL $-4.50" want "TOTAL -$4.50" |
| chisle | dupepaths | 6 | FAIL receipt-neg -> "TOTAL $-4.50" want "TOTAL -$4.50" |
| chisle | dupepaths | 8 | FAIL receipt-neg -> "TOTAL $-4.50" want "TOTAL -$4.50" |
| chisle | dupepaths | 9 | FAIL receipt-neg -> "TOTAL $-4.50" want "TOTAL -$4.50" |
| chisle | yagni | 3 | FAIL zero -> 3 want 0 |
| chisle | yagni | 4 | FAIL zero -> 3 want 0 |
| chisle | yagni | 6 | FAIL zero -> 3 want 0 |
| chisle | yagni | 7 | FAIL zero -> 3 want 0 |
| vanilla | dupepaths | 1 | FAIL receipt-neg -> "TOTAL $-4.50" want "TOTAL -$4.50" |
| vanilla | dupepaths | 10 | FAIL receipt-neg -> "TOTAL $-4.50" want "TOTAL -$4.50" |
| vanilla | dupepaths | 12 | FAIL receipt-neg -> "TOTAL $-4.50" want "TOTAL -$4.50" |
| vanilla | dupepaths | 2 | FAIL receipt-neg -> "TOTAL $-4.50" want "TOTAL -$4.50" |
| vanilla | dupepaths | 3 | FAIL receipt-neg -> "TOTAL $-4.50" want "TOTAL -$4.50" |
| vanilla | dupepaths | 5 | FAIL receipt-neg -> "TOTAL $-4.50" want "TOTAL -$4.50" |
| vanilla | dupepaths | 6 | FAIL receipt-neg -> "TOTAL $-4.50" want "TOTAL -$4.50" |
| vanilla | dupepaths | 8 | FAIL invoice-neg -> "Refund: -$4.5" want "Refund: -$4.50" |
| vanilla | yagni | 11 | FAIL zero -> 3 want 0 |
| vanilla | yagni | 3 | FAIL zero -> 3 want 0 |
| vanilla | yagni | 5 | FAIL zero -> 3 want 0 |


**Reading it.** A dead heat: 49/60 against 48/60. Three of the five fixtures are
perfect in both arms, so they discriminate nothing at this model and only serve
as regression guards. `dupepaths` — the trap where the money format is inlined
in two of three render paths — is the one fixture that is genuinely hard, and
both arms fail it two thirds of the time. "Grep every caller before editing" is
in the ruleset, and on this evidence it does not change the behaviour.

The cost picture in a real loop is much flatter than the output-axis numbers:
7.5% fewer output tokens, 4.6% less context pulled in, and dollar cost per run
that is a rounding error apart (and nominally *higher* for Chisle, since cost is
dominated by cached input, not generation).

## What went wrong on the way, and why it is in this file

Two measurement bugs were found and fixed while running this, both of which had
initially produced a flattering result:

1. **A mid-run usage limit** wrote 89 refusal messages into the results as if
   they were answers. They scored as "the agent changed nothing" — a fake
   failure in both arms. Both runners now detect a limit refusal, refuse to
   record the cell, and stop the run.
2. **The maths grader rejected correct answers** for wearing a unit (`2 km/h`)
   or a sign (`+18.8`). Four of the first five "failures" were mine, not the
   model's. Grading now takes the value and reports format compliance
   separately.

An interim read at 5 seeds showed 84% vs 76% on the agentic suite and it was
tempting to stop there. Seven more seeds erased it. That is the entire argument
for keeping the significance test in the scorer output.

## Honest summary

| claim | verdict on this evidence |
|-------|--------------------------|
| Better answers than a bare agent | **Not supported.** p = 1.000 on both suites. |
| No correctness cost for the brevity | **Supported.** 156/156 vs 155/156 single-turn, 48/60 vs 49/60 agentic. |
| Substantially cheaper output | **Supported for prose-shaped answers** (maths -21%, chars -30%), **not for code** (base coding tier +4%). |
| Cheaper in an agentic loop | **Barely.** -4.6% context, and $/run is a wash. |
| Reuse / root-cause / YAGNI discipline | **Not measurable here.** The three ladder fixtures are 12/12 in both arms; the one hard fixture is a tie. |

Reproduce: `node benchmarks/quality/run.js && node benchmarks/quality/grade.js`
and `node benchmarks/agentic/run.js && node benchmarks/agentic/score.js`. Raw
cells are committed.
