# Chisle vs caveman vs ponytail

## Why not just use caveman or ponytail?

Use them if they fit. We test against them honestly, and the latest numbers are less flattering to everyone, Chisle included.

Re-measured 2026-10-01: 13 live prompts × 2 seeds on Haiku 4.5, each tool's current version, billed output tokens as % of the no-tool baseline ([writeup + raw cells](../benchmarks/results/2026-10-01-live-rerun.md)):

| | total bill | 95% CI | worst cell | times worse than no tool | code judgment |
|---|--:|--:|--:|--:|:--:|
| caveman | 102% | 79–128% | 305% | 15 / 26 | ❌ no ladder |
| ponytail | 105% | 86–129% | **493%** | **16 / 26** | ✅ |
| **Chisle** | **83%** | **69–95%** | **170%** | **11 / 26** | ✅ |

Chisle is the only one of the three measurably below a bare model. None is immune to backfiring: every arm wrote more than no tool at all on at least 11 of 26 cells, mostly short prompts with nothing to cut.

The June–July run (20 tasks) put Chisle at 52% with one backfire. That headline leaned on a single outlier baseline and on cells an old ruleset example may have primed, and is superseded. The examples below are from that run.

**caveman** is a superb prose compressor, a hair leaner than Chisle on pure-prose prompts, but it has no engineering judgment. Asked to *"add caching,"* it dumped three implementations (330 tokens) where Chisle gave one `@cache` + an upgrade line (151).

**ponytail** has the engineering judgment but pads prose so hard it backfires. On a "retry logic" prompt it ran **227%** of the no-tool baseline. Yes: a "write less" tool, writing more than twice as much. Receipts: [`reliability writeup`](../benchmarks/results/2026-06-29-reliability.md).

**Chisle's June backfire** (a comparison prompt answered with headed bullet walls) was root-caused and fixed in the ruleset. The October run shows short prompts still backfire for every tool, Chisle included; its edge is the smallest worst case, not immunity.

Installing *both* specialists to cover both axes gets you two plugins that fight over prose style and double per-session overhead, and on one task they did *worse* stacked (605t) than Chisle alone (595t). Full data: [reliability](../benchmarks/results/2026-06-29-reliability.md) · [Sonnet cross-check](../benchmarks/results/2026-06-29-sonnet-cross-check.md).

## The input axis, a thing neither specialist touches

caveman and ponytail both compress one direction: what the model *writes*. Neither does anything about what it *reads*: tool output, which is **67.5% of session context** on a Claude Code corpus ([measured](../benchmarks/results/2026-07-07-input-axis.md)). Chisle compresses that axis on Claude Code and Pi: oversized safe tool output gets its middle elided, error lines salvaged, and every saved byte stops being re-billed on later requests. Claude replay cut ~46% per eligible output. Pi replay measured the honest marginal result after Pi's native 50KB/2,000-line truncation: **27.4% of persisted tool-output chars** ([Pi receipt](../benchmarks/results/2026-09-11-pi.md)).

## `/chisle-audit`, a thing neither specialist has

One pass over a diff, file, or repo that flags **both** over-engineered code *and* bloated prose/docs/comments, ranked biggest-cut-first. ponytail-audit is code-only; caveman has no audit mode. `/chisle-audit` is the union: what a PR reviewer actually wants in one report.

## Detailed benchmark tables

### Per-segment breakdown (Haiku, 6 tasks)

Visible answer size as % of the no-tool baseline, lower = leaner:

| | vanilla | caveman | ponytail | **Chisle** |
|---|--:|--:|--:|--:|
| **coding** (tokens) | 100% | 46% | 29% | **22%** |
| **coding** (lines) | 100% | 40% | 19% | **14%** |
| **non-coding** (tokens) | 100% | 79% | 121% | **71%** |
| **all 6 tasks** | 100% | 57% | 61% | **39%** |

On coding, Chisle is leanest, clearest on the debounce prompt, where vanilla shipped a generic `useDebounce<T>` hook in its own file plus two alternative approaches (**142 lines**) and Chisle used `setTimeout` in the existing effect (**35 lines**), then pointed at `lodash.debounce` if it was already installed.

One honest caveat on the `cache` prompt, the largest single drop in the table (4910 → 571 tokens): both runs were given a prompt with no codebase to look at. Vanilla invented a 150-line TypeScript cache class against a project it had never seen; Chisle's 7 lines were a request for the language and framework, not a cache implementation. Asking is the correct move under rung 2 of the ladder, but the saving on that row comes from *not guessing*, not from writing a leaner cache, and it would shrink on a repo where the context was actually available.

On pure prose, caveman is a hair leaner on a good day; it's a dedicated prose compressor, credit where due.

Full results: [live 4-arm](../benchmarks/results/2026-06-29-live-4arm.md) · [reliability](../benchmarks/results/2026-06-29-reliability.md) · [Sonnet cross-check](../benchmarks/results/2026-06-29-sonnet-cross-check.md).

## FAQ

**Will it golf my code into clever one-liners I'll hate at 3am?**
No. The rule is *necessary*, not *fewest characters*. Boring over clever. Deletion beats addition; obfuscation isn't deletion.

**Does it ever cut corners on safety?**
Never. Input validation, error handling that prevents data loss, security, and accessibility are explicitly off the table. It's lazy about solutions, not about reading the problem.

**It made my answer terse and dropped something I needed!**
File an issue. That's a bug, not the design. Terse ≠ incomplete: keep the fix, cut the fluff. If it dropped the fix, it failed its own rules and we want to know.

**Does it work outside Claude Code?**
Yes. It ships to Pi, OpenCode, Hermes, Cursor, Windsurf, Cline, Kiro, Antigravity, Codex, Gemini, and Copilot. Pi and Claude Code get live mode switching, status badge, and input compression; the static-rule agents get the always-on ruleset. See [agent portability](agent-portability.md).

**Why "Chisle"?**
CHISLE is a demolition charge. Your token bill is the building. The only thing it detonates is verbosity.
