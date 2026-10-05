# Usage, config and FAQ

The details the [README](../README.md) leaves out.

## Upgrading

```bash
npx chisle@latest --update
```

That refreshes every agent that already has Chisle and installs it into none that don't. Two details it exists to handle:

- **Plain `npx chisle` does not upgrade.** Every install path skips what is already present, so an upgrade run reports success and changes nothing. `--update` pairs the refresh with that check.
- **`@latest` matters.** `npx chisle` can serve a cached copy of the package from a previous run, so the pin is what guarantees you get the new one.

Update one agent at a time with `--only`:

```bash
npx chisle@latest --update --only claude     # or: claude plugin update chisle@chisle
npx chisle@latest --update --only pi         # or: pi install npm:chisle
npx chisle@latest --update --only gemini     # or: gemini extensions install https://github.com/JayPokale/Chisle
npx chisle@latest --update --only codex
npx chisle@latest --update --only opencode   # ruleset + skills + the compression plugin
npx chisle@latest --update --only hermes
```

Cursor, Windsurf, Cline, Kiro, Copilot and Antigravity keep their rule file **inside the repo**, because that is how those agents load rules:

```bash
cd ~/code/my-project
npx chisle@latest --update --only cursor
```

`--update` looks for that file in the current directory, so running it from `~` reports "Nothing to update" even when the project is set up correctly. Run it once per repo that has one. Full table, including what each agent's update actually refreshes: [INSTALL.md](../INSTALL.md#per-agent).

Not sure what you are running? `npx chisle --list` prints the agents it detects, and `claude plugin list` shows the installed plugin and its version.

Chisle checks npm on session start and mentions it once when a **major** version is out (cached 3 days, `CHISLE_UPDATE_CHECK=0` to silence). Minor and patch releases stay quiet on purpose.

Upgrading to 3.0.0 from 2.x needs nothing: a `lite`/`full`/`ultra` value in `CHISLE_DEFAULT_MODE` or `config.json` is no longer meaningful, falls through to the default, and Chisle stays active. It says so once so the setting is not ignored silently. Replace it with `on`/`off` or delete it.

## Claude Code plugin (marketplace)

```bash
claude plugin marketplace add JayPokale/Chisle   # register the marketplace
claude plugin install chisle@chisle              # enable the plugin
```

## Pi package

```bash
pi install npm:chisle
```

The package loads the zero-dependency extension and `chisle` skill globally. Pi extensions run with your user permissions; review the source before installation. Project-local installs (`pi install -l npm:chisle`) load only after you trust that project.

## Where the savings show up

Two places, both measured rather than estimated:

```bash
npx chisle --stats      # what the compressor has saved, cumulative
```

```text
chisle: tool-output savings

  saved:      88,967 chars  (~22,241 tokens)
  outputs:    18 compressed, 4,943 chars each on average
```

In Claude Code the statusline badge carries the same number live: `[CHISLE] ⇣22k tok`. Pi shows it in the footer for the current session.

This is the **input axis only**, and deliberately so. Chars elided have a real baseline, since the hook knows exactly what it cut. The output axis has none: there is no way to know what the model would have written without the ruleset, which is why that half is measured with A/B benchmark arms instead of a counter. A number that blended the two would be inventing the interesting half.

## See what it would do, before it does it

```bash
npx chisle --dry-run    # prints every file it would touch, changes nothing
npx chisle --stats      # prints what it has saved, changes nothing
```

Want the savings measured on your own work rather than ours? Clone the repo and replay the compressor over local transcripts. It reads them locally, writes nothing, and reports the input the hook would have stripped:

```bash
git clone https://github.com/JayPokale/Chisle && cd Chisle
node benchmarks/replay-compress.js       # Claude Code
node benchmarks/replay-compress.js pi    # Pi; marginal over Pi's native truncation
```

## Usage

| Command | Effect |
|---------|--------|
| *(nothing)* | On automatically every session after install |
| `/chisle` | Re-activate if you'd stopped it |
| `/chisle off` | Deactivate |
| `stop chisle` | Deactivate (ruleset *and* input-side compression) |
| `normal mode` | Deactivate |

Natural language works too: "activate chisle", "chisle mode", "chislify this". Code symbols, function/API names, and error strings stay verbatim, so only the noise around them compresses.

## Config

**On by default.** After install, Chisle activates automatically every session, with no `/chisle` needed. Set `off` to stay dormant until you type `/chisle`:

```bash
# env var (highest priority)
export CHISLE_DEFAULT_MODE=off

# config file (persists across shells)
~/.config/chisle/config.json → { "defaultMode": "off" }
```

Resolution: env var → config file → `on`. Valid: `off`, `on`.

**Output styles are detected automatically.** Claude Code's output-style mechanism also governs
prose structure, so an active style and Chisle's prose section give directly conflicting
instructions — the style mandates tables and bullets for comparisons, Chisle's prose section forbids
manufactured tables and bullets the question didn't ask for. Chisle now reads the active style and
steps its prose rules aside on its own. Nothing to configure: run `/output-style Explanatory` and the
prose section stops shipping; switch back to `default` and it returns.

