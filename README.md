<p align="center">
  <img src="assets/logo.png" width="120" alt="Chisle">
</p>

<h1 align="center">Chisle</h1>

<p align="center">
  <em>Your AI talks less, builds less, reads less, and says more.<br>Like a senior dev who bills by the syllable.</em>
</p>

<p align="center">
  <a href="https://github.com/JayPokale/Chisle/stargazers"><img src="https://img.shields.io/github/stars/JayPokale/Chisle?style=flat-square&color=d78a3c&label=stars" alt="Stars"></a>
  <a href="https://www.npmjs.com/package/chisle"><img src="https://img.shields.io/npm/v/chisle?style=flat-square&color=d78a3c&label=npm" alt="npm version"></a>
  <img src="https://img.shields.io/badge/works%20with-13%20agents-d78a3c?style=flat-square" alt="Works with 13 agents">
  <a href="https://github.com/JayPokale/Chisle/actions/workflows/test.yml"><img src="https://img.shields.io/github/actions/workflow/status/JayPokale/Chisle/test.yml?style=flat-square&label=CI" alt="CI"></a>
  <img src="https://img.shields.io/badge/deps-0-2da44e?style=flat-square" alt="Zero dependencies">
  <img src="https://img.shields.io/badge/license-MIT-d78a3c?style=flat-square" alt="MIT license">
  <a href="https://buymeacoffee.com/jaypokale3b"><img src="https://img.shields.io/badge/Buy%20me%20a%20coffee-FFDD00?style=flat-square&logo=buymeacoffee&logoColor=black" alt="Buy me a coffee"></a>
</p>

<p align="center">
  <img src="assets/line.svg" width="100%" height="4" alt="">
</p>

<p align="center">
  <img src="assets/hero.svg" width="880" alt="Chisle versus the same model with no ruleset: 29% fewer billed output tokens, answers 45% shorter, oversized tool output 48% smaller, accuracy 156 of 156 versus 154 of 156.">
</p>

<p align="center">
  <strong>Fewer tokens than caveman and ponytail. No accuracy lost.</strong><br>
  <strong>−29% billed tokens &middot; −45% answer length &middot; −48% oversized tool output</strong><br>
  <strong>And yet: 156/156 on graded problems.</strong> Without Chisle: 154/156.<br>
  <sub>Claude Code + Haiku 4.5, 25 tasks, every arm in one run; accuracy auto-graded, no judge model. Every raw transcript is committed, <a href="https://jaypokale.me/writing/chisle-benchmarks-it-loses">including the runs where Chisle lost</a>. <a href="#numbers">Details</a>.</sub>
</p>

```bash
npx chisle
```

<p align="center">
  <img src="assets/line.svg" width="100%" height="4" alt="">
</p>

Chisle makes Claude Code cheaper to run without making it dumber. It cuts what Claude **writes**: no filler, no hedging, no speculative abstractions, just the smallest code that works. And it cuts what Claude **reads**: oversized tool output is trimmed before it re-enters the context, where it would be billed again on every later turn. One command wires it into Claude Code, Pi, Cursor, Codex, Gemini, Copilot, OpenCode and six more agents.

## Before / after

"Implement an order state machine covering created, paid, shipped, delivered, cancelled and refunded, with the legal transitions enforced and invalid ones rejected." Same model, same prompt, one difference: the injected ruleset. Both answers are the **verbatim committed output** from [`raw-nov-sidebyside/large-s2`](benchmarks/results/raw-nov-sidebyside/large-s2/):

<table>
<tr><th align="left" width="50%">bare model: 121 lines, 1,186 answer tokens</th><th align="left" width="50%">Chisle: 62 lines, 530 answer tokens</th></tr>
<tr valign="top"><td>

A preamble, a custom exception class, docstrings on every method, an extra `can_transition_to` helper:

```python
class OrderStateError(Exception):
    """Raised when an invalid state transition is attempted."""
    pass

class Order:
    # Define valid transitions: state -> list of allowed next states
    VALID_TRANSITIONS = { … }
    def transition_to(self, next_state):
        """Transition to the next state. Raises OrderStateError if invalid."""
    def can_transition_to(self, next_state):
        """Check if a transition is allowed without performing it."""
```

…plus usage, tests, printed output and a recap of the transitions.

</td><td>

Code first, no preamble: one table of legal moves, one method that enforces it:

