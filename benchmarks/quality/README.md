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
fills gaps. Raw model output is committed under `raw-nov/` for audit; point `RAW_DIR` at a fresh directory when the ruleset changes.

## Results (Chisle 3.9, 2026-11-06)

Regenerated from the committed `raw-nov/` by `RAW_DIR=benchmarks/quality/raw-nov node benchmarks/quality/grade.js`, Haiku 4.5, 3 seeds.

| suite | arm | n | correct | accuracy | format-clean | mean out tokens | mean answer chars |
|-------|-----|--:|--------:|---------:|-------------:|----------------:|------------------:|
| math base | vanilla | 60 | 59 | 98.3% | 85.0% | 468 | 403 |
| math base | chisle | 60 | 60 | 100.0% | 85.0% | 410 | 260 |
| math hard | vanilla | 36 | 36 | 100.0% | 100.0% | 612 | 509 |
| math hard | chisle | 36 | 36 | 100.0% | 100.0% | 519 | 341 |
| code base | vanilla | 36 | 36 | 100.0% | 100.0% | 1100 | 420 |
| code base | chisle | 36 | 36 | 100.0% | 100.0% | 968 | 408 |
| code hard | vanilla | 24 | 23 | 95.8% | 100.0% | 1480 | 478 |
| code hard | chisle | 24 | 24 | 100.0% | 100.0% | 1356 | 472 |
| **all** | vanilla | 156 | 154 | 98.7% | 94.2% | 803 | 443 |
| **all** | **chisle** | 156 | **156** | **100.0%** | 94.2% | **709** | **345** |

vanilla 154/156, 95% CI 95.4%–99.6%; chisle 156/156, 95% CI 97.6%–100.0%. Fisher exact, two-sided: **p = 0.498**.

**This is a null result on accuracy, and that is the claim.** Two vanilla misses do not make Chisle more accurate. What separates the arms is size at equal correctness: 345 vs 443 mean answer chars (−22%) and 709 vs 803 mean output tokens (−12%).

Code items are run inside a `vm` context with their arguments built in that same realm; built outside it, a correct plain-object check (`Object.getPrototypeOf(x) === Object.prototype`) fails, which once marked a right `deepEqual` wrong.

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
