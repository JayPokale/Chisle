# Contributing

Small focused PRs beat big rewrites. Chisle is a small package — keep it that way.

## What lives where

| File | Purpose |
|------|---------|
| `skills/chisle/SKILL.md` | **Behavior source.** All rules, intensity levels, examples. The activate hook reads it at runtime. |
| `scripts/build-rules.js` | Condensed mirror of the skill for the 7 non-Claude agents. **Editing SKILL.md alone does not propagate here** — update the `BODY` too, then regenerate. |
| `hooks/chisle-activate.js` | SessionStart: reads SKILL.md, writes flag, emits rules |
| `hooks/chisle-mode-tracker.js` | UserPromptSubmit: `/chisle` commands, NL detection, per-turn reinforcement |
| `hooks/chisle-compress-output.js` | PostToolUse: input-side compression (scrub / elide / dedup tiers, savings ledger) |
| `hooks/chisle-config.js` | Shared flag read/write, mode resolution. Security-sensitive — test changes carefully. |
| `hooks/chisle-statusline.sh` / `.ps1` | Statusline badge: mode + measured input-side savings |
| `bin/install.js` + `bin/lib/settings.js` | Multi-agent installer, JSONC-safe settings merge |

## What to edit

**Changing behavior or intensity levels** → `skills/chisle/SKILL.md`, **and** the condensed `BODY` in `scripts/build-rules.js`, then `npm run build:rules`. CI checks the copies are in sync with the generator (not with SKILL.md — the mirror is manual, by design).

**Input-side compression** → `hooks/chisle-compress-output.js`. Correctness invariants that must survive any change: allowlist only (never `Read`/`Edit`), error-line salvage on any elision, dedup only within one session, every tier kill-switchable, hook never throws.

**Natural language triggers** → regex patterns in `hooks/chisle-mode-tracker.js`.

**Security-sensitive paths** → `hooks/chisle-config.js` (`safeWriteFlag`, `readFlag`). Symlink-safe, `O_NOFOLLOW`, size-capped. Don't simplify them.

## Tests

```bash
npm test        # node --test tests/*.js
```

Add a test for any hook logic change. Compressor changes go in `tests/test_compress.js`.

## Benchmarks

Numbers in README/docs come from committed raw data — nothing lands without receipts:

```bash
bash benchmarks/run-live.sh [model] [fresh-raw-dir]   # live 4-arm run
RAW_DIR=<dir> node benchmarks/aggregate.js            # tables
node benchmarks/replay-compress.js [mode]             # input-axis replay
```

## PR checklist

- [ ] SKILL.md and the `build-rules.js` BODY both updated (if behavior changed) + `npm run build:rules`
- [ ] Hook changes don't break the flag-file security model or the compressor invariants
- [ ] New measurable behavior gets a benchmark task or replay receipt
- [ ] `npm test` passes; `npm run check:rules` and `npm run check:chart` clean

## Reporting bugs

Open an issue. Include: what you typed, what chisle did, what you expected.