```python
class OrderStateMachine:
    TRANSITIONS = {
        "created": {"pay", "cancel"},
        "paid": {"ship", "refund", "cancel"},
        …
    }
    def transition(self, event):
        if event not in self.TRANSITIONS[self.state]:
            raise ValueError(f"Cannot {event} from {self.state}. …")
        self.state = self.STATE_MAP[(self.state, event)]
        return self.state
```

Then a short usage block.

</td></tr>
</table>

Same behaviour, under half the tokens. caveman wrote 604 and ponytail 747 on the same prompt.

## Numbers

<p align="center">
  <img src="assets/benchmark.svg" width="860" alt="Claude Code benchmark, 25 tasks in one run, billed output tokens as percent of the same model with no ruleset. caveman 87%, ponytail 90%, Chisle 3.8.1 75%, Chisle 71%.">
</p>

| % of a bare model, lower is leaner | caveman | ponytail | Chisle 3.8.1 | **Chisle** |
|---|--:|--:|--:|--:|
| billed tokens | 87% | 90% | 75% | **71%** |
| answer length | 59% | 62% | 58% | **55%** |
| answer lines | 55% | 60% | 55% | **45%** |

Claude Code + Haiku 4.5, 25 live prompts in one run, tools off ([raw cells](benchmarks/results/raw-nov-sidebyside/)). One run: gaps of a few points are within run-to-run noise. On **Sonnet 5.5** (34 prompts, [raw cells](benchmarks/results/raw-nov-sonnet/)) Chisle bills **57%** of the bare model's output tokens (95% CI 50–64%): it thinks less, so shorter answers come straight off the bill.

**Shorter is not wronger.** Auto-graded, no judge model ([quality cells](benchmarks/quality/raw-nov/), [agentic cells](benchmarks/agentic/raw-nov/)):

| | bare model | **Chisle** |
|---|--:|--:|
| maths + coding, 52 problems × 3 seeds | 154 / 156 | **156 / 156** |
| real repos, hidden tests, 7 fixtures × 6 seeds | 36 / 42 | **38 / 42** |

Neither gap is significant (Fisher p = 0.498, 0.738). Method, intervals and every raw cell: [docs/benchmarks.md](docs/benchmarks.md).

## Reads less, too

<p align="center">
  <img src="assets/trim.svg" width="880" alt="Animated illustration of the Chisle tool-output compressor: raw npm test output with colour codes, six identical lines and 172 passing lines becomes a short version with the codes stripped, the repeats collapsed, the middle elided with the full output saved to a file, and the failing test and its error kept.">
</p>

Tool output is **67.5%** of session context on a measured Claude Code corpus ([comparison](docs/comparison.md)), and it is billed again on every later request. Chisle's hook strips colour codes, collapses repeated lines, and keeps the first 60 lines, the last 40 and the error lines in between of an oversized output. The full output is saved to a file Claude can grep. Each oversized output gets **~48%** smaller. Deterministic, no LLM call, no network. `Read`, `Edit` and `Write` are never touched: their exact bytes feed later edits.

## What it trims

