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
| Copilot CLI | `~/.copilot/copilot-instructions.md` (fenced block) + `~/.copilot/hooks/chisle.json` | instructions + `postToolUse` hook |
| Any stdio MCP host (opt-in) | `chisle mcp wrap` → `<config>/chisle/mcp-proxy/` | MCP proxy |
| Gemini | `gemini-extension.json` → `GEMINI.md` | context file |
| Cursor | `.cursor/rules/chisle.mdc` | MDC, `alwaysApply: true` |
| Windsurf | `.windsurf/rules/chisle.md` | `trigger: always_on` |
| Cline | `.clinerules/chisle.md` | plain markdown |
| Kiro | `.kiro/steering/chisle.md` | `inclusion: always` |
| GitHub Copilot | `.github/copilot-instructions.md` | plain markdown |
| Antigravity (IDE + `agy` CLI) | `.agents/rules/chisle.md` | `trigger: always_on` ([rules docs](https://antigravity.google/docs/rules)) |
| OpenCode | `<config root>/AGENTS.md` (fenced block) + `<config root>/skills/` + version-matched plugin under `<config root>/plugins/` | global ruleset + Agent Skills + compression plugin |
| Hermes Agent | `~/.hermes/skills/` | Agent Skills (`/chisle` commands) |

## Pi discovery and always-on delivery

Verified against Pi 0.85.1:

- Pi reads project `AGENTS.md` unchanged as an always-on context file.
- Pi implements the Agent Skills standard, but this repo's top-level `skills/` directory is not a project discovery location by itself. The package manifest explicitly exposes it; Pi then lists `chisle` for progressive disclosure and `/skill:chisle`.
- Progressive-disclosure skills are not always-on. `pi-extension/index.js` injects the existing skill body once as a hidden persistent message when project `AGENTS.md` does not already provide Chisle. Resume and reload reuse that message; compaction restores it only when it fell out of active context.
- Failed tool calls are compressed too. A non-zero bash exit throws with the full output ([`bash.ts:365`](https://github.com/badlogic/pi-mono/blob/v0.85.1/packages/coding-agent/src/core/tools/bash.ts#L365)); the agent loop turns the throw into an error result and still runs `afterToolCall` ([`agent-loop.ts:708-733`](https://github.com/badlogic/pi-mono/blob/v0.85.1/packages/agent/src/agent-loop.ts#L708-L733)), which emits `tool_result` with `isError: true` and applies the returned `content` ([`agent-session.ts:508`](https://github.com/badlogic/pi-mono/blob/v0.85.1/packages/coding-agent/src/core/agent-session.ts#L508)). Only calls rejected before execution (unknown tool, invalid arguments, blocked by `tool_call`) skip the hook, and those are short. The Pi replay in `benchmarks/replay-compress.js` therefore keeps failed results, unlike the Claude path.
- The extension requires the existing compressor core from `hooks/`; no mirrored compressor or generated Pi rule exists, so no extra sync target is needed.

## OpenCode delivery

Verified against OpenCode 1.18.31 and OpenCode 2.2.2:

- OpenCode's root resolves as `OPENCODE_CONFIG_DIR`, then `$XDG_CONFIG_HOME/opencode`, then `~/.config/opencode`. Install, detection, update, uninstall, plugin state, and `--stats --only opencode` share that resolution. `CHISLE_HOME` remains the installer's fallback-home override, and `CHISLE_STATE_DIR` remains the runtime-state override.
- OpenCode loads the global `AGENTS.md` under that root on every session alongside project `AGENTS.md`; the installer appends one fenced `<!-- chisle-begin -->` … `<!-- chisle-end -->` block after existing user content and refreshes only that block under `--force`/`--update`.
- The bundled `skills/` copy into the config root's `skills/` directory verbatim, discovered on demand through the native `skill` tool. The global skills dir is scanned by default, so `skills.paths` needs no edit and no `instructions` entry is added — no second system message, existing instructions preserved.
- OpenCode does not expose a Chisle mode-toggle lifecycle. The global ruleset is always on, and `/chisle` loads the skill rather than toggling those instructions. Compression reads `CHISLE_DEFAULT_MODE` or the shared config on every hook call; `off` disables compression only.
- Tool-result compression, which static-rule hosts normally cannot get, ships to OpenCode as a native plugin. The installer reads the OpenCode major version: v1 keeps `plugins/chisle.js` plus `plugins/chisle-hooks/`; v2 gets `plugins/chisle/index.js` plus its colocated core. Updating v1 to v2 removes the obsolete v1 entrypoint.
- OpenCode v1 uses `tool.execute.after` plus `experimental.chat.messages.transform`. OpenCode v2 uses `Plugin.define({ id, setup })` and registers `ctx.tool.hook("execute.after", ...)`; it rewrites only model-visible text in `event.result.content`, preserving structured output and metadata. Both entrypoints reuse `compressForOpencode`, `recordSavings`, and the shared configuration code.
- A live OpenCode 1.18.31 smoke test ran one Bash command that emitted 15,537 characters and exited 23. OpenCode delivered it to `tool.execute.after` as a completed tool part with `metadata.exit: 23`; Chisle reduced the model-visible output to 7,092 characters, retained the first line and final `FATAL_FAILED_SMOKE exit=23` diagnostic, preserved the exit metadata, wrote a byte-identical 0600 recovery spill, and recorded one 8,445-character savings event. Failed Bash output is therefore supported in this tested version.
- Both hooks reuse the Claude/Pi compressor core. Eligible output has a final character bound, Unicode-safe head/tail cuts, bounded error windows, and a byte-identical pre-scrub recovery spill. Per-session dedup uses OpenCode's session and call IDs. A bounded output already carrying `[chisle:` is skipped; an oversized source string containing that text is still bounded. Non-string output shapes are skipped.
- The default allowlist contains only known read-heavy OpenCode built-ins, including v1 `bash` and v2 `shell`. MCP names are never inferred safe from underscores; add known read-only tools with `CHISLE_COMPRESS_TOOLS`. Source-bearing and mutating tools remain excluded even when configured. Disable compression with `CHISLE_COMPRESS=0` or `CHISLE_DEFAULT_MODE=off`. Measured on gpt-5.5, a 30 KB `cat` output kept full by OpenCode dropped the tool-ingestion step from 13,382 to 1,747 fresh input tokens (-87%) with an identical, correct answer.

## Copilot CLI delivery

Verified live on Copilot CLI 1.0.95 with a scratch `COPILOT_HOME`:

- User-level hooks in `~/.copilot/hooks/*.json` run without workspace admission. `postToolUse` receives `{ toolName, toolArgs, toolResult: { resultType, textResultForLlm } }`; replying `{ modifiedResult: { resultType, textResultForLlm } }` replaces what the model sees.
- Shell results end with `<shellId: N completed with exit code N>`, which the tail keeps. A 13,932-char `seq` result reached the model at ~100 lines; it still reported the mid-log `ERROR` line, the last line, and exit code 0.
- MCP tool names do not match the Copilot allowlist, so MCP output is left to the proxy below.
- No mode toggle exists; compression follows `CHISLE_DEFAULT_MODE` / the shared config, like OpenCode.

## MCP proxy (hosts without a rewrite hook)

`hooks/chisle-mcp-proxy.js` sits between host and a stdio MCP server. Host→server bytes are forwarded unchanged while `tools/call` ids are noted; server→host lines are forwarded unchanged except responses to those ids, whose `content[]` text blocks go through `transform` (scrub + elide + spill). Verified live in Copilot CLI 1.0.95: a 32k-char tool result reached the model at ~1.4k with the mid-log error line intact (27,734 chars saved).

- No dedup: one server process can serve several chats, and a new chat never saw the earlier copy.
- Tool names matching `read|view|file|edit|write|patch|replace|insert` are never compressed; `structuredContent` is untouched.
- Spill and stats live in `CHISLE_STATE_DIR` or `~/.config/chisle`.

Hosts checked and why they need the proxy (October 2026 docs/source):

| Host | Post-tool rewrite? | Notes |
|------|--------------------|-------|
| Codex | no clean one | `PostToolUse` `continue:false`/`block` replaces the result, but exec results reach the hook without the `Process exited with code N` header, so a replacement would hide failures. MCP via proxy needs a manual TOML edit. |
| Gemini CLI | no | `AfterTool` deny replaces the result as `Tool result blocked: …` with an error flag; `BeforeModel` cannot touch function responses. |
| Cursor | MCP only | `postToolUse.updated_mcp_tool_output`; shell hooks are observational. |
| Windsurf, Cline, Factory Droid, Qwen Code, Kiro | no | Observational hooks, or context injection only. |

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

| Feature | Claude Code | Pi | OpenCode | Copilot CLI | Other static-rule |
|---------|:-----------:|:--:|:--------:|:-----------:|:-----------------:|
| Always-on output rules | ✅ | ✅ | ✅ | ✅ | ✅ |
| Tool-result compression | ✅ | ✅ | ✅ (plugin) | ✅ (hook) | MCP only (`chisle mcp wrap`) |
| `/chisle` on-demand skill | ✅ | ✅ | ✅ (skills) | ❌ | ❌ (static ruleset only) |
| `/chisle` + natural-language toggle | ✅ | ✅ | ❌ (env/config) | ❌ (env/config) | ❌ |
| Status badge + measured savings | ✅ | ✅ | ✅ (`--stats`) | ✅ (`--stats`) | `mcp status` |

Pi's `tool_result` event enables the second input-axis implementation. It patches `content` only, preserving tool-specific `details`, `isError`, and `usage`. `read`, `edit`, and `write` remain excluded. Project-local Pi resources require project trust and extensions run with full user permissions; see [installation](../INSTALL.md#manual-pi-package).
