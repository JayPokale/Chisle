# Chisle vs caveman vs ponytail

## Why not just use caveman or ponytail?

Use them — they're great, and we tested against them honestly. But each has a failure mode, and Chisle doesn't.

Across **20 tasks** in two suites (June 14-task matrix + July re-verification run; code, prose, and vague "judgment" requests; Haiku + Sonnet), billed output tokens as % of the no-tool baseline:

| | total bill | average task | worst case | times worse than no tool | code judgment |
|---|--:|--:|--:|--:|:--:|
| caveman | 80% | 98% | **424%** | 6 / 20 | ❌ no ladder |
| ponytail | 68% | 91% | 227% | **8 / 20** | ✅ |
| **Chisle** | **52%** | **69%** | **173%** | **1 / 20** | ✅ |

Chisle's single backfire (a comparison prompt answered with headed bullet walls) was root-caused, fixed in the ruleset, and re-validated live at 93% of baseline — receipts in the [verification writeup](../benchmarks/results/2026-07-07-verify-rerun.md).

**caveman** is a superb prose compressor — a hair leaner than Chisle on pure-prose prompts — but has no engineering judgment. Asked to *"add caching,"* it dumped three implementations (330 tokens) where Chisle gave one `@cache` + an upgrade line (151).

**ponytail** has the engineering judgment but pads prose so hard it backfires. On a "retry logic" prompt it ran **227%** of the no-tool baseline. Yes — a "write less" tool, writing more than twice as much. Receipts: [`reliability writeup`](../benchmarks/results/2026-06-29-reliability.md).

**Chisle backfired once in 20 tasks** — and that once got root-caused and fixed. It's not always the single tersest answer; it's the one with the smallest, rarest downside.

Installing *both* specialists to cover both axes gets you two plugins that fight over prose style and double per-session overhead — and on one task they did *worse* stacked (605t) than Chisle alone (595t). Full data: [reliability](../benchmarks/results/2026-06-29-reliability.md) · [Sonnet cross-check](../benchmarks/results/2026-06-29-sonnet-cross-check.md).

## The input axis — a thing neither specialist touches

caveman and ponytail both compress one direction: what the model *writes*. Neither does anything about what it *reads* — tool output, which is **67.5% of session context** on a real corpus ([measured](../benchmarks/results/2026-07-07-input-axis.md)). Chisle 0.2.0 ships a `PostToolUse` compressor for that axis (Claude Code only): oversized Bash/Agent/web output gets its middle elided, error lines salvaged, ~46% smaller per eligible output — and every saved byte stops being re-billed on each later request in the session.

## `/chisle-audit` — a thing neither specialist has

One pass over a diff, file, or repo that flags **both** over-engineered code *and* bloated prose/docs/comments, ranked biggest-cut-first. ponytail-audit is code-only; caveman has no audit mode. `/chisle-audit` is the union — what a PR reviewer actually wants in one report.

## Detailed benchmark tables

### Per-segment breakdown (Haiku, 6 tasks)

Visible answer size as % of the no-tool baseline, lower = leaner:

| | vanilla | caveman | ponytail | **Chisle** |
|---|--:|--:|--:|--:|
| **coding** (tokens) | 100% | 46% | 29% | **22%** |
| **coding** (lines) | 100% | 40% | 19% | **14%** |
| **non-coding** (tokens) | 100% | 79% | 121% | **71%** |
| **all 6 tasks** | 100% | 57% | 61% | **39%** |

On coding, Chisle is leanest — clearest on the debounce prompt, where vanilla shipped a generic `useDebounce<T>` hook in its own file plus two alternative approaches (**142 lines**) and Chisle used `setTimeout` in the existing effect (**35 lines**), then pointed at `lodash.debounce` if it was already installed.

One honest caveat on the `cache` prompt, the largest single drop in the table (4910 → 571 tokens): both runs were given a prompt with no codebase to look at. Vanilla invented a 150-line TypeScript cache class against a project it had never seen; Chisle's 7 lines were a request for the language and framework, not a cache implementation. Asking is the correct move under rung 2 of the ladder — but the saving on that row comes from *not guessing*, not from writing a leaner cache, and it would shrink on a repo where the context was actually available.

On pure prose, caveman is a hair leaner on a good day — it's a dedicated prose compressor, credit where due.

Full results: [live 4-arm](../benchmarks/results/2026-06-29-live-4arm.md) · [reliability](../benchmarks/results/2026-06-29-reliability.md) · [Sonnet cross-check](../benchmarks/results/2026-06-29-sonnet-cross-check.md).

## FAQ

**Will it golf my code into clever one-liners I'll hate at 3am?**
No. The rule is *necessary*, not *fewest characters*. Boring over clever. Deletion beats addition; obfuscation isn't deletion.

**Does it ever cut corners on safety?**
Never. Input validation, error handling that prevents data loss, security, and accessibility are explicitly off the table. It's lazy about solutions, not about reading the problem.

**It made my answer terse and dropped something I needed!**
File an issue — that's a bug, not the design. Terse ≠ incomplete: keep the fix, cut the fluff. If it dropped the fix, it failed its own rules and we want to know.

**Does it work outside Claude Code?**
Yes — ships to Cursor, Windsurf, Cline, Kiro, Codex, Gemini, and Copilot. Live mode-switching UI (`/chisle`, statusline badge) is Claude-Code-specific; everywhere else the always-on ruleset still applies. See [agent portability](agent-portability.md).

**Why "Chisle"?**
CHISLE is a demolition charge. Your token bill is the building. The only thing it detonates is verbosity.