The code rules, the ladder, the context diet and the compressor are all unaffected — output styles
govern prose, so only the prose section yields.

Detection reads the `outputStyle` key across Claude Code's own settings precedence
(`.claude/settings.local.json`, where `/output-style` writes, then `.claude/settings.json`, then
`~/.claude/settings.json`). Claude Code only — Pi and OpenCode have no output-style mechanism, so
there is nothing to detect and nothing changes for them.

**Suppress a rule group manually.** The same `sections` key gives explicit control, and it always
beats detection — set `prose: true` to keep Chisle's prose rules even with a style active:

```json
{ "sections": { "prose": false } }
```

`sections.prose: false` suppresses the prose rules; `sections.code: false` suppresses the code
rules. Config file only, no env override. Anything absent, malformed, or non-boolean falls back to
enabled, which is also what lets automatic detection apply — only an explicitly written boolean
overrides it. With no style active and nothing configured, the emitted ruleset is byte-identical to
before either feature existed. The always-on sections
(Persistence, Thinking Is Billed Too, Auto-Clarity, When NOT to be lazy, Boundaries) ship regardless
of either setting.

Scope: this only affects the runtime-hook agents that read `skills/chisle/SKILL.md` live — Claude
Code and Pi. The eight static-rule agents built by `scripts/build-rules.js` (Cursor, Windsurf,
Cline, Kiro, Antigravity, Codex, Gemini, Copilot) get flat files baked at build time with no runtime config to
read, so they can't honor this key.

## Multi-agent

Ships to twelve agents: Claude Code and Pi get both axes, live `/chisle` toggling, and a status badge; OpenCode gets both axes too — the global fenced ruleset, on-demand skills, and a native compression plugin — but no live toggle; Cursor, Windsurf, Cline, Kiro, Antigravity, Codex, Gemini, and Copilot get the always-on ruleset; Hermes gets the skills as `/chisle` commands. Per-agent static copies come from `scripts/build-rules.js`; Pi uses its package extension plus the Agent Skills standard. See [agent portability](agent-portability.md).

## Prior art & what stacks with it

Chisle borrows the best published token-saving techniques and implements the ones that fit a zero-dep hook; the rest stack cleanly alongside it:

| technique | source | in Chisle? |
|---|---|---|
| Prose compression persona | [caveman](https://github.com/JuliusBrussee/caveman) | ✅ + code judgment it lacks |
| YAGNI/lazy-code ruleset | [ponytail](https://github.com/dietrichgebert/ponytail) | ✅ + prose discipline it lacks |
| Tool-output elision (head/tail) | [headroom](https://github.com/headroomlabs-ai/headroom)-style, proxy-free | ✅ hook, no proxy, works on subscription OAuth |
| ANSI strip / log crush / dedup | headroom transforms | ✅ scrub + dedup tiers |
| Command rewriting at the source | RTK-style `PreToolUse` ([writeup](https://andrewpatterson.dev/posts/token-savings-rtk-headroom/)) | ❌ stacks; RTK shrinks at source, Chisle catches what it can't reach (subagents, MCP, web) |
| MCP/codebase-graph indexing | context-mode, [token-optimizer-mcp](https://github.com/ooples/token-optimizer-mcp) | ❌ stacks, orthogonal layer |
| CLAUDE.md dieting | [community guides](https://www.firecrawl.dev/blog/claude-code-token-efficiency) | ✅ `/chisle-audit` flags bloated docs/config prose |

## FAQ

**Doesn't injecting a persona every turn cost tokens?**
Claude Code uses a ruleset at session start (~900 tokens) plus a ~50-token reminder per turn. Pi injects one persistent rules message only when project `AGENTS.md` does not already provide it; resume/reload does not duplicate it, and compaction restores it only if removed.

Worth reading the dissent before you take that on faith: [@enc0ded](https://github.com/enc0ded) measured 173 of their own sessions ([#2](https://github.com/JayPokale/Chisle/issues/2)) and found the injection overhead roughly cancelling the compressor's savings, because the ruleset was being re-sent on every resume and clear, not just at startup. That re-injection is fixed, which removes most of the overhead they measured, but their wider point stands: prose is only ~25% of what the model emits, so the ceiling on the output axis is lower than the headline suggests, and on a one-line throwaway prompt the overhead still exceeds the saving.

**Will it golf my code into clever one-liners?**
No. Boring over clever. Deletion beats addition; obfuscation isn't deletion.

**Does it cut corners on safety?**
Never. Input validation, data-loss handling, security, and accessibility are off the table. Lazy about solutions, not about reading the problem.

**Can the output compressor eat a line I needed?**
Designed not to: allowlist keeps `Read`/`Edit` exact, error-looking lines are salvaged from any elided region, dedup only fires on byte-identical same-session repeats, and every tier has a kill switch. If it still bites you, file an issue. That's a bug, not the design.

**Should the star count worry me?**
Everyone starts at zero. Run `npx chisle --dry-run`, see what it'd do, decide. And if the receipts convinced you, [a star](https://github.com/JayPokale/Chisle/stargazers) is how the next person finds them, and it's also the only payment a zero-dep MIT tool will ever ask for.

→ [More FAQ and competitor comparison](comparison.md)
