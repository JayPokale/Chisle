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

## What is graded, and how

| suite | n | grading |
|-------|--:|---------|
| maths | 20 | The reply must end with `ANSWER: <value>`. Exact match against the key after stripping `$ , %` and trailing zeros. No partial credit. |
| coding | 12 | The single fenced JS block is extracted and the named function is run against unit tests **the model never sees**. Every case must pass. |

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