| axis | what | how |
|---|---|---|
| **Output: prose** | filler, hedging, manufactured structure | zero-fluff ruleset, injected per session |
| **Output: code** | speculative abstractions, unrequested boilerplate | the efficiency ladder below |
| **Input: tool output** | oversized output flooding the window | Claude `PostToolUse`, Pi `tool_result`, OpenCode plugin, Copilot CLI `postToolUse` |
| **Input: MCP** | oversized MCP results in any agent | `npx chisle mcp wrap`, a proxy in front of each stdio MCP server ([details](INSTALL.md#mcp-output-compression-any-agent)) |
| **Input: tool schemas** | schemas of tools you never call, re-sent every request | `npx chisle tools trim`: −10% cost per request on the agentic suite; `tools restore` undoes it |
| **Input: cache** | a big context re-bought after the prompt cache expires | after an hour-plus break with 150k+ tokens of context, one line suggests `/compact` or `/clear` |

## How it works

<p align="center">
  <img src="assets/ladder.svg" width="880" alt="The Chisle efficiency ladder. Before writing code, stop at the first rung that holds: 1 does this need to exist at all, 2 already in this codebase, 3 does the stdlib do it, 4 a native platform feature, 5 an already-installed dependency, 6 can it be one line, 7 only then the minimum code that works.">
</p>

The ladder runs *after* reading the code, never instead of it: lazy about the solution, never about understanding. Every rung ends the same way: say what was skipped, so "later" doesn't quietly become "never".

Lazy is not negligent: trust-boundary validation, data-loss handling, security and accessibility are never on the chopping block.

## Install

One command. It auto-detects your agents (Claude Code, Pi, Cursor, Windsurf, Cline, Kiro, Antigravity, Codex, Gemini, Copilot, Copilot CLI, OpenCode, Hermes) and wires each one.

```bash
npx chisle
```

```bash
# or via curl
curl -fsSL https://raw.githubusercontent.com/JayPokale/Chisle/main/install.sh | bash
```

```powershell
# Windows
irm https://raw.githubusercontent.com/JayPokale/Chisle/main/install.ps1 | iex
```

Preview with `npx chisle --dry-run`, scope with `--only claude` or `--only pi`, remove with `npx chisle --uninstall`. Upgrading, per-agent setup, `--stats` and config: [docs/usage.md](docs/usage.md).

## Commands

| Command | What it does |
|---------|--------------|
| *(nothing)* | On automatically every session after install |
| `/chisle` | Turn it back on if you stopped it |
| `/chisle off`, `stop chisle`, `normal mode` | Turn it off (ruleset *and* tool-output trimming) |
| `/chisle-review` | Review a diff for over-engineering: one finding per line, no praise |
| `/chisle-audit` | Audit a diff, a file or the repo for bloated code *and* bloated prose, biggest cut first |
| `/chisle-help` | Quick reference card |
| `npx chisle tools` | Show which tool schemas and skills you pay for but never use; `tools trim` / `tools restore` |
| `npx chisle mcp wrap` | Trim oversized MCP tool output in any agent |

Code, function names, API names and error strings stay verbatim: only the noise around them compresses.

## FAQ

**Does it make Claude dumber?**
No measurable change: 156/156 vs 154/156 on graded problems, 38/42 vs 36/42 on real repos with hidden tests. Neither gap is significant.

**Can it lose something Claude needed?**
Error lines from the trimmed middle are kept, and an elided output is saved in full to a file Claude can search. `Read`, `Edit` and `Write` output is never changed.

**Does it call another model to compress?**
No. Plain rules and a local hook. Zero dependencies.

**Why publish the runs where it lost?**
Because a benchmark you can't check is an ad. [Here's the longer answer](https://jaypokale.me/writing/chisle-benchmarks-it-loses).

**Why "Chisle"?**
A chisel removes everything that isn't the statue.

## Support Chisle

<p align="center">
  <a href="https://buymeacoffee.com/jaypokale3b"><img src="https://cdn.buymeacoffee.com/buttons/v2/default-yellow.png" height="48" alt="Buy me a coffee"></a>
</p>

<p align="center">
  Saved you tokens? <a href="https://github.com/JayPokale/Chisle">⭐ Star the repo</a>. It costs zero tokens and keeps the benchmarks running.
</p>

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md). Built by [Jay Pokale](https://github.com/JayPokale) with [Claude](https://claude.com/claude-code), [Antigravity](https://antigravity.google) and [Codex](https://openai.com/codex/) as co-engineers.

<a href="https://github.com/JayPokale/Chisle/graphs/contributors">
  <img src="https://contrib.rocks/image?repo=JayPokale/Chisle" alt="GitHub contributors">
</a>

## Star History

<a href="https://www.star-history.com/?repos=JayPokale%2FChisle&type=date&legend=top-left">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="https://api.star-history.com/svg?repos=JayPokale/Chisle&type=date&legend=top-left&theme=dark">
    <source media="(prefers-color-scheme: light)" srcset="https://api.star-history.com/svg?repos=JayPokale/Chisle&type=date&legend=top-left">
    <img alt="Star History Chart" src="https://api.star-history.com/svg?repos=JayPokale/Chisle&type=date&legend=top-left">
  </picture>
</a>

## License

[MIT](LICENSE). The shortest license that works.

Chisle began as a merge of [caveman](https://github.com/JuliusBrussee/caveman) (terse prose) and [ponytail](https://github.com/DietrichGebert/ponytail) (lazy-senior-dev code rules), and its ruleset still carries parts of both. Their MIT notices are in [NOTICE](NOTICE).
