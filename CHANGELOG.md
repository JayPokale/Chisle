# Changelog

All notable changes to Chisle are documented here.
Format loosely follows [Keep a Changelog](https://keepachangelog.com/).

## [Unreleased]

### Fixed
- **Duplicate hook registration made dedup destroy first-seen tool output.**
  When `chisle-compress-output.js` was registered twice (plugin manifest plus a
  leftover standalone entry in `settings.json`), both copies ran on the same
  tool call and shared one state file: copy A stored the output hash, copy B
  matched it and replaced content the model had never seen with a
  `[chisle: output byte-identical to the previous <tool> result …]` marker.
  `dedupCheck` now records the payload's `tool_use_id` alongside the hash and
  skips the marker when the match comes from the same tool call. Old
  string-valued state entries still load, and a payload without a
  `tool_use_id` keeps the previous behaviour. A genuine re-run is a different
  tool call, so real dedup still fires.
  ([#4](https://github.com/JayPokale/Chisle/issues/4), reported by
  [@aermak](https://github.com/aermak))
- **The installer left both registrations live.** `installClaude()` picked one
  wiring path per run and never removed the other's, so a machine that once
  fell back to standalone hooks kept them after the plugin installed. The
  plugin branch now strips `chisle-` entries from `settings.json`.

## [3.0.0] — 2026-07-28

### Changed
- **BREAKING: one mode. `lite`, `full` and `ultra` are gone.** Three dials on a
  tool whose argument is "fewer knobs" was the joke writing itself, and only the
  middle setting was ever benchmarked. `/chisle` turns it on, `/chisle off`
  turns it off. A stray `/chisle full` still just activates, so old habits keep
  working.
  - Compressor thresholds are now fixed at the old `full` values
    (8k chars, 60 head lines, 40 tail) — the published numbers were measured
    there. `CHISLE_COMPRESS_*` still overrides them.
  - `CHISLE_DEFAULT_MODE` and `config.json` `defaultMode` now take `on` / `off`.
    An existing `lite`/`full`/`ultra` value is no longer valid and falls through
    to the default, which is `on` — so the tool stays enabled either way, and
    SessionStart says once that the setting no longer does anything.
  - Statusline renders `[CHISLE]` only; the `[CHISLE:ULTRA]` variant is gone.
  - Note for anyone re-deriving the benchmarks: the injected ruleset changed
    with this release (the intensity table left SKILL.md), so a fresh run will
    not reproduce the committed cells byte-for-byte.

### Fixed
- **Tool-output compression never actually applied.** The `PostToolUse` hook
  returned the compressed text as a bare string, but Claude Code validates
  `updatedToolOutput` against the tool's own output schema — and object-shaped
  results (`Bash` → `{stdout, stderr, …}`) rejected it every time with
  `expected object, received string`. The hook ran, reported savings, and the
  model still received the full output. `rebuildResponse()` now puts the
  compressed text back into the original shape and skips shapes it cannot
  rebuild rather than emitting a replacement the harness will refuse.
  Found and diagnosed with transcript evidence, plus the fix, by
  [@sovdchains](https://github.com/sovdchains) (#3).
- **The stats file counted savings that never happened.** `recordSavings()`
  ran before the replacement was emitted, so `.chisle-compress-stats.json` and
  the statusline `⇣` badge credited every compression the harness went on to
  reject. It now records only when a replacement is actually sent. Same report
  (#3).
- **The full ruleset was re-injected on every resume, clear and compact.**
  `SessionStart` matches `startup|resume|clear|compact`, and the hook never
  read `source`, so all four re-sent the whole ~1.6k-token ruleset. Only
  `startup` now sends it; the rest get a 27-token reactivation line, since the
  per-turn `UserPromptSubmit` reminder already restates the active behaviour.
  Measured across 173 real sessions — including the observation that the
  overhead was cancelling most of the compressor's savings, and that the
  standing instruction load was competing with the user's actual requests — by
  [@enc0ded](https://github.com/enc0ded) (#2).

## [2.0.0] — 2026-07-28

### Changed
- **Renamed project: RDXmin → Chisle.** Package, plugin, skills
  (`chisle`, `chisle-audit`, `chisle-review`, `chisle-help`), commands
  (`/chisle`, `/chisle-audit`, `/chisle-review`, `/chisle-help`), env vars
  (`CHISLE_*`), config path (`~/.config/chisle/`), and all per-agent rule
  mirrors renamed to match. Entries below predate the rename and refer to
  the project by its former name, RDXmin.

Published to npm as `chisle`; `rdxmin` deprecated with a pointer.

## [1.2.2] — 2026-07-11

### Added
- Website: [rdx.jaypokale.me](https://rdx.jaypokale.me) — npm/README homepage
  now points there. Site lives in `site/`, ships in neither the npm package
  nor the plugin install.

## [1.2.1] — 2026-07-11

### Fixed
- **Windows statusline never rendered** — `rdx-statusline.ps1` combined
  `Get-Content -Raw -TotalCount`, which are mutually exclusive in every
  PowerShell; the throw was swallowed by `SilentlyContinue`, the empty mode
  hit the whitelist default, and the badge silently exited. Cap the string
  after a plain `-Raw` read instead. Reported by
  [@TDimovski](https://github.com/TDimovski) (#1).
- `rdx-statusline.ps1` now refuses symlinked/reparse-point flag and stats
  files, matching the `.sh` guard.

## [1.2.0] — 2026-07-09

### Added
- Major-version update notice on session start (registry check cached 3 days,
  `RDX_UPDATE_CHECK=0` kill switch).
- Contributor credits: `package.json` contributors, README contributors
  section with auto-updating contrib.rocks image.

### Changed
- CI: actions bumped to v5; publish step idempotent (skips versions already
  on npm).

## [1.1.0] — 2026-07-07

Same content as 0.2.0 plus the total-bill chart redesign. The version jumps
past 1.0.0 because the repo's very first commit shipped `"version": "1.0.0"`
before being re-numbered to 0.1.0 — plugin resolvers with that payload cached
treat every 0.x release as a downgrade and silently keep serving the ancient
code. 1.0.0 is skipped forever; nothing may ever claim it again.

## [0.2.0] — 2026-07-07

### Added
- **Tool-output compression (input axis)** — `PostToolUse` hook
  (`hooks/rdx-compress-output.js`) elides the middle of oversized tool results
  before the model reads them: head + tail kept, up to 12 error-like lines
  salvaged from the cut. Deterministic, zero LLM, zero network, zero deps.
  Allowlist-only for correctness (Bash/Agent/WebFetch/WebSearch/Grep/Glob/
  `mcp__*` — never Read/Edit/Write, whose exact bytes feed later edits).
  Thresholds track the `/rdx` level (lite 16k / full 8k / ultra 5k chars);
  env-tunable; `RDX_COMPRESS=0` kill switch. Wired via plugin manifest and the
  standalone installer (settings merge grew `matcher` support).
- **Measured, not estimated:** across 171 real transcripts, tool output is
  67.5% of context content; the shipped compressor replayed over that corpus
  shrinks eligible outputs ~46% (receipts + reproducible replay script:
  `benchmarks/replay-compress.js`, `benchmarks/results/2026-07-07-input-axis.md`).
- Savings ledger (`.rdx-compress-stats.json`, measured chars elided) rendered
  by both statuslines as `⇣9k tok` — this one has a real baseline, unlike the
  fabricated output-side counter removed in 0.1.0.
- **Context Diet** ruleset section (all 8 agents): fetch the slice, not the
  file — Grep before Read, offset/limit reads, filter long output at the
  source. Prevention for the `Read` whale the compressor must not touch.
- 15 new tests (compressor correctness guardrails, allowlist, kill switch,
  never-throws). Suite: 49.

### Added (2026-07-07, second pass)
- **Scrub tier** (lossless) in the output compressor: ANSI/OSC escape strip,
  blank-run collapse, `line repeated N×` collapse — applies to medium outputs
  below the elision threshold. Techniques adapted from headroom's transform
  set, implemented zero-dep. Replay: 53 outputs touched in full mode (was 39),
  ~61k tokens one-shot on the measured corpus.
- **Dedup tier**: a tool output byte-identical to that tool's previous output
  in the *same session* becomes a one-line marker (the copy is already in
  context). Session-scoped by hook `session_id` — never fires across sessions,
  where the earlier copy wouldn't be in context; skipped when no session id.
  0 hits in the replay corpus — labeled speculative, `RDX_COMPRESS_DEDUP=0`.
- README rebuilt around the three-axis story with verified numbers and a
  prior-art table (real repo links); CONTRIBUTING corrected (wrong test glob
  that matched zero files, missing compressor row, stale savings-counter
  mention, checklist aligned with the deliberate build-rules mirror).

### Verified / Fixed (2026-07-07 re-verification)
- June benchmark numbers reproduced exactly from committed raw cells (billed
  `usage.output_tokens`); metric now stated explicitly — on the alternative
  visible-answer metric the June data held one RDXmin over-baseline cell.
- **Retired the "0 backfires" claim.** A fresh 24-cell run against the
  *installed* caveman/ponytail plugins produced one RDXmin backfire
  (rest-graphql, 173% billed) vs caveman 5/6 (worst 424%) and ponytail 4/6.
  Combined 20-task ledger: RDXmin 1, caveman 6, ponytail 8. All 24 fresh
  answers graded correct — no accuracy loss in any arm.
- Root-caused the backfire (comparison prompts → headed pro/con bullet walls,
  structure the ruleset already banned but too weakly) and hardened the rule;
  re-validated live at 93% of a fair 3-trial vanilla baseline (was 145%).
  Writeup: `benchmarks/results/2026-07-07-verify-rerun.md`.
- Fixed two-sources-of-truth bug: `scripts/build-rules.js` carried its own
  rule BODY, so SKILL.md edits never reached the per-agent copies (CI checked
  the copies against the same stale BODY — green while wrong). BODY updated +
  labeled as a manual mirror.
- Benchmark harness: competitor skills resolve from installed plugin cache,
  arms run in parallel per task, fresh-run dir override (`run-live.sh [model]
  [raw-dir]`, `RAW_DIR=` for `aggregate.js`).

## [0.1.0] — 2026-06-29

### Added
- Unified efficiency mode: zero-fluff prose + YAGNI-first code, always active together.
- **`/rdx-audit`** — one-shot audit of a diff/file/repo across both axes: over-engineered
  code *and* bloated prose/docs/comments, ranked biggest-cut-first. Neither a code-only
  auditor nor a prose compressor does both; this is the union.
- **Reliability finding** (14 tasks, 2 models): RDXmin never exceeded the no-tool token
  baseline (worst case 83%), while caveman hit 130% once and ponytail 227% on 4 tasks. The
  honest value prop is "no failure mode," not "tersest on every task." See
  `benchmarks/results/2026-06-29-reliability.md`.
- `/rdx` command with `lite` / `full` / `ultra` levels; natural-language activation.
- SessionStart + UserPromptSubmit hooks with symlink-safe flag handling (`O_NOFOLLOW`, 0600).
- Statusline badge `[RDX]` / `[RDX:ULTRA]` (bash + PowerShell). Shows plan rate-limit
  usage + reset countdown, or session cost (`$`) on API keys — read from Claude's
  statusline JSON, no extra API calls. No fabricated "tokens saved" counter (an earlier
  build's `turns × 350` estimate was removed; a live session has no baseline to measure against).
- **`npx rdxmin` installer** — auto-detects 8 agents (Claude Code, Gemini, Codex,
  Cursor, Windsurf, Cline, Kiro, Copilot) and installs for each. Flags: `--list`,
  `--only`, `--dry-run`, `--force`, `--uninstall`, `--config-dir`, `--help`. Claude path
  does a plugin install with automatic fallback to standalone hooks + JSONC-safe
  `settings.json` merge. Idempotent; clean round-trip uninstall.
- `curl | bash` and `irm | iex` shims delegating to the Node installer.
- Multi-agent distribution: Cursor, Windsurf, Cline, Kiro, Codex, Gemini, Copilot rule copies, generated from one source via `scripts/build-rules.js`.
- **Live 4-arm benchmark** (`benchmarks/run-live.sh` + `aggregate.js`): vanilla vs
  caveman vs ponytail vs rdxmin over 24 real model runs, isolated so the arm is the
  only variable. Raw outputs committed under `benchmarks/results/raw/`. README chart and
  numbers are generated from this real data (replacing an earlier chart modeled from
  hand-authored examples). Finding: rdxmin is leanest on coding tasks; on pure prose a
  dedicated prose compressor wins — stated plainly, not cherry-picked.
- Chart generator (`scripts/build-chart.js`, reliability worst-case from real cells) + promptfoo config.
- npm trusted publishing (OIDC, provenance) + GitHub Release workflow on `v*` tags.
- Test suite: 34 tests across flag safety, tracker, settings merge, installer integration. CI on Node 18/20/22.

### Fixed
- Deactivation no longer triggers on unrelated sentences that merely mention "rdx"
  alongside "off"/"stop" (e.g. "use rdx to turn off the logger"). Now requires the
  off-verb to target rdx directly. Regression-tested.

### Notes
- Statusline reads live rate-limit/cost from Claude's JSON; no per-session "savings" figure is invented.
- Example outputs are representative/illustrative; the *measurement* over them is reproducible.
