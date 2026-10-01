# Contributing

Small focused PRs beat big rewrites. Chisle is a small package. Keep it that way.

## What lives where

| File | Purpose |
|------|---------|
| `skills/chisle/SKILL.md` | **Behaviour source.** All rules and examples. The activate hook reads it at runtime. |
| `scripts/build-rules.js` | Condensed mirror of the skill for the 7 static-rule agents (OpenCode reuses `AGENTS.md` + `skills/` directly; no generated copy). **Editing SKILL.md alone does not propagate here**, so update the `BODY` too, then regenerate. |
| `hooks/chisle-activate.js` | SessionStart: reads SKILL.md, writes flag, emits rules |
| `hooks/chisle-mode-tracker.js` | UserPromptSubmit: `/chisle` commands, NL detection, per-turn reinforcement |
| `hooks/chisle-compress-output.js` | PostToolUse: input-side compression (scrub / elide / dedup tiers, savings ledger) |
| `hooks/chisle-config.js` | Shared flag read/write, mode resolution. Security-sensitive, so test changes carefully. |
| `hooks/chisle-mode.js` | Shared natural-language mode-directive parser. |
| `pi-extension/index.js` | Pi lifecycle, command, status, and `tool_result` adapter; reuses hook core. |
| `hooks/chisle-statusline.sh` / `.ps1` | Statusline badge: mode + measured input-side savings |
| `bin/install.js` + `bin/lib/settings.js` | Multi-agent installer, JSONC-safe settings merge |
| `bin/install.js` (opencode/hermes paths) | Fenced global ruleset + verbatim skill copies; `CHISLE_HOME` redirects home in tests |

## What to edit

**Changing behaviour** → `skills/chisle/SKILL.md`, **and** the condensed `BODY` in `scripts/build-rules.js`, then `npm run build:rules`. CI checks the copies are in sync with the generator (not with SKILL.md; the mirror is manual, by design).

**Input-side compression** → shared transforms in `hooks/chisle-compress-output.js`, harness shape/lifecycle in `pi-extension/index.js`. Correctness invariants: allowlist only (never Read/Edit/Write), preserve Pi result metadata, salvage error lines, skip same-turn Pi dedup, keep every tier kill-switchable, never break the tool pipeline.

**Natural language triggers** → `hooks/chisle-mode.js`; both harnesses consume it.

**Security-sensitive paths** → `hooks/chisle-config.js` (`safeWriteFlag`, `readFlag`). Symlink-safe, `O_NOFOLLOW`, size-capped. Don't simplify them.

## Tests

```bash
npm test        # node --test tests/*.js
```

Add a test for any hook logic change. Compressor changes go in `tests/test_compress.js`.

## Benchmarks

Numbers in README/docs come from committed raw data. Nothing lands without receipts:

```bash
bash benchmarks/run-live.sh [model] [fresh-raw-dir]             # Claude live run
HARNESS=pi bash benchmarks/run-live.sh [model] [fresh-raw-dir]  # Pi live run
RAW_DIR=<dir> node benchmarks/aggregate.js                       # tables
node benchmarks/replay-compress.js [claude|pi] [session-dir]     # input replay
```

## PR checklist

- [ ] SKILL.md and the `build-rules.js` BODY both updated (if behavior changed) + `npm run build:rules`
- [ ] Hook changes don't break the flag-file security model or the compressor invariants
- [ ] New measurable behavior gets a benchmark task or replay receipt
- [ ] `npm test` passes; `npm run check:rules` and `npm run check:chart` clean

## Hacktoberfest

Chisle takes part. Start from an issue labelled `hacktoberfest`, `good first issue` or `help wanted`, and comment before you start so two people don't build the same thing. One issue per PR.

What counts: a fix, a fixture, a test, a measurement with receipts, a docs correction backed by data. What doesn't: whitespace, typo sweeps across unrelated files, reworded README sections, or anything that adds a dependency. Those get labelled `invalid` or `spam` and don't count. Accepted PRs get `hacktoberfest-accepted`, merged or not.

Benchmark PRs follow the same rule as everything else: raw cells committed, losses published.

## Reporting bugs

Open an issue. Include: what you typed, what chisle did, what you expected.
