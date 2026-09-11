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
| Pi | `package.json#pi` → `pi-extension/` + `skills/` | Pi package |
| Codex | `.codex-plugin/plugin.json` → `AGENTS.md` | AGENTS.md |
| Gemini | `gemini-extension.json` → `GEMINI.md` | context file |
| Cursor | `.cursor/rules/chisle.mdc` | MDC, `alwaysApply: true` |
| Windsurf | `.windsurf/rules/chisle.md` | `trigger: always_on` |
| Cline | `.clinerules/chisle.md` | plain markdown |
| Kiro | `.kiro/steering/chisle.md` | `inclusion: always` |
| GitHub Copilot | `.github/copilot-instructions.md` | plain markdown |

## Pi discovery and always-on delivery

Verified against Pi 0.85.1:

- Pi reads project `AGENTS.md` unchanged as an always-on context file.
- Pi implements the Agent Skills standard, but this repo's top-level `skills/` directory is not a project discovery location by itself. The package manifest explicitly exposes it; Pi then lists `chisle` for progressive disclosure and `/skill:chisle`.
- Progressive-disclosure skills are not always-on. `pi-extension/index.js` injects the existing skill body once as a hidden persistent message when project `AGENTS.md` does not already provide Chisle. Resume and reload reuse that message; compaction restores it only when it fell out of active context.
- The extension requires the existing compressor core from `hooks/`; no mirrored compressor or generated Pi rule exists, so no extra sync target is needed.

## Keeping copies in sync

```bash
node scripts/build-rules.js          # regenerate all copies
node scripts/build-rules.js --check  # CI gate — fails if any drifted
```

CI runs `--check` on every push. Edit the body in `build-rules.js`, regenerate,
commit. The generated files are committed (not built on install) so marketplace
and `git clone` installs work without a build step.

## Runtime feature map

| Feature | Claude Code | Pi | Static-rule agents |
|---------|:-----------:|:--:|:------------------:|
| Always-on output rules | ✅ | ✅ | ✅ |
| Tool-result compression | ✅ | ✅ | ❌ |
| `/chisle` + natural-language toggle | ✅ | ✅ | ❌ |
| Status badge + measured savings | ✅ | ✅ | ❌ |

Pi's `tool_result` event enables the second input-axis implementation. It patches `content` only, preserving tool-specific `details`, `isError`, and `usage`. `read`, `edit`, and `write` remain excluded. Project-local Pi resources require project trust and extensions run with full user permissions; see [installation](../INSTALL.md#manual-pi-package).
