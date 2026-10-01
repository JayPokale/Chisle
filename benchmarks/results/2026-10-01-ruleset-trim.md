# 2026-10-01 — Ruleset trim: did it keep the savings?

The agentic run (2026-09-14) left Chisle's cost per run *above* the bare agent.
Diagnosis: the ruleset is re-sent on every request (~5 per agentic run), so its
own size ate most of what the behaviour saved. It was cut from 6,725 to ~3,300
injected chars. This is a small live check that the cut kept the savings.

Method: 5 prompts from the default live suite (3 coding, 2 explanation), 2
seeds, `claude-haiku-4-5-20251001`, same flags and isolated config as
`run-live.sh`. Arms differ only in the appended ruleset:

| arm | ruleset |
|-----|---------|
| bare | none |
| old | `72eb75a^` — before the trim |
| trim | `72eb75a` — first cut |
| revised | `48485e7` — trim plus two restored structure cues and neutral examples |

Reproduce: `node benchmarks/results/raw-trim/run.js`. Cells in `raw-trim/`
(the arm keys there are `vanilla`, `old`, `new`, `new2`).

## Ruleset cost per request — the solid number

Input tokens (input + cache read + cache creation) of the single-request cells:

| arm | input tokens | ruleset cost |
|-----|-------------:|-------------:|
| bare | 20,985–20,992 | — |
| old | 22,763–22,772 | **+1,779** |
| trim | 21,788–21,793 | +803 |
| revised | 21,862–21,869 | **+877** |

Ranges are tight (four cells each), so this one is measured, not estimated:
**−51% per request.** One revised cell came in at 20,302, below bare, so Claude
Code's own prompt differed for that call; it is excluded from the range above.

## Output — directional only

`out` is billed output tokens and includes hidden reasoning. n = 2 seeds per
task; a single call varies by ±50%, so none of these differences is separable
from noise.

| segment | bare | old | trim | revised |
|---------|-----:|----:|-----:|--------:|
| coding out (n=6) | 100% | 85% | 85% | **75%** |
| explanation out (n=4) | 100% | 102% | 118% | 132% |
| explanation answer lines | 76 | 28 | 60 | 39 |
| all out (n=10) | 100% | 90% | 94% | 90% |
| single-turn $ (n=10) | 100% | 107% | 99% | 101% |

## Reading it

- **The trim's reason holds.** Per-request overhead halved. In one-shot calls
  that is a small slice of Claude Code's ~21k base prompt; in an agent loop it
  is paid on every request, which is where the 2026-09-14 cost went.
- **The first cut regressed explanations.** Answer lines doubled (28 → 60),
  with numbered steps back in. It had dropped "numbered steps" and "two tight
  paragraphs beat five headed sections"; restoring them brought lines to 39.
- **Explanation output tokens did not come back down** (132%). The visible
  answers are short — one `rest-graphql` cell billed 873 tokens for a 5-line
  answer — so the gap is reasoning variance at n = 4, not answer length. Not
  claimed either way.
- **The old ruleset was partly taught to the test.** Its examples answered
  `rest-graphql` and the auth expiry bug almost verbatim, and a third matched
  the Sonnet suite's `deadlock`. The revised examples (timezone bug, CDN)
  appear in no suite, so the old arm's explanation numbers here are flattered.
- **Agent loop, measured afterwards:** the trim did not make loops cheaper.
  Pass rate tied (28/36 each), but context ran +16% and cost per run +6.8%:
  easy fixtures cost ~4% more (ruleset size x requests), and Chisle took 9%
  more turns, each re-sending the whole context. See
  [`../agentic/README.md`](../agentic/README.md).
