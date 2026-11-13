# Installation

## One-line installer (recommended)

```bash
npx chisle
```

Detects supported agents and installs Chisle for each:

| Agent | What gets installed | Scope |
|-------|--------------------|-------|
| Claude Code | plugin, or standalone hooks + statusline fallback | global |
| Pi | package containing extension + skill | global |
| Gemini CLI | Gemini extension | global |
| Codex | fenced ruleset in `~/.codex/AGENTS.md` | global |
| Copilot CLI | fenced ruleset in `~/.copilot/copilot-instructions.md` + `postToolUse` compression hook | global |
| OpenCode | fenced ruleset + skills + compression plugin under the configured OpenCode root | global |
| Hermes Agent | skills in `~/.hermes/skills` (Agent Skills standard, `/chisle` commands) | global |
| Cursor / Windsurf / Cline / Kiro / Copilot / Antigravity | rule file in current project | project |

```bash
npx chisle --list          # detect only
npx chisle --only pi       # one agent; repeatable
npx chisle --dry-run       # preview without mutation
npx chisle --stats         # tool-output savings so far; read-only
npx chisle@latest --update # refresh what is installed; add nothing new
npx chisle --force         # reinstall / overwrite
npx chisle --uninstall     # remove everything installed
npx chisle -u --only pi    # remove only Pi package
```

Shell launchers forward the same flags:

```bash
curl -fsSL https://raw.githubusercontent.com/JayPokale/Chisle/main/install.sh | bash
```

```powershell
irm https://raw.githubusercontent.com/JayPokale/Chisle/main/install.ps1 | iex
```

## Manual Claude Code plugin

```bash
claude plugin marketplace add JayPokale/Chisle
claude plugin install chisle@chisle
```

Restart Claude Code. Chisle activates automatically.

## Manual Pi package

```bash
pi install npm:chisle
# or directly from Git:
pi install git:github.com/JayPokale/Chisle
```

Pi loads `pi-extension/index.js` and `skills/chisle/SKILL.md` from the package. The extension supplies always-on rules, `/chisle`, the status badge, and safe `tool_result` compression. Pi already reads a project's `AGENTS.md`; when that file contains Chisle, the extension does not inject a duplicate rules message. The skill follows progressive disclosure and is also available as `/skill:chisle`.

**Trust boundary:** Pi extensions execute with full user permissions. Review package source before installing. Global packages load for every project. A project-local install:

```bash
pi install -l npm:chisle
```

writes `.pi/settings.json` and loads only after Pi trusts that project.

## Manual OpenCode

```bash
npx chisle --only opencode
```

Writes the fenced Chisle ruleset into the global OpenCode config root
(appended after your existing instructions, never replacing them) and copies the
bundled skills into its `skills/` directory for on-demand loading through
OpenCode's native `skill` tool. The root follows `OPENCODE_CONFIG_DIR`, then
`$XDG_CONFIG_HOME/opencode`, then `~/.config/opencode`. No `instructions` entry
is added, so nothing loads twice. The ruleset is always on; `/chisle` loads the
skill but does not toggle the global instructions.

It also installs the tool-output compression plugin into that root's `plugins/`.
OpenCode v1 keeps `chisle.js` plus `chisle-hooks/`; v2 gets the directory plugin
`chisle/index.js` plus its colocated core. The installer selects the layout from
`opencode --version`. The v1 hooks remain unchanged. The v2 entrypoint uses
`Plugin.define({ id, setup })` and `ctx.tool.hook("execute.after", ...)`, eliding
oversized model-visible text while preserving structured output and metadata.
Both reuse the same compressor and configuration code. MCP tools are not
assumed safe from their names; add known read-only tools with
`CHISLE_COMPRESS_TOOLS`. Source-bearing and mutating tools remain excluded even
when configured. Disable compression with `CHISLE_COMPRESS=0` or
`CHISLE_DEFAULT_MODE=off`; this does not remove the always-on instructions.

## Manual Hermes Agent

```bash
npx chisle --only hermes
```

Copies the bundled skills verbatim into `~/.hermes/skills/` (Agent Skills
standard), where Hermes discovers them as `/chisle` slash commands. No ruleset
is injected and no config file is rewritten: Hermes already reads project
`AGENTS.md`, which carries the always-on axis when the repo ships it.

