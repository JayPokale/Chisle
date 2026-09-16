# Correctness benchmark (maths + coding)

The live 4-arm suite in `../` measures **cost**. This one measures whether the
ruleset changes how often the model is **right**, because "44% of the tokens" is
only interesting if the answer still lands.

Two arms, one variable. Both get a byte-identical prompt and model; `chisle`
additionally gets `skills/chisle/SKILL.md` (frontmatter stripped) appended as a
system prompt — exactly what the shipped skill injects. Personal config, plugins
and `CLAUDE.md` are neutralised via an isolated `HOME` + config dir holding only
credentials.

```bash
node benchmarks/quality/run.js [model] [seeds] [parallel]   # default: haiku, 3 seeds, 8-way
node benchmarks/quality/grade.js                            # tables to stdout
node benchmarks/quality/grade.js --json                     # per-cell rows
```

Runs are resumable — a cell whose raw JSON exists is skipped, so a re-run only
fills gaps. Raw model output is committed under `raw/` for audit.

## Results

Regenerated from the committed `raw/` by `grade.js` — deterministic, no tokens
spent.

| suite | arm | n | correct | accuracy | format-clean | mean out tokens | mean answer chars |
|-------|-----|--:|--------:|---------:|-------------:|----------------:|------------------:|
| math base | vanilla | 60 | 60 | 100.0% | 81.7% | 501 | 444 |
| math base | chisle | 60 | 60 | 100.0% | 83.3% | 396 | 236 |
| math hard | vanilla | 36 | 36 | 100.0% | 100.0% | 635 | 562 |
| math hard | chisle | 36 | 36 | 100.0% | 100.0% | 538 | 345 |
| code base | vanilla | 36 | 35 | 97.2% | 100.0% | 933 | 447 |
| code base | chisle | 36 | 36 | 100.0% | 100.0% | 966 | 403 |
| code hard | vanilla | 24 | 24 | 100.0% | 100.0% | 1610 | 500 |
| code hard | chisle | 24 | 24 | 100.0% | 100.0% | 1454 | 474 |
| **all** | vanilla | 156 | 155 | 99.4% | 92.9% | 802 | 480 |
| **all** | **chisle** | 156 | **156** | **100.0%** | 93.6% | **723** | **336** |

vanilla 155/156, 95% CI 96.5%–99.9%; chisle 156/156, 95% CI 97.6%–100.0%.
Fisher exact, two-sided: **p = 1.000**.

**This is a null result on accuracy, and that is the claim.** The one vanilla
miss is a single cell (`code/deepequal`, seed 1) and does not make Chisle more
accurate. What does separate the arms is size at equal correctness: 336 vs 480
mean answer chars (-30%) and 723 vs 802 mean output tokens (-10%).

One asymmetry worth naming: on `math base` the chisle arm is *more*
format-clean (83.3% vs 81.7%), and on `code base` it is the vanilla arm that
drops a cell. Both differences are within noise at this n.

## What is graded, and how

| suite | items | base | hard | grading |
|-------|------:|-----:|-----:|---------|
| maths | 32 | 20 | 12 | The reply must end with `ANSWER: <value>`. Exact match against the key after stripping `$ , %` and trailing zeros. No partial credit. |
| coding | 20 | 12 | 8 | The single fenced JS block is extracted and the named function is run against unit tests **the model never sees**. Every case must pass. |

Counts are `math.json` (32) and `code.json` (20), each split into a `base` and a
`hard` tier. At the default 3 seeds that is 156 graded cells per arm.

No judge model anywhere. Both graders are deterministic, so the numbers are
reproducible from the committed `raw/` without spending a token.

The maths items are multi-step word problems (rates, mixtures, work, compound
interest, clock angles) where the arithmetic is easy but the setup is not — the
place where a terseness instruction could plausibly do damage by suppressing
intermediate reasoning. The coding items each carry at least one edge case
(empty input, a rotation larger than the array, an unsorted interval list) that
a hasty answer misses.

## Reading the failure table

`grade.js` prints **every** failed cell with the assertion that killed it, in
both arms. That is deliberate: an accuracy number without its losses is a
marketing claim, not a measurement.
