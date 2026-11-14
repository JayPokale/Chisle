<!-- Translated from ../README.md. Keep images, numbers and links in sync with it. -->
<h1 align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="../assets/readme/banner-dark.svg">
    <img src="../assets/readme/banner-light.svg" width="100%" alt="Chisle：输入更少 token，输出更少 token，答案不变。">
  </picture>
</h1>

<p align="center">
  <a href="https://github.com/JayPokale/Chisle/stargazers"><img src="https://img.shields.io/github/stars/JayPokale/Chisle?style=flat-square&color=d78a3c&label=stars" alt="GitHub stars"></a>
  <a href="https://www.npmjs.com/package/chisle"><img src="https://img.shields.io/npm/v/chisle?style=flat-square&color=d78a3c&label=npm" alt="npm version"></a>
  <a href="https://www.npmjs.com/package/chisle"><img src="https://img.shields.io/npm/dm/chisle?style=flat-square&color=d78a3c&label=downloads" alt="npm downloads per month"></a>
  <img src="https://img.shields.io/badge/agents-13-d78a3c?style=flat-square" alt="Works with 13 agents">
  <a href="../LICENSE"><img src="https://img.shields.io/badge/license-MIT-d78a3c?style=flat-square" alt="MIT license"></a>
  <a href="https://buymeacoffee.com/jaypokale3b"><img src="https://img.shields.io/badge/Buy%20me%20a%20coffee-FFDD00?style=flat-square&logo=buymeacoffee&logoColor=black" alt="Buy me a coffee"></a>
</p>

<p align="center">
  <sub><a href="../README.md">English</a> &middot; <a href="README.es.md">Español</a> &middot; <a href="README.ko.md">한국어</a> &middot; <b>简体中文</b> &middot; <a href="README.ja.md">日本語</a></sub>
</p>

<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="../assets/readme/stats-dark.svg">
    <img src="../assets/readme/stats-light.svg" width="880" alt="Chisle 对比无规则集的同一模型：计费输出 token 减少 29%，回答缩短 45%，超大工具输出缩小 48%，准确率 156/156 对 154/156。">
  </picture>
</p>

<p align="center"><b>比 caveman 和 ponytail 更省 token，准确率不降。</b></p>

```bash
npx chisle
```

<p align="center">
  <a href="https://buymeacoffee.com/jaypokale3b">
    <picture>
      <source media="(prefers-color-scheme: dark)" srcset="../assets/readme/strip-dark.svg">
      <img src="../assets/readme/strip-light.svg" width="880" alt="Chisle 是免费的，基准测试可不是。帮你省下了 token？请我喝杯咖啡吧。">
    </picture>
  </a>
</p>

<p align="center"><img src="../assets/readme/line.svg" width="100%" height="4" alt=""></p>

<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="../assets/readme/race-dark.svg">
    <img src="../assets/readme/race-light.svg" width="880" alt="同一个提示词，四种规则集，可见回答 token：Chisle 530，caveman 604，ponytail 747，无规则集 1,186。Chisle 比无规则集短 55%。">
  </picture>
</p>

<details>
<summary><b>查看两个回答</b></summary>
<br>

提示词：*"Implement an order state machine covering created, paid, shipped, delivered, cancelled and refunded, with the legal transitions enforced and invalid ones rejected."* 以下摘自已提交的原始回答 [`raw-nov-sidebyside/large-s2`](../benchmarks/results/raw-nov-sidebyside/large-s2/)：

<table>
<tr><th align="left" width="50%">无规则集：121 行，1,186 个回答 token</th><th align="left" width="50%">Chisle：62 行，530 个回答 token</th></tr>
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

……外加用法示例、测试、打印输出和状态转换总结。

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

然后是一段简短的用法示例。

</td></tr>
</table>

</details>

<p align="center"><img src="../assets/readme/line.svg" width="100%" height="4" alt=""></p>

<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="../assets/benchmark.svg">
    <img src="../assets/benchmark-light.svg" width="860" alt="Claude Code 基准测试，一次运行 25 个任务，计费输出 token 占无规则集同一模型的百分比。caveman 87%，ponytail 90%，Chisle 3.8.1 75%，Chisle 71%。">
  </picture>
</p>

<p align="center"><sub>所有原始记录都已提交，包括输掉的那些。<a href="../docs/benchmarks.md">方法与数据</a> · <a href="https://jaypokale.me/writing/chisle-benchmarks-it-loses">为什么公开输掉的结果</a></sub></p>