## Manual Copilot CLI

```bash
npx chisle --only copilot-cli
```

Writes the ruleset into `~/.copilot/copilot-instructions.md` (fenced, your own
instructions kept), copies the compressor to `~/.copilot/chisle-hooks/`, and
registers it as a user-level `postToolUse` hook in `~/.copilot/hooks/chisle.json`.
Oversized `bash`/`grep`/`glob`/web/`task` results are compressed;
`view`/`create`/`edit` never are. Honors `COPILOT_HOME`. Savings:
`npx chisle --stats --only copilot-cli`.

## MCP output compression (any agent)

Agents whose hooks cannot rewrite a tool result (Cursor, Windsurf, Cline, Kiro,
Gemini CLI, Qwen Code, Antigravity, Codex, GitHub Copilot in VS Code) still launch stdio MCP servers from a command line.
`chisle mcp wrap` routes those servers through a small proxy that compresses
oversized `tools/call` results with the same core and passes every other byte
through unchanged:

```bash
npx chisle mcp wrap            # every MCP config found below
npx chisle mcp wrap --only cursor
npx chisle mcp wrap --file ./.cursor/mcp.json   # a project-level file
npx chisle mcp status          # wrapped servers + chars saved
npx chisle mcp unwrap          # restore original commands
```

Covers `~/.cursor/mcp.json`, `~/.codeium/windsurf/mcp_config.json`,
`~/.gemini/settings.json`, `~/.qwen/settings.json`, `~/.kiro/settings/mcp.json`,
`~/.copilot/mcp-config.json`, `~/.gemini/config/mcp_config.json` (Antigravity),
`~/.codex/config.toml` (Codex, honors `CODEX_HOME`), the VS Code user `mcp.json`
(GitHub Copilot, `servers` key) in Code, Code Insiders and VSCodium, and Cline's
`cline_mcp_settings.json` in VS Code, Cursor and Windsurf. Restart the agent afterwards.

- Opt-in, never part of plain `npx chisle`. Files with comments are reported and
  left alone; the first write keeps `<file>.chisle-bak`.
- Only stdio servers are wrapped; `url`/HTTP servers are untouched.
- Tools whose names suggest file content or edits (`read_file`,
  `get_file_contents`, `edit_file`, …) are never compressed.
- Claude Code is never wrapped: its own hook already compresses `mcp__*` output.
- Codex: only the `command`/`args` lines of `[mcp_servers.<name>]` tables change;
  a table with values other than plain strings is skipped. Unwrap restores the
  values (a multi-line `args` array comes back on one line); the untouched
  original stays in `config.toml.chisle-bak`.
- `npx chisle --uninstall` unwraps everything and removes the proxy.

## Upgrading

One command covers every agent that already has Chisle:

```bash
npx chisle@latest --update
```

It refreshes what is installed and adds nothing new. Two details it exists to handle:

- **Plain `npx chisle` does not upgrade.** Every install path skips what is already present, so an upgrade run reports success and changes nothing.
- **`@latest` matters.** `npx` can serve a cached copy of the package from a previous run; the pin is what guarantees you get the new one.

### Per agent

Add `--only <id>` to update one agent. The native command is listed where the agent owns its own installer — either works.

| Agent | Update command | Notes |
|-------|----------------|-------|
| Claude Code | `npx chisle@latest --update --only claude`<br>or `claude plugin update chisle@chisle` | Restart the session afterwards. |
| Pi | `npx chisle@latest --update --only pi`<br>or `pi install npm:chisle` | Needs `pi` on `PATH`, or Chisle reports it as not installed. |
| Gemini CLI | `npx chisle@latest --update --only gemini`<br>or `gemini extensions install https://github.com/JayPokale/Chisle` | Needs `gemini` on `PATH`. |
| Codex | `npx chisle@latest --update --only codex` | Refreshes the fenced block in `~/.codex/AGENTS.md`, leaving your own instructions alone. |
| Copilot CLI | `npx chisle@latest --update --only copilot-cli` | Refreshes the ruleset, compressor and hook under `~/.copilot`. Wrapped MCP servers pick up a new proxy after `npx chisle@latest mcp wrap`. |
| OpenCode | `npx chisle@latest --update --only opencode` | Refreshes the ruleset, skills, and compression plugin under the configured OpenCode root. |
| Hermes Agent | `npx chisle@latest --update --only hermes` | Refreshes the skills in `~/.hermes/skills/`. |
| Cursor | `npx chisle@latest --update --only cursor` | **Run inside the project.** |
| Windsurf | `npx chisle@latest --update --only windsurf` | **Run inside the project.** |
| Cline | `npx chisle@latest --update --only cline` | **Run inside the project.** |
| Kiro | `npx chisle@latest --update --only kiro` | **Run inside the project.** |
| GitHub Copilot | `npx chisle@latest --update --only copilot` | **Run inside the project.** |
| Antigravity | `npx chisle@latest --update --only antigravity` | **Run inside the project.** Writes `.agents/rules/chisle.md`. |

