# Agentic benchmark (real repo, hidden tests)

The single-turn suites cannot test most of what the skill actually claims. "Is
it already in this codebase?", "grep every caller before editing", "fewest files
possible" and the context diet are all statements about an agent working in a
repo, and a `-p` prompt in an empty directory measures none of them.

So: five small fixture repos, each with a planted trap, driven by the real agent
with real tools. The agent never sees the test — `test.js` is copied in **after**
the run finishes and decides pass/fail.

```bash
node benchmarks/agentic/run.js [model] [seeds] [parallel]   # default: haiku, 3 seeds, 5-way
node benchmarks/agentic/score.js                            # tables to stdout
node benchmarks/agentic/score.js --json                     # per-cell rows
```

## The fixtures

| fixture | the trap | what the hidden test catches |
|---------|----------|------------------------------|
| `reuse` | `src/utils/slugify.js` already implements the app's URL rules (accent folding, `&` to "and") | A fresh re-implementation gets `Crème Brûlée & Sugar` wrong |
| `rootcause` | `isExpired` uses `now > expiresAt`; three call sites depend on it | Patching one call site instead of the shared helper fails the other two |
| `dupepaths` | The money format is inlined in two of three render paths rather than going through `money.js` | Fixing only `money.js` leaves receipts and statements printing `$-4.50` |
| `yagni` | A one-line "read it from an env var" ask that invites a config framework | Behaviour must hold for unset, `"5"`, and `"0"` — the last one catches `||` instead of a null check |
| `stdlib` | Order-preserving dedupe, which invites a dependency | Behaviour, plus `deps added` in the score table |

## Metrics

| metric | measures |
|--------|----------|
| hidden-test pass | correctness — the only metric that can veto the rest |
| new files, net LOC | YAGNI, "shortest working diff wins" |
| deps added | ladder rung 5 |
| output tokens | generation cost |
| context tokens | the context diet: input + cache read + cache creation, i.e. everything the run pulled into the window |
| $ / run | the two above, priced |

## Results

Regenerated from the committed `raw/` by `score.js` — deterministic, no tokens
spent. 5 fixtures x 12 seeds = 60 cells per arm.

| arm | n | passed | pass rate | new files | net LOC | deps added | out tokens | context tokens | $ / run |
|-----|--:|-------:|----------:|----------:|--------:|-----------:|-----------:|---------------:|--------:|
| vanilla | 60 | 49 | 81.7% | 0.20 | 3.7 | 0.00 | 1171 | 67832 | 0.0269 |
| **chisle** | 60 | 48 | 80.0% | 0.20 | **2.9** | 0.00 | **1083** | **64695** | 0.0276 |

vanilla 49/60, 95% CI 70.1%–89.4%; chisle 48/60, 95% CI 68.2%–88.2%.
Fisher exact, two-sided: **p = 1.000** — a tie within noise.

| fixture | vanilla | chisle | Fisher p | reading |
|---------|--------:|-------:|---------:|---------|
| `reuse` | 12/12 | 12/12 | 1.000 | trap avoided by both arms |
| `rootcause` | 12/12 | 12/12 | 1.000 | trap avoided by both arms |
| `stdlib` | 12/12 | 12/12 | 1.000 | trap avoided by both arms; no deps added in either arm |
| `yagni` | 9/12 | 8/12 | 1.000 | chisle loses one cell — the `"0"` null-check case |
| `dupepaths` | 4/12 | 4/12 | 1.000 | both arms fail 8/12 on `TOTAL $-4.50` — hard fixture, not a discriminator |

Three honest negatives, stated rather than buried:

- **Pass rate is a tie, and chisle is one cell down**, driven by `yagni`.
- **Cost per run is slightly worse** ($0.0276 vs $0.0269). Chisle spends fewer
  output tokens (1083 vs 1171) and pulls ~4.6% less context, but the ruleset's
  own prompt tokens eat the difference at this task size.
- **`dupepaths` discriminates nothing.** It fails two thirds of the time in both
  arms; it stays in the suite because it was fixed before the run, not because
  it flatters anyone.

What does hold up: the diff is shorter (2.9 vs 3.7 net LOC) at equal
correctness, and neither arm ever reached for a dependency.

## Honesty rules

`score.js` prints every failing cell with its first failing assertion, for both
arms. A fixture where the arms tie is reported as a tie. Adding a fixture after
seeing the results, or dropping one that went the wrong way, would invalidate
the whole thing — the suite is fixed before the run, and losses ship.
