# Agent portability

Chisle is primarily a Claude Code plugin, but the same instruction set ships
to every agent that supports a rules/context file. One source, many targets.

## Source of truth

`skills/chisle/SKILL.md` defines behavior. The short always-on rule lives in
`rules/chisle-activate.md`. Per-agent copies are **generated** from a shared body in
`scripts/build-rules.js` — never hand-edit the generated files.

## Distribution map

| Agent | File | Format |
|-------|------|--------|
| Claude Code | `.claude-plugin/plugin.json` + `skills/` + `hooks/` | plugin |
| Codex | `.codex-plugin/plugin.json` → `AGENTS.md` | AGENTS.md |
| Gemini | `gemini-extension.json` → `GEMINI.md` | context file |
| Cursor | `.cursor/rules/chisle.mdc` | MDC, `alwaysApply: true` |
| Windsurf | `.windsurf/rules/chisle.md` | `trigger: always_on` |
| Cline | `.clinerules/chisle.md` | plain markdown |
| Kiro | `.kiro/steering/chisle.md` | `inclusion: always` |
| GitHub Copilot | `.github/copilot-instructions.md` | plain markdown |

## Keeping copies in sync

```bash
node scripts/build-rules.js          # regenerate all copies
node scripts/build-rules.js --check  # CI gate — fails if any drifted
```

CI runs `--check` on every push. Edit the body in `build-rules.js`, regenerate,
commit. The generated files are committed (not built on install) so marketplace
and `git clone` installs work without a build step.

## What does NOT port

The statusline badge, token-savings counter, and `/chisle` slash commands are
Claude-Code-specific (they rely on its hook + statusline APIs). On other agents
the instruction set still applies; only the live mode-switching UI is absent.