The last six keep their rule file inside the repo, because that is how those agents load rules. `--update` looks for that file in the current directory, so running it from `~` reports *"Nothing to update"* even when the project is set up correctly. Run it once per repo that has one.

Preview any update without touching disk by adding `--dry-run`.

Chisle's Claude hook checks npm at session start and mentions major releases once (cached three days). `CHISLE_UPDATE_CHECK=0` disables that check.

From 2.x to 3.x, replace legacy `lite` / `full` / `ultra` config with `on` / `off`, or remove it.

## Verify

Claude Code: start a session and run `/chisle off`, then `/chisle`.

OpenCode: the configured root's `AGENTS.md` contains the fenced block and `/chisle` resolves as a skill. OpenCode v1 has `plugins/chisle.js`; v2 has `plugins/chisle/index.js`. Oversized `bash` (v1), `shell` (v2), grep, and webfetch output is elided in transcripts.

Hermes: `~/.hermes/skills/chisle/SKILL.md` exists and `/chisle` loads the skill.

Pi: start a session. Footer shows `[CHISLE]`; `/chisle off`, `stop chisle`, or `normal mode` clears it and disables both rules and tool-output compression. `/chisle` re-enables it. Default mode `off` only changes session startup behavior.

Pi's default compression allowlist includes `bash`, `powershell`, `grep`, `find`, `ls`, and MCP tools. Add extension tools explicitly with `CHISLE_COMPRESS_TOOLS`. `read`, `edit`, and `write` are always untouched because exact output may feed later edits.

## Status badge

Pi's extension configures its footer badge automatically. Claude Code's standalone fallback configures the bundled statusline when no existing statusline is present. Manual Claude setup:

```json
{
  "statusLine": {
    "type": "command",
    "command": "bash \"/path/to/chisle/hooks/chisle-statusline.sh\""
  }
}
```

## Uninstall

```bash
npx chisle --uninstall
# or Pi only:
pi remove npm:chisle
pi remove git:github.com/JayPokale/Chisle
```

Pi owns its package entry and cache; `pi remove` removes both without rewriting unrelated `settings.json` values. Project-scoped static rule files remain versioned project files and must be removed per repository.

Global `AGENTS.md` blocks keep surrounding user content: uninstall removes only the fenced `<!-- chisle-begin -->` … `<!-- chisle-end -->` block. Skill copies remove only the `chisle*` skill dirs; foreign skills are untouched.

## Config

Resolution: environment → config file → `on`.

```bash
export CHISLE_DEFAULT_MODE=off
```

```json
// ~/.config/chisle/config.json
{ "defaultMode": "off" }
```

Input-axis switches work across Claude Code, Pi, Copilot, and OpenCode where supported:

```bash
CHISLE_COMPRESS=0
CHISLE_COMPRESS_SCRUB=0
CHISLE_COMPRESS_DEDUP=0
CHISLE_COMPRESS_MAX_CHARS=8000  # also the final OpenCode output bound
CHISLE_COMPRESS_HEAD_LINES=60
CHISLE_COMPRESS_TAIL_LINES=40
CHISLE_COMPRESS_TOOLS=bash,grep
```

`CHISLE_COMPRESS_TOOLS` replaces the allowlist. OpenCode defaults to `bash`,
`grep`, `glob`, `webfetch`, `websearch`, and `list`; configure read-only MCP
tools explicitly. The override cannot enable source-bearing or mutating tools
such as `read`, `edit`, `write`, `patch`, or notebook edits. Their output can
feed later exact-match edits, so this is a correctness guarantee, not a default.