<p align="center"><img src="../assets/readme/line.svg" width="100%" height="4" alt=""></p>

<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="../assets/readme/trim-dark.svg">
    <img src="../assets/readme/trim-light.svg" width="880" alt="Chisle 工具输出压缩器的动画示意：一段带颜色代码、六行重复内容和 172 行通过测试的 npm test 输出变成简短版本：去掉颜色代码，折叠重复行，省略中间部分并把完整输出保存到文件，保留失败的测试和它的错误。">
  </picture>
</p>

<p align="center"><img src="../assets/readme/line.svg" width="100%" height="4" alt=""></p>

<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="../assets/readme/ladder-dark.svg">
    <img src="../assets/readme/ladder-light.svg" width="880" alt="Chisle 效率阶梯。写代码之前，停在第一个成立的台阶：1 这真的需要存在吗，2 代码库里已经有了吗，3 标准库能做吗，4 平台原生功能能做吗，5 已安装的依赖能做吗，6 能写成一行吗，7 最后才写能工作的最少代码。">
  </picture>
</p>

<p align="center"><img src="../assets/readme/line.svg" width="100%" height="4" alt=""></p>

<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="../assets/readme/install-dark.svg">
    <img src="../assets/readme/install-light.svg" width="880" alt="动画终端：npx chisle 检测到 Claude Code、Gemini CLI、Codex、OpenCode、Copilot CLI 和 Cursor，逐个安装，然后输出 Done。">
  </picture>
</p>

<details>
<summary><b>其他安装方式</b></summary>
<br>

```bash
# Claude Code 插件市场
claude plugin marketplace add JayPokale/Chisle
claude plugin install chisle@chisle

# curl
curl -fsSL https://raw.githubusercontent.com/JayPokale/Chisle/main/install.sh | bash
```

```powershell
# Windows
irm https://raw.githubusercontent.com/JayPokale/Chisle/main/install.ps1 | iex
```

各智能体的配置、升级和设置：[docs/usage.md](../docs/usage.md)。

</details>

<p align="center"><img src="../assets/readme/line.svg" width="100%" height="4" alt=""></p>

<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="../assets/readme/commands-dark.svg">
    <img src="../assets/readme/commands-light.svg" width="880" alt="速查表：npx chisle 配置所有智能体；--dry-run 先预览；--uninstall 全部还原；/chisle off 暂停；/chisle-review 检查过度设计；/chisle-audit 审计臃肿的代码和文字；npx chisle tools 列出你付了费却从不使用的工具 schema；npx chisle mcp wrap 在任何智能体中精简 MCP 输出。">
  </picture>
</p>

<p align="center"><img src="../assets/readme/line.svg" width="100%" height="4" alt=""></p>

<p align="center">
  <a href="https://www.star-history.com/#JayPokale/Chisle&Date">
    <picture>
      <source media="(prefers-color-scheme: dark)" srcset="https://raw.githubusercontent.com/JayPokale/Chisle/stars/stars-dark.svg">
      <img src="https://raw.githubusercontent.com/JayPokale/Chisle/stars/stars-light.svg" width="880" alt="GitHub 星标增长曲线">
    </picture>
  </a>
</p>

<p align="center"><img src="../assets/readme/line.svg" width="100%" height="4" alt=""></p>

<p align="center">
  <a href="https://buymeacoffee.com/jaypokale3b">
    <picture>
      <source media="(prefers-color-scheme: dark)" srcset="../assets/readme/support-dark.svg">
      <img src="../assets/readme/support-light.svg" width="880" alt="Chisle 是免费的，基准测试可不是。每次运行基准测试都要花真金白银的 API 费用。帮你省下了 token？请我喝杯咖啡吧。">
    </picture>
  </a>
</p>

<p align="center"><a href="https://github.com/JayPokale/Chisle/stargazers">⭐ 给仓库点个星</a>：一个 token 都不花。</p>

<p align="center">
  <a href="https://github.com/JayPokale/Chisle/graphs/contributors"><img src="https://contrib.rocks/image?repo=JayPokale/Chisle" alt="Contributors"></a>
</p>

<p align="center"><sub><a href="../LICENSE">MIT</a> · <a href="../CONTRIBUTING.md">参与贡献</a> · 最初由 <a href="https://github.com/JuliusBrussee/caveman">caveman</a> 和 <a href="https://github.com/DietrichGebert/ponytail">ponytail</a> 合并而来（<a href="../NOTICE">声明</a>）</sub></p>
