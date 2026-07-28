# Installation

## One-line installer (recommended)

```bash
npx chisle
```

Detects every supported agent on your machine and installs Chisle for each:

| Agent | What gets installed | Scope |
|-------|--------------------|-------|
| Claude Code | plugin (or standalone hooks + statusline) | global |
| Gemini CLI | `gemini extensions install` | global |
| Codex | fenced ruleset in `~/.codex/AGENTS.md` | global |
| Cursor / Windsurf / Cline / Kiro / Copilot | rule file in the current project | project |

Flags:

```bash
npx chisle --list          # show detected agents, install nothing
npx chisle --only claude   # one agent
npx chisle --dry-run       # preview, change nothing
npx chisle --force         # reinstall / overwrite
npx chisle --uninstall     # remove everything it added
```

curl / PowerShell one-liners:

```bash
curl -fsSL https://raw.githubusercontent.com/JayPokale/Chisle/main/install.sh | bash
```
```powershell
irm https://raw.githubusercontent.com/JayPokale/Chisle/main/install.ps1 | iex
```

## Manual Claude Code plugin

```bash
claude plugin marketplace add JayPokale/Chisle   # register the marketplace
claude plugin install chisle@chisle              # enable the plugin
```

Restart Claude Code. Chisle activates automatically on every session.

## Upgrading

Re-run the installer — it is idempotent and overwrites the previous copy:

```bash
npx chisle                            # npm / standalone
claude plugin update chisle@chisle    # Claude Code plugin
```

Chisle checks npm at session start and mentions a **major** release once
(cached 3 days; `CHISLE_UPDATE_CHECK=0` silences it). Minor and patch releases
stay quiet.

**From 2.x to 3.0.0:** nothing to do. `lite`/`full`/`ultra` in
`CHISLE_DEFAULT_MODE` or `config.json` no longer means anything, falls through
to the default, and Chisle stays active — it just says so once rather than
ignoring your setting silently. Replace it with `on`/`off` or delete it.

## Statusline badge

To show the `[CHISLE]` badge with rate-limit usage (or session cost on API keys) in your Claude Code statusline, also add:

```json
{
  "statusLine": {
    "type": "command",
    "command": "bash \"/path/to/chisle/hooks/chisle-statusline.sh\""
  }
}
```

If you don't configure it manually, Claude will offer to set it up on first session.

## Verify it's working

Start a Claude Code session. You should see:

```
CHISLE MODE ACTIVE — level: full
```

in the session context. `/chisle off` stops it.

## Uninstall

Remove the `plugins` entry from `~/.claude/settings.json` and delete the flag files:

```bash
rm -f ~/.claude/.chisle-active
rm -f ~/.claude/.chisle-session-turns
rm -f ~/.claude/.chisle-statusline-suffix
```

## Config

Override default level via environment variable:

```bash
export CHISLE_DEFAULT_MODE=off   # on | off
```

Or via config file at `~/.config/chisle/config.json`:

```json
{ "defaultMode": "off" }
```
