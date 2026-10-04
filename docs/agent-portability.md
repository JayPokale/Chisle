# Agent portability

Chisle is primarily a Claude Code plugin, but the same instruction set ships
to every agent that supports a rules/context file. One source, many targets.

## Source of truth

`skills/chisle/SKILL.md` defines behavior. The short always-on rule lives in
`rules/chisle-activate.md`. Per-agent copies are **generated** from a shared body in
`scripts/build-rules.js`. Never hand-edit the generated files.

## Distribution map

| Agent | File | Format |
|-------|------|--------|
| Claude Code | `.claude-plugin/plugin.json` + `skills/` + `hooks/` | plugin |
| Pi | `package.json#pi` → `pi-extension/` + `skills/` | Pi package |
| Codex | `.codex-plugin/plugin.json` → `AGENTS.md` | AGENTS.md |
| Gemini | `gemini-extension.json` → `GEMINI.md` | context file |
| Cursor | `.cursor/rules/chisle.mdc` | MDC, `alwaysApply: true` |
| Windsurf | `.windsurf/rules/chisle.md` | `trigger: always_on` |
| Cline | `.clinerules/chisle.md` | plain markdown |
| Kiro | `.kiro/steering/chisle.md` | `inclusion: always` |
| GitHub Copilot | `.github/copilot-instructions.md` | plain markdown |
| Antigravity (IDE + `agy` CLI) | `.agents/rules/chisle.md` | `trigger: always_on` ([rules docs](https://antigravity.google/docs/rules)) |
| OpenCode | `~/.config/opencode/AGENTS.md` (fenced block) + `~/.config/opencode/skills/` + `~/.config/opencode/plugins/chisle.js` | global ruleset + Agent Skills + compression plugin |
| Hermes Agent | `~/.hermes/skills/` | Agent Skills (`/chisle` commands) |

## Pi discovery and always-on delivery

Verified against Pi 0.85.1:

- Pi reads project `AGENTS.md` unchanged as an always-on context file.
- Pi implements the Agent Skills standard, but this repo's top-level `skills/` directory is not a project discovery location by itself. The package manifest explicitly exposes it; Pi then lists `chisle` for progressive disclosure and `/skill:chisle`.
- Progressive-disclosure skills are not always-on. `pi-extension/index.js` injects the existing skill body once as a hidden persistent message when project `AGENTS.md` does not already provide Chisle. Resume and reload reuse that message; compaction restores it only when it fell out of active context.
- The extension requires the existing compressor core from `hooks/`; no mirrored compressor or generated Pi rule exists, so no extra sync target is needed.

## OpenCode delivery

Verified against OpenCode 1.18.x docs (rules + Agent Skills pages):

- OpenCode loads the global `~/.config/opencode/AGENTS.md` on every session alongside project `AGENTS.md`; the installer appends one fenced `<!-- chisle-begin -->` … `<!-- chisle-end -->` block after existing user content and refreshes only that block under `--force`/`--update`.
- The bundled `skills/` copy into `~/.config/opencode/skills/` verbatim, discovered on demand through the native `skill` tool. The global skills dir is scanned by default, so `skills.paths` needs no edit and no `instructions` entry is added — no second system message, existing instructions preserved.
- OpenCode does not expose a Chisle mode-toggle lifecycle. The global ruleset is always on, and `/chisle` loads the skill rather than toggling those instructions. Compression reads `CHISLE_DEFAULT_MODE` or the shared config on every hook call; `off` disables compression only.
- Tool-result compression, which static-rule hosts normally cannot get, ships to OpenCode as a native plugin. The installer writes `~/.config/opencode/plugins/chisle.js` plus the zero-dep compressor core in `chisle-hooks/`, where OpenCode auto-discovers `*.js`/`*.ts` plugins at startup.
- OpenCode applies its configured `tool_output` line/byte truncation before `tool.execute.after`. Chisle therefore compresses the retained preview and preserves OpenCode's full-output recovery hint; output below that native limit reaches the hook in full. The hook rewrites oversized `output.output` in place and OpenCode persists the mutation onto the tool part. `experimental.chat.messages.transform` runs after MCP normalization and before conversion to model messages and compaction, providing a request-time safety pass for stored full output. Only the persisted after-hook replacement records savings, so the safety pass does not count the same result twice.
- Both hooks reuse the Claude/Pi compressor core. Eligible output has a final character bound, Unicode-safe head/tail cuts, bounded error windows, and a byte-identical pre-scrub recovery spill. Per-session dedup uses OpenCode's session and call IDs. A bounded output already carrying `[chisle:` is skipped; an oversized source string containing that text is still bounded. Non-string output shapes are skipped.
- The default allowlist contains only known read-heavy OpenCode built-ins. MCP names are never inferred safe from underscores; add known read-only tools with `CHISLE_COMPRESS_TOOLS`. Source-bearing and mutating tools remain excluded even when configured. Disable compression with `CHISLE_COMPRESS=0` or `CHISLE_DEFAULT_MODE=off`. Measured on gpt-5.5, a 30 KB `cat` output kept full by OpenCode dropped the tool-ingestion step from 13,382 to 1,747 fresh input tokens (-87%) with an identical, correct answer.

## Hermes delivery

Verified against the Hermes skills docs (`~/.hermes/skills/` as source of truth, Agent Skills standard):

- The installer copies the bundled `skills/` verbatim into `~/.hermes/skills/` — portable via `CHISLE_HOME`, no hardcoded machine paths, no config rewrite.
- Hermes discovers each skill as a `/chisle*` slash command on demand. No ruleset is injected: Hermes already reads project `AGENTS.md`.
- Uninstall prunes only the `chisle*` skill dirs; foreign skills stay put.

## Keeping copies in sync

```bash
node scripts/build-rules.js          # regenerate all copies
node scripts/build-rules.js --check  # CI gate, fails if any drifted
```

CI runs `--check` on every push. Edit the body in `build-rules.js`, regenerate,
commit. The generated files are committed (not built on install) so marketplace
and `git clone` installs work without a build step.

## Runtime feature map

| Feature | Claude Code | Pi | OpenCode | Other static-rule |
|---------|:-----------:|:--:|:--------:|:-----------------:|
| Always-on output rules | ✅ | ✅ | ✅ | ✅ |
| Tool-result compression | ✅ | ✅ | ✅ (plugin) | ❌ |
| `/chisle` on-demand skill | ✅ | ✅ | ✅ (skills) | ❌ (static ruleset only) |
| `/chisle` + natural-language toggle | ✅ | ✅ | ❌ (env/config) | ❌ |
| Status badge + measured savings | ✅ | ✅ | ❌ | ❌ |

Pi's `tool_result` event enables the second input-axis implementation. It patches `content` only, preserving tool-specific `details`, `isError`, and `usage`. `read`, `edit`, and `write` remain excluded. Project-local Pi resources require project trust and extensions run with full user permissions; see [installation](../INSTALL.md#manual-pi-package).
