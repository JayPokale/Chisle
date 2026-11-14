<!-- Translated from ../README.md. Keep images, numbers and links in sync with it. -->
<h1 align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="../assets/readme/banner-dark.svg">
    <img src="../assets/readme/banner-light.svg" width="100%" alt="Chisle：入力トークンも出力トークンも減らして、答えは同じ。">
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
  <sub><a href="../README.md">English</a> &middot; <a href="README.es.md">Español</a> &middot; <a href="README.ko.md">한국어</a> &middot; <a href="README.zh-CN.md">简体中文</a> &middot; <b>日本語</b></sub>
</p>

<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="../assets/readme/stats-dark.svg">
    <img src="../assets/readme/stats-light.svg" width="880" alt="Chisle とルールセットなしの同じモデルの比較：課金される出力トークン 29% 減、回答の長さ 45% 減、巨大なツール出力 48% 減、精度は 156/156 対 154/156。">
  </picture>
</p>

<p align="center"><b>caveman や ponytail よりトークンが少なく、精度はそのまま。</b></p>

```bash
npx chisle
```

<p align="center">
  <a href="https://buymeacoffee.com/jaypokale3b">
    <picture>
      <source media="(prefers-color-scheme: dark)" srcset="../assets/readme/strip-dark.svg">
      <img src="../assets/readme/strip-light.svg" width="880" alt="Chisle は無料です。ベンチマークは無料ではありません。トークンを節約できたら、コーヒーをおごってください。">
    </picture>
  </a>
</p>

<p align="center"><img src="../assets/readme/line.svg" width="100%" height="4" alt=""></p>

<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="../assets/readme/race-dark.svg">
    <img src="../assets/readme/race-light.svg" width="880" alt="同じプロンプト、4 つのルールセット、表示される回答トークン：Chisle 530、caveman 604、ponytail 747、ルールなし 1,186。Chisle はルールなしより 55% 短い。">
  </picture>
</p>

<details>
<summary><b>両方の回答を見る</b></summary>
<br>

プロンプト：*"Implement an order state machine covering created, paid, shipped, delivered, cancelled and refunded, with the legal transitions enforced and invalid ones rejected."* コミット済みの回答原文からの抜粋です：[`raw-nov-sidebyside/large-s2`](../benchmarks/results/raw-nov-sidebyside/large-s2/)

<table>
<tr><th align="left" width="50%">ルールなし：121 行、回答トークン 1,186</th><th align="left" width="50%">Chisle：62 行、回答トークン 530</th></tr>
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

…さらに使用例、テスト、出力結果、遷移のまとめ。

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

そのあとに短い使用例。

</td></tr>
</table>

</details>

<p align="center"><img src="../assets/readme/line.svg" width="100%" height="4" alt=""></p>

<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="../assets/benchmark.svg">
    <img src="../assets/benchmark-light.svg" width="860" alt="Claude Code ベンチマーク、1 回の実行で 25 タスク、ルールセットなしの同じモデルに対する課金出力トークンの割合。caveman 87%、ponytail 90%、Chisle 3.8.1 75%、Chisle 71%。">
  </picture>
</p>

<p align="center"><sub>負けた実行も含め、生のログはすべてコミット済みです。<a href="../docs/benchmarks.md">手法とデータ</a> · <a href="https://jaypokale.me/writing/chisle-benchmarks-it-loses">負けた結果も公開する理由</a></sub></p>

<p align="center"><img src="../assets/readme/line.svg" width="100%" height="4" alt=""></p>

<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="../assets/readme/trim-dark.svg">
    <img src="../assets/readme/trim-light.svg" width="880" alt="Chisle のツール出力圧縮のアニメーション例：色コード、同じ 6 行、成功した 172 行のテストを含む npm test の出力が短くなります。色コードを除き、繰り返しをまとめ、中間を省略して全文をファイルに保存し、失敗したテストとそのエラーは残します。">
  </picture>
</p>

<p align="center"><img src="../assets/readme/line.svg" width="100%" height="4" alt=""></p>

