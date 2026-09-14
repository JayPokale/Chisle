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

## Honesty rules

`score.js` prints every failing cell with its first failing assertion, for both
arms. A fixture where the arms tie is reported as a tie. Adding a fixture after
seeing the results, or dropping one that went the wrong way, would invalidate
the whole thing — the suite is fixed before the run, and losses ship.
