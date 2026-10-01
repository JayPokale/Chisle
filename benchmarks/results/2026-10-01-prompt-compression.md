# 2026-10-01 — Can the ruleset itself be written in shorthand?

Idea: the ruleset rides along on every request, so write it the way Chisle
asks the model to write — or further, in shorthand a human can barely read
but a model can. Tested against the current ruleset before shipping anything.

**Verdict: no.** Shorthand saves fewer tokens than characters suggest, and
the rules it weakens are the ones that make answers short. The current
readable ruleset stays.

## Prior work

- **LLMLingua** (Microsoft, EMNLP 2023) reaches up to 20x compression on
  context and demonstrations, but its budget controller deliberately keeps
  *instructions* at higher fidelity. A ruleset is nothing but instructions.
- **CDCT** (arXiv 2512.17920) separates constraint compliance from semantic
  accuracy under compression: constraint effects are 2.9x larger, and
  violations peak at medium compression.
- **A pre-registered trial** (arXiv 2603.23525): 50% retention cut total cost
  27.9%; 20% retention *raised* it 1.8%, because outputs grew. Output tokens
  have to be a first-class outcome.

## Arms

Same `##` headings in every arm, so either variant could drop in. Files are
in `raw-prompt-compression/`.

| arm | style | injected chars |
|-----|-------|---------------:|
| cur | current `SKILL.md` (48485e7), terse but readable | 3,317 |
| cmp | telegraphic: symbols, `→`, `>`, `\|`, no connectives | 2,411 (−27%) |
| ultra | shorthand: `-art -fill -plsnt`, `!skimp`, `b4`, `rsn=billed` | 1,584 (−52%) |

5 prompts from the default live suite plus 3 probes aimed at the rules a
compressed prompt is most likely to drop (a destructive op, an upload
endpoint that needs validation, a commit message that must stay normal
prose). 2 seeds, `claude-haiku-4-5-20251001`, same flags and isolation as
`run-live.sh`. Reproduce: `node benchmarks/results/raw-prompt-compression/run.js`.

## 1. Tokens: the tokenizer charges for shorthand

Ruleset cost = single-request input tokens minus the bare anchor (20,987).
Each arm's cells agree to within 10 tokens, apart from one cell per arm that
landed ~1,570 lower — a second variant of Claude Code's own prompt, also seen
in the bare anchor (19,421) — excluded.

| arm | ruleset tokens | vs cur | chars per token |
|-----|---------------:|-------:|----------------:|
| cur | 886 | — | 3.7 |
| cmp | 699 | −21% | 3.4 |
| ultra | 584 | **−34%** | **2.7** |

Halving the characters removed a third of the tokens. Abbreviations split
into more sub-word tokens per character than plain words do.

## 2. Behaviour: the structure rules leaked

Over the 10 suite answers per arm:

| | cur | cmp | ultra |
|---|--:|--:|--:|
| headings (rule: none unless asked) | 0 | 0 | **4** |
| bullet / numbered lines | 14 | 12 | **22** |
| visible answer chars | 8,643 | 9,953 (+15%) | **10,964 (+27%)** |
| billed output tokens | 100% | 89% | 92% |

Billed output includes hidden reasoning and moves ±50% per call at 2 seeds,
so the 89% / 92% are noise either way. The visible answers are not:
`-unasked hdr/bullet/numstep/tbl/recap` did not hold the way the spelled-out
rule does, and the user reads every extra line.

Probes: safety held in every arm. All six destructive-op answers say back up
first; all six upload endpoints check size and type. But ultra once followed
its commit message with *"Or more concisely, if you prefer:"* and a second
draft — exactly what "no double drafts" exists to stop — at 3x the length.

## 3. Why the saving is not worth it

The ruleset is a cached prefix. 300 tokens saved per request on Haiku 4.5
is one cache write plus cheap cache reads: about $0.0005 over a 5-request
agent run. Output is billed at 5x input, so a single answer growing by ~100
tokens costs the same. Ultra's answers grew by more than that.

That matches the trial above: past moderate compression, input savings are
eaten by longer outputs.

## Caveats

n = 2 seeds per prompt; this rules out a big win, not a small one. Haiku
only — a larger model might read shorthand more reliably. The probes are
graded by keyword, read by hand.
