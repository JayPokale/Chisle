<h1 align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="assets/readme/banner-dark.svg">
    <img src="assets/readme/banner-light.svg" width="100%" alt="Chisle: fewer tokens in, fewer tokens out, same answers.">
  </picture>
</h1>

<p align="center">
  <a href="https://github.com/JayPokale/Chisle/stargazers"><img src="https://img.shields.io/github/stars/JayPokale/Chisle?style=flat-square&color=d78a3c&label=stars" alt="GitHub stars"></a>
  <a href="https://www.npmjs.com/package/chisle"><img src="https://img.shields.io/npm/v/chisle?style=flat-square&color=d78a3c&label=npm" alt="npm version"></a>
  <a href="https://www.npmjs.com/package/chisle"><img src="https://img.shields.io/npm/dm/chisle?style=flat-square&color=d78a3c&label=downloads" alt="npm downloads per month"></a>
  <img src="https://img.shields.io/badge/agents-13-d78a3c?style=flat-square" alt="Works with 13 agents">
  <a href="LICENSE"><img src="https://img.shields.io/badge/license-MIT-d78a3c?style=flat-square" alt="MIT license"></a>
  <a href="https://buymeacoffee.com/jaypokale3b"><img src="https://img.shields.io/badge/Buy%20me%20a%20coffee-FFDD00?style=flat-square&logo=buymeacoffee&logoColor=black" alt="Buy me a coffee"></a>
</p>

<p align="center">
  <sub><b>English</b> &middot; <a href="i18n/README.es.md">Español</a> &middot; <a href="i18n/README.ko.md">한국어</a> &middot; <a href="i18n/README.zh-CN.md">简体中文</a> &middot; <a href="i18n/README.ja.md">日本語</a></sub>
</p>

<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="assets/readme/stats-dark.svg">
    <img src="assets/readme/stats-light.svg" width="880" alt="Chisle versus the same model with no ruleset: 29% fewer billed output tokens, answers 45% shorter, oversized tool output 48% smaller, accuracy 156 of 156 versus 154 of 156.">
  </picture>
</p>

<p align="center"><b>Fewer tokens than caveman and ponytail. No accuracy lost.</b></p>

```bash
npx chisle
```

<p align="center">
  <a href="https://buymeacoffee.com/jaypokale3b">
    <picture>
      <source media="(prefers-color-scheme: dark)" srcset="assets/readme/strip-dark.svg">
      <img src="assets/readme/strip-light.svg" width="880" alt="Chisle is free. Its benchmarks aren't. Saved you tokens? Buy me a coffee.">
    </picture>
  </a>
</p>

<p align="center"><img src="assets/readme/line.svg" width="100%" height="4" alt=""></p>

<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="assets/readme/race-dark.svg">
    <img src="assets/readme/race-light.svg" width="880" alt="Same prompt, four rulesets, visible answer tokens: Chisle 530, caveman 604, ponytail 747, no ruleset 1,186. Chisle is 55% shorter than no ruleset.">
  </picture>
</p>

<details>
<summary><b>See both answers</b></summary>
<br>

The prompt: *"Implement an order state machine covering created, paid, shipped, delivered, cancelled and refunded, with the legal transitions enforced and invalid ones rejected."* Excerpts from the verbatim committed answers in [`raw-nov-sidebyside/large-s2`](benchmarks/results/raw-nov-sidebyside/large-s2/):

<table>
<tr><th align="left" width="50%">no ruleset: 121 lines, 1,186 answer tokens</th><th align="left" width="50%">Chisle: 62 lines, 530 answer tokens</th></tr>
<tr valign="top"><td>

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

</details>

<p align="center"><img src="assets/readme/line.svg" width="100%" height="4" alt=""></p>

<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="assets/benchmark.svg">
    <img src="assets/benchmark-light.svg" width="860" alt="Claude Code benchmark, 25 tasks in one run, billed output tokens as percent of the same model with no ruleset. caveman 87%, ponytail 90%, Chisle 3.8.1 75%, Chisle 71%.">
  </picture>
</p>

<p align="center"><sub>Every raw transcript is committed, losses included. <a href="docs/benchmarks.md">Method and data</a> · <a href="https://jaypokale.me/writing/chisle-benchmarks-it-loses">why we publish the losses</a></sub></p>

