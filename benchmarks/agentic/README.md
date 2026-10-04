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
`plugin.json`, with chars elided recorded per cell). Point `RAW_DIR` at a fresh
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

## Results, 2026-10-01 (trimmed ruleset, six fixtures)

`ARMS=vanilla,chisle RAW_DIR=benchmarks/agentic/raw-oct`, 6 fixtures x 6 seeds,
Haiku 4.5, Claude Code 2.1.285, ruleset 48485e7 (~900 tokens per request).

| arm | n | passed | net LOC | out tokens | context tokens | turns | $ / run |
|-----|--:|-------:|--------:|-----------:|---------------:|------:|--------:|
| vanilla | 36 | 28 | 2.8 | 1118 | 115,063 | 5.42 | 0.0397 |
| chisle | 36 | 28 | 2.5 | 1155 | 133,974 | 5.92 | 0.0424 |

The trim did not make Chisle cheaper in a loop. Pass rate ties again; context
is **+16%** and cost **+6.8%**. On the three easy fixtures the gap is +4%,
about the ruleset's own size times the request count. The rest is extra turns:
`dupepaths` 8.2 vs 6.8 (+22% context), `noisylog` 9.8 vs 8.2 (+37%). Each
extra request re-sends the whole context, so fetching less per call costs more
if it means more calls.

**Follow-up with tool-call and per-request logs** (`raw-diag/`, `raw-diag2/`):
most of that gap is turn-count noise, not behaviour. Every Chisle request
carries the ruleset, ~0.9k tokens (first prompt 20.3k vs 19.4k bare), and that
part repeats exactly. Everything else is how many requests a run takes, which
swings both ways: in one `noisylog` batch Chisle took 6 turns in all three
cells (172k context vs 248–276k bare), in another it took more than bare.
Pooled over 12 `noisylog` cells per arm: 233k vs 210k (+11%), wide spread.
The tool sequences themselves match closely; on `dupepaths` Chisle sometimes
stops after fixing `money.js` alone and fails, as bare does. The repeatable
cost is the ruleset; the turn gap needs far more than six seeds to call.

## Results, 2026-09-14 (pre-trim ruleset, five fixtures)

Regenerated from the committed `raw/` by `score.js` — deterministic, no tokens
spent. 5 fixtures x 12 seeds = 60 cells per arm. Run on 2026-09-14 with the
ruleset as it was then (~1.8k tokens); it has since been trimmed to ~900
because of the cost row below, and these cells have not been re-run yet.

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
