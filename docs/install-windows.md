# Installing on Windows

Chisle works on Windows via Claude Code's `commandWindows` hook variant and a
PowerShell statusline script. No WSL required.

## Plugin

Add to `%USERPROFILE%\.claude\settings.json`:

```json
{
  "plugins": ["C:\\path\\to\\chisle"]
}
```

The hooks in `plugin.json` already declare `commandWindows` variants, so Claude
Code runs the PowerShell-safe form automatically. Node.js must be on `PATH`.

## Statusline

```json
{
  "statusLine": {
    "type": "command",
    "command": "powershell -ExecutionPolicy Bypass -File \"C:\\path\\to\\chisle\\hooks\\chisle-statusline.ps1\""
  }
}
```

## Flag files

On Windows the flag lives at:

```
%CLAUDE_CONFIG_DIR%\.chisle-active        (defaults to %USERPROFILE%\.claude)
%CLAUDE_CONFIG_DIR%\.chisle-statusline-suffix
```

The symlink-safety checks in `chisle-config.js` fall back to a home-directory
containment check on Windows (where `process.getuid` is unavailable).

## Troubleshooting

- **Badge not showing** → confirm `chisle-statusline.ps1` runs: `powershell -File hooks\chisle-statusline.ps1`
- **Hook not firing** → confirm `node --version` works in a fresh terminal
- **Garbled colors** → your terminal may not support ANSI; Windows Terminal does
