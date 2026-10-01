# 2026-10-01 — Live re-run: the headline, re-measured

The published headline (Chisle 52% of a bare model's 20-task bill) came from
June–July cells. Two problems surfaced while trimming the ruleset:

1. **One outlier baseline carried it.** The June bare `cache` answer billed
   4,910 tokens (a 150-line class for a codebase it never saw). Every later run
   of the same prompt billed 375–813. Chisle's own totals on those six prompts
   barely moved across runs (3,041 / 3,738 / 3,320 / 4,278); the June baseline
   did (9,093 / 4,815 / 5,753 / 3,789).
2. **Some cells were possibly primed.** The ruleset carried an example "Add a
   cache for API responses" from 2026-06-18, before every run of `cache`; the
   auth-expiry example predates the July re-run of `auth-bug`; the deadlock
   example landed in the same commit as the Sonnet `deadlock` cells. Without
   those four cells the old aggregate is 70%, not 52%.

So: re-run with the shipped ruleset (48485e7: no example overlaps any suite),
the current harness, and current versions of the rivals.

## Method

`run-live.sh`, unchanged except for finding caveman's newer plugin layout.
Default suite (6 prompts) + `SUITE=large` (7 prompts that want a long answer,
never run before), 2 seeds each = 26 cells per arm. `claude-haiku-4-5-20251001`,
Claude Code 2.1.285, isolated config, arms differ only in the appended ruleset.
Rivals: caveman `ef6050c5e184`, ponytail 4.8.3 (installed plugin cache).
Cells: `raw-oct/{default,large}-s{1,2}/`.

`billed` is `usage.output_tokens` and includes reasoning; Claude Code now
reports reasoning separately (`modelUsage.thinkingTokens`), so `visible` is
billed minus reasoning. Totals are sums, so long answers weigh more.

## Results

| % of bare (n=26) | caveman | ponytail | **chisle** |
|---|--:|--:|--:|
| billed output | 102% | 105% | **83%** |
| 95% CI (bootstrap over cells) | 79–128% | 86–129% | **69–95%** |
| visible answer | 105% | 97% | **76%** |
| reasoning | 93% | 133% | 107% |
| answer lines | 112% | 107% | **81%** |
| coding (n=14) | 100% | 120% | **76%** |
| explanation (n=12) | 106% | 86% | 91% |
| short answers (n=13) | 104% | 141% | 106% |
| long answers (n=13) | 102% | 97% | **77%** |
| backfires (cell above bare) | 15/26 | 16/26 | **11/26** |
| worst cell | 305% | 493% | **170%** |
| average cell | 113% | 124% | **93%** |

## Reading it

- **Chisle is the only arm measurably below a bare model.** Its interval
  excludes 100%; neither rival's does. The saving is real and about a third
  of the old headline: −17% billed, −24% visible.
- **It pays on long answers, not short ones.** 77% on long answers, 106% on
  short ones. A three-line reply has nothing to cut.
- **It does not cut reasoning** (107%). The rules shorten what is written,
  not what is thought; the "Thinking Is Billed Too" rule shows no effect here.
- **Single cells swing hard.** The same prompt and arm moved 57% → 135%
  between seeds (`csvpipeline`). Read the aggregate, not a cell — which is
  exactly what went wrong with June's `cache`.
- The June–July numbers stay published as what they were, with this note.