<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="../assets/readme/ladder-dark.svg">
    <img src="../assets/readme/ladder-light.svg" width="880" alt="Chisle の効率はしご。コードを書く前に、最初に当てはまる段で止まる：1 そもそも必要か、2 すでにコードベースにあるか、3 標準ライブラリでできるか、4 プラットフォームの標準機能でできるか、5 インストール済みの依存関係でできるか、6 1 行で書けるか、7 そこで初めて、動く最小限のコード。">
  </picture>
</p>

<p align="center"><img src="../assets/readme/line.svg" width="100%" height="4" alt=""></p>

<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="../assets/readme/install-dark.svg">
    <img src="../assets/readme/install-light.svg" width="880" alt="アニメーションのターミナル：npx chisle が Claude Code、Gemini CLI、Codex、OpenCode、Copilot CLI、Cursor を検出して、それぞれにインストールし、Done と表示します。">
  </picture>
</p>

<details>
<summary><b>その他のインストール方法</b></summary>
<br>

```bash
# Claude Code プラグインマーケットプレイス
claude plugin marketplace add JayPokale/Chisle
claude plugin install chisle@chisle

# curl
curl -fsSL https://raw.githubusercontent.com/JayPokale/Chisle/main/install.sh | bash
```

```powershell
# Windows
irm https://raw.githubusercontent.com/JayPokale/Chisle/main/install.ps1 | iex
```

エージェントごとの設定、アップグレード、設定：[docs/usage.md](../docs/usage.md)。

</details>

<p align="center"><img src="../assets/readme/line.svg" width="100%" height="4" alt=""></p>

<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="../assets/readme/commands-dark.svg">
    <img src="../assets/readme/commands-light.svg" width="880" alt="チートシート：npx chisle ですべてのエージェントを設定、--dry-run で事前確認、--uninstall ですべて元に戻す、/chisle off で一時停止、/chisle-review で過剰設計をレビュー、/chisle-audit で膨らんだコードと文章を監査、npx chisle tools で料金を払っているのに使っていないツールスキーマを表示、npx chisle mcp wrap でどのエージェントでも MCP 出力を削減。">
  </picture>
</p>

<p align="center"><img src="../assets/readme/line.svg" width="100%" height="4" alt=""></p>

<p align="center">
  <a href="https://www.star-history.com/#JayPokale/Chisle&Date">
    <picture>
      <source media="(prefers-color-scheme: dark)" srcset="https://raw.githubusercontent.com/JayPokale/Chisle/stars/stars-dark.svg">
      <img src="https://raw.githubusercontent.com/JayPokale/Chisle/stars/stars-light.svg" width="880" alt="GitHub スター数の推移">
    </picture>
  </a>
</p>

<p align="center"><img src="../assets/readme/line.svg" width="100%" height="4" alt=""></p>

<p align="center">
  <a href="https://buymeacoffee.com/jaypokale3b">
    <picture>
      <source media="(prefers-color-scheme: dark)" srcset="../assets/readme/support-dark.svg">
      <img src="../assets/readme/support-light.svg" width="880" alt="Chisle は無料です。ベンチマークは無料ではありません。ベンチマークを 1 回回すたびに実際の API 料金がかかります。トークンを節約できたら、コーヒーをおごってください。">
    </picture>
  </a>
</p>

<p align="center"><a href="https://github.com/JayPokale/Chisle/stargazers">⭐ リポジトリにスターを</a>：トークンは 1 つもかかりません。</p>

<p align="center">
  <a href="https://github.com/JayPokale/Chisle/graphs/contributors"><img src="https://contrib.rocks/image?repo=JayPokale/Chisle" alt="Contributors"></a>
</p>

<p align="center"><sub><a href="../LICENSE">MIT</a> · <a href="../CONTRIBUTING.md">コントリビュート</a> · <a href="https://github.com/JuliusBrussee/caveman">caveman</a> と <a href="https://github.com/DietrichGebert/ponytail">ponytail</a> の統合から誕生（<a href="../NOTICE">表記</a>）</sub></p>
