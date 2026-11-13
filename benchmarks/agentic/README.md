# Agentic benchmark (real repo, hidden tests)

The single-turn suites cannot test most of what the skill actually claims. "Is
it already in this codebase?", "bug fix = root cause, not symptom", "fewest files
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

Both take `ARMS` (default `vanilla,chisle`) and `RAW_DIR` (default `./raw`).
Arms: `vanilla` (bare agent), `chisle` (ruleset appended as a system prompt),
`chisle-hook` (ruleset plus the shipped PostToolUse compressor, wired from
`plugin.json`, with chars elided recorded per cell), `chisle-trim` (ruleset plus
the deny list `npx chisle tools trim` writes), `ponytail` (the rival's skill). Point `RAW_DIR` at a fresh
directory whenever the ruleset changes: the runner skips any cell that already
has a result, so old cells would otherwise be scored as new.

```bash
ARMS=vanilla,chisle,chisle-hook RAW_DIR=benchmarks/agentic/raw-2 node benchmarks/agentic/run.js claude-haiku-4-5-20251001 12
ARMS=vanilla,chisle,chisle-hook RAW_DIR=benchmarks/agentic/raw-2 node benchmarks/agentic/score.js
```

## The fixtures

| fixture | the trap | what the hidden test catches |
|---------|----------|------------------------------|
| `reuse` | `src/utils/slugify.js` already implements the app's URL rules (accent folding, `&` to "and") | A fresh re-implementation gets `Crème Brûlée & Sugar` wrong |
| `rootcause` | `isExpired` uses `now > expiresAt`; three call sites depend on it | Patching one call site instead of the shared helper fails the other two |
| `dupepaths` | The money format is inlined in two of three render paths rather than going through `money.js` | Fixing only `money.js` leaves receipts and statements printing `$-4.50` |
| `yagni` | A one-line "read it from an env var" ask that invites a config framework | Behaviour must hold for unset, `"5"`, and `"0"` — the last one catches `||` instead of a null check |
| `stdlib` | Order-preserving dedupe, which invites a dependency | Behaviour, plus `deps added` in the score table |
| `noisylog` | `npm test` prints 401 results (17k chars) with one half-cent rounding failure mid-log | A fix that only special-cases the visible failure misses `1005 @ 50%` and `1 @ 50%`; editing the test instead of `price.js` fails outright |
| `routing-catalog` | A regional courier catalog uses an exclusive weight check for inclusive service maxima | A caller-only fix misses exact-boundary quotes, eligible-service discovery, manifests, and quote audits |

`noisylog` was added on 2026-10-01, before any run that includes it. It was
meant to give the `chisle-hook` arm something to compress, but a smoke run
showed it cannot: the log comes from a *failing* `npm test`, and Claude Code
sends failed calls to `PostToolUseFailure`, whose output no hook can rewrite.
What it measures instead is the context diet: does the agent filter a 17k-char
log itself? The results below predate it and cover five fixtures.

## Metrics

| metric | measures |
|--------|----------|
| hidden-test pass | correctness — the only metric that can veto the rest |
| new files, net LOC | YAGNI, "shortest working diff wins" |
| deps added | ladder rung 5 |
| output tokens | generation cost |
| context tokens | the context diet: input + cache read + cache creation, i.e. everything the run pulled into the window |
| $ / run | the two above, priced |

## Results (Chisle 3.9, 2026-11-07)

`ARMS=vanilla,chisle,chisle-trim RAW_DIR=benchmarks/agentic/raw-nov node benchmarks/agentic/score.js`, 7 fixtures × 6 seeds, Haiku 4.5, Claude Code 2.1.285.

| arm | n | passed | net LOC | out tokens | context tokens | turns | $ / run | $ / request |
|-----|--:|-------:|--------:|-----------:|---------------:|------:|--------:|------------:|
| vanilla | 42 | 36 | 2.6 | 1433 | 148,497 | 6.31 | 0.0506 | — |
| chisle | 42 | 38 | 2.3 | 1270 | 144,692 | 6.02 | 0.0503 | 0.00894 |
| chisle-trim | 42 | 36 | 2.5 | 1342 | 136,599 | 6.29 | 0.0507 | 0.00801 |

Pass rates tie (chisle vs vanilla p = 0.738, chisle-trim vs vanilla p = 1.000). `chisle-trim` (the deny list `npx chisle tools trim` writes) cuts the first request from 22.0k to 18.9k tokens and cost per request by 10%; per run it looks flat only because that arm took more turns. Its two fewer passes are `yagni` seeds where the fix used `|| 3` and so returned 3 for `RETRY_COUNT=0`, the fixture's planted trap; the bare model fell into it on 3 of 6 seeds in the same run, and no arm ever called a denied tool.

| fixture | vanilla | chisle | chisle-trim |
|---------|--------:|-------:|------------:|
| dupepaths | 3/6 | 2/6 | 3/6 |
| yagni | 3/6 | 6/6 | 3/6 |
| noisylog, reuse, rootcause, routing-catalog, stdlib | 30/30 | 30/30 | 30/30 |

`dupepaths` fails about half the time in every arm and discriminates nothing; it stays because it was fixed before any run. Earlier rounds (September–October 2026) are in the git history.

## Honesty rules

`score.js` prints every failing cell with its first failing assertion, for both
arms. A fixture where the arms tie is reported as a tie. Adding a fixture after
seeing the results, or dropping one that went the wrong way, would invalidate
the whole thing — the suite is fixed before the run, and losses ship.