<p align="center"><img src="assets/readme/line.svg" width="100%" height="4" alt=""></p>

<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="assets/readme/trim-dark.svg">
    <img src="assets/readme/trim-light.svg" width="880" alt="Animated illustration of the Chisle tool-output compressor: raw npm test output with colour codes, six identical lines and 172 passing lines becomes a short version with the codes stripped, the repeats collapsed, the middle elided with the full output saved to a file, and the failing test and its error kept.">
  </picture>
</p>

<p align="center"><img src="assets/readme/line.svg" width="100%" height="4" alt=""></p>

<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="assets/readme/ladder-dark.svg">
    <img src="assets/readme/ladder-light.svg" width="880" alt="The Chisle efficiency ladder. Before writing code, stop at the first rung that holds: 1 does this need to exist at all, 2 already in this codebase, 3 does the stdlib do it, 4 a native platform feature, 5 an already-installed dependency, 6 can it be one line, 7 only then the minimum code that works.">
  </picture>
</p>

<p align="center"><img src="assets/readme/line.svg" width="100%" height="4" alt=""></p>

<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="assets/readme/install-dark.svg">
    <img src="assets/readme/install-light.svg" width="880" alt="Animated terminal: npx chisle detects Claude Code, Gemini CLI, Codex, OpenCode, Copilot CLI and Cursor, installs into each, and prints Done.">
  </picture>
</p>

<details>
<summary><b>Other ways to install</b></summary>
<br>

```bash
# Claude Code plugin marketplace
claude plugin marketplace add JayPokale/Chisle
claude plugin install chisle@chisle

# curl
curl -fsSL https://raw.githubusercontent.com/JayPokale/Chisle/main/install.sh | bash
```

```powershell
# Windows
irm https://raw.githubusercontent.com/JayPokale/Chisle/main/install.ps1 | iex
```

Per-agent setup, upgrading and config: [docs/usage.md](docs/usage.md).

</details>

<p align="center"><img src="assets/readme/line.svg" width="100%" height="4" alt=""></p>

<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="assets/readme/commands-dark.svg">
    <img src="assets/readme/commands-light.svg" width="880" alt="Cheat sheet: npx chisle wires every agent; --dry-run previews; --uninstall puts everything back; /chisle off pauses it; /chisle-review finds over-engineering; /chisle-audit finds bloated code and prose; npx chisle tools shows tool schemas you pay for but never use; npx chisle mcp wrap trims MCP output in any agent.">
  </picture>
</p>

<p align="center"><img src="assets/readme/line.svg" width="100%" height="4" alt=""></p>

<p align="center">
  <a href="https://www.star-history.com/#JayPokale/Chisle&Date">
    <picture>
      <source media="(prefers-color-scheme: dark)" srcset="https://raw.githubusercontent.com/JayPokale/Chisle/stars/stars-dark.svg">
      <img src="https://raw.githubusercontent.com/JayPokale/Chisle/stars/stars-light.svg" width="880" alt="GitHub stars over time">
    </picture>
  </a>
</p>

<p align="center"><img src="assets/readme/line.svg" width="100%" height="4" alt=""></p>

<p align="center">
  <a href="https://buymeacoffee.com/jaypokale3b">
    <picture>
      <source media="(prefers-color-scheme: dark)" srcset="assets/readme/support-dark.svg">
      <img src="assets/readme/support-light.svg" width="880" alt="Chisle is free. Its benchmarks aren't. Every benchmark run costs real API money. Saved you tokens? Buy me a coffee.">
    </picture>
  </a>
</p>

<p align="center"><a href="https://github.com/JayPokale/Chisle/stargazers">⭐ Star the repo</a>: it costs zero tokens.</p>

<p align="center">
  <a href="https://github.com/JayPokale/Chisle/graphs/contributors"><img src="https://contrib.rocks/image?repo=JayPokale/Chisle" alt="Contributors"></a>
</p>

<p align="center"><sub><a href="LICENSE">MIT</a> · <a href="CONTRIBUTING.md">Contributing</a> · Began as a merge of <a href="https://github.com/JuliusBrussee/caveman">caveman</a> and <a href="https://github.com/DietrichGebert/ponytail">ponytail</a> (<a href="NOTICE">notices</a>)</sub></p>
