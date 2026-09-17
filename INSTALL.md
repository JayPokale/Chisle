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
| OpenCode | fenced ruleset in `~/.config/opencode/AGENTS.md` + skills in `~/.config/opencode/skills` + compression plugin in `~/.config/opencode/plugins` | global |
| Hermes Agent | skills in `~/.hermes/skills` (Agent Skills standard, `/chisle` commands) | global |
| Cursor / Windsurf / Cline / Kiro / Copilot | rule file in current project | project |

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

Writes the fenced Chisle ruleset into the global `~/.config/opencode/AGENTS.md`
(appended after your existing instructions, never replacing them) and copies the
bundled skills into `~/.config/opencode/skills/` for on-demand loading through
OpenCode's native `skill` tool. No `instructions` entry is added, so nothing
loads twice. Invoke with `/chisle` or let the ruleset apply automatically.

It also installs the tool-output compression plugin into
`~/.config/opencode/plugins/` (`chisle.js` plus its zero-dep compressor core in
`chisle-hooks/`, pinned to CommonJS so the config dir's `type: module` does not
propagate into it). OpenCode loads it at startup. It hooks `tool.execute.after`
(mutating `output.output`, which persists onto the stored tool part) and
`experimental.chat.messages.transform` (a request-time safety net over
completed tool parts), eliding oversized read-only tool output (bash, grep,
webfetch, MCP `server_tool` results) before the model reads it, keeping
`read`/`edit`/`write` untouched. Disable it with `CHISLE_COMPRESS=0` or
`CHISLE_DEFAULT_MODE=off`.

## Manual Hermes Agent

```bash
npx chisle --only hermes
```

Copies the bundled skills verbatim into `~/.hermes/skills/` (Agent Skills
standard), where Hermes discovers them as `/chisle` slash commands. No ruleset
is injected and no config file is rewritten: Hermes already reads project
`AGENTS.md`, which carries the always-on axis when the repo ships it.

## Upgrading

```bash
npx chisle
claude plugin update chisle@chisle
pi update npm:chisle
npx chisle@latest --update   # refreshes OpenCode + Hermes copies too
```

Chisle's Claude hook checks npm at session start and mentions major releases once (cached three days). `CHISLE_UPDATE_CHECK=0` disables that check.

From 2.x to 3.x, replace legacy `lite` / `full` / `ultra` config with `on` / `off`, or remove it.

## Verify

Claude Code: start a session and run `/chisle off`, then `/chisle`.

OpenCode: `~/.config/opencode/AGENTS.md` contains the fenced block and `/chisle` resolves as a skill. `~/.config/opencode/plugins/chisle.js` exists and oversized bash/grep/webfetch output is elided in transcripts.

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

Input-axis switches work identically on Claude Code and Pi:

```bash
CHISLE_COMPRESS=0
CHISLE_COMPRESS_SCRUB=0
CHISLE_COMPRESS_DEDUP=0
CHISLE_COMPRESS_MAX_CHARS=8000
CHISLE_COMPRESS_HEAD_LINES=60
CHISLE_COMPRESS_TAIL_LINES=40
CHISLE_COMPRESS_TOOLS=bash,grep
```

`CHISLE_COMPRESS_TOOLS` replaces the allowlist, but it cannot switch off the
`read`/`edit`/`write` exclusion — naming them has no effect on any agent. That
output feeds later exact-match edits, so eliding it would make the model edit
text it never saw; it is a correctness guarantee, not a default.
