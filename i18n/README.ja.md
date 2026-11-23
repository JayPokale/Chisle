<!-- Translated from ../README.md. Keep images, numbers and links in sync with it. -->
<h1 align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="../assets/readme/ja/banner-dark.svg">
    <img src="../assets/readme/ja/banner-light.svg" width="100%" alt="Chisle：入力トークンも出力トークンも減らして、答えは同じ。">
  </picture>
</h1>

<p align="center">
  <a href="https://github.com/JayPokale/Chisle/stargazers"><img src="https://img.shields.io/github/stars/JayPokale/Chisle?style=flat-square&color=d78a3c&label=stars" alt="GitHub stars"></a>
  <a href="https://www.npmjs.com/package/chisle"><img src="https://img.shields.io/npm/v/chisle?style=flat-square&color=d78a3c&label=npm" alt="npm version"></a>
  <a href="https://www.npmjs.com/package/chisle"><img src="https://img.shields.io/npm/dm/chisle?style=flat-square&color=d78a3c&label=downloads" alt="npm downloads per month"></a>
  <img src="https://img.shields.io/badge/agents-13-d78a3c?style=flat-square" alt="Works with 13 agents">
  <a href="../LICENSE"><img src="https://img.shields.io/badge/license-MIT-d78a3c?style=flat-square" alt="MIT license"></a>
  <a href="https://github.com/JayPokale"><img src="https://img.shields.io/github/followers/JayPokale?style=flat-square&logo=github&color=d78a3c&label=follow%20%40JayPokale" alt="Follow @JayPokale on GitHub"></a>
  <a href="https://buymeacoffee.com/jaypokale3b"><img src="https://img.shields.io/badge/Buy%20me%20a%20coffee-FFDD00?style=flat-square&logo=buymeacoffee&logoColor=black" alt="Buy me a coffee"></a>
</p>

<p align="center">
  <sub><a href="../README.md">English</a> &middot; <a href="README.es.md">Español</a> &middot; <a href="README.ko.md">한국어</a> &middot; <a href="README.zh-CN.md">简体中文</a> &middot; <b>日本語</b></sub>
</p>

<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="../assets/readme/ja/stats-dark.svg">
    <img src="../assets/readme/ja/stats-light.svg" width="880" alt="Chisle とルールセットなしの同じモデルの比較：課金される出力トークン 9% 減、回答の長さ 39% 減、巨大なツール出力 48% 減、精度は 156/156 でルールなしと同じ。">
  </picture>
</p>

<p align="center"><b>caveman や ponytail より短い回答、精度はそのまま。</b></p>

```bash
npx chisle
```

<p align="center">
  <a href="https://buymeacoffee.com/jaypokale3b">
    <picture>
      <source media="(prefers-color-scheme: dark)" srcset="../assets/readme/ja/strip-dark.svg">
      <img src="../assets/readme/ja/strip-light.svg" width="880" alt="Chisle は無料です。ベンチマークは無料ではありません。トークンを節約できたら、コーヒーをおごってください。">
    </picture>
  </a>
</p>

<p align="center"><img src="../assets/readme/line.svg" width="100%" height="4" alt=""></p>

<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="../assets/readme/ja/race-dark.svg">
    <img src="../assets/readme/ja/race-light.svg" width="880" alt="同じプロンプト、4 つのルールセット、表示される回答トークン：Chisle 515、ponytail 672、caveman 667、ルールなし 1,081。Chisle はルールなしより 52% 短い。">
  </picture>
</p>

<details>
<summary><b>両方の回答を見る</b></summary>
<br>

プロンプト：*"Implement an order state machine covering created, paid, shipped, delivered, cancelled and refunded, with the legal transitions enforced and invalid ones rejected."* コミット済みの回答原文からの抜粋です：[`raw-314-direct/large-s2`](../benchmarks/results/raw-314-direct/large-s2/)

<table>
<tr><th align="left" width="50%">ルールなし：132 行、回答トークン 1,307</th><th align="left" width="50%">Chisle：60 行、回答トークン 577</th></tr>
<tr valign="top"><td>

```python
class StateTransition:
    """Defines valid state transitions"""
    from_state: OrderState
    to_states: Set[OrderState]

class OrderStateMachine:
    # Define all valid transitions
    TRANSITIONS = {
        OrderState.CREATED: {OrderState.PAID, OrderState.CANCELLED},
        …
    }
    def __init__(self, order_id: str):
        …
        self.state_history = [(OrderState.CREATED, datetime.now())]
    def can_transition(self, target_state: OrderState) -> bool:
    def transition(self, target_state: OrderState) -> bool:
        """
        Attempt to transition to target_state.
        Returns True if successful, False if invalid.
        """
    def get_valid_transitions(self) -> Set[OrderState]:
```

…さらにどこからも使われない `StateTransition` クラス、使用例とテスト、「Key Design Decisions」「Why these transitions」「Features」の各セクション。

</td><td>

```python
class OrderStateMachine:
    VALID_TRANSITIONS: Dict[OrderState, Set[OrderState]] = {
        OrderState.CREATED: {OrderState.PAID, OrderState.CANCELLED},
        OrderState.PAID: {OrderState.SHIPPED, OrderState.REFUNDED, OrderState.CANCELLED},
        …
    }
    def transition(self, target: OrderState) -> None:
        if target not in self.VALID_TRANSITIONS[self.state]:
            raise ValueError(
                f"Invalid transition: {self.state.value} → {target.value}"
            )
        self.state = target
```

そのあと短い使用例と、遷移を 5 行でまとめた一覧。

</td></tr>
</table>

</details>

<p align="center"><img src="../assets/readme/line.svg" width="100%" height="4" alt=""></p>

<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="../assets/benchmark.svg">
    <img src="../assets/benchmark-light.svg" width="860" alt="Claude Code ベンチマーク、1 セッションで 39 回答（13 プロンプト × 3 回）、ルールセットなしの同じモデルに対する課金出力トークンの割合：caveman 96%、ponytail 115%、Chisle 91%。">
  </picture>
</p>

<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="../assets/benchmark-terminal.svg">
    <img src="../assets/benchmark-terminal-light.svg" width="860" alt="37 のシェルコマンドで Claude が読むターミナル出力（生の出力に対する割合）：ルールなし 100%、caveman 100%、ponytail 100%（ルールのみでツール出力には触れない）、Chisle 28%。">
  </picture>
</p>

<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="../assets/benchmark-cost.svg">
    <img src="../assets/benchmark-cost-light.svg" width="860" alt="ノイズの多いコマンドを伴う実際のエージェントタスク 3 つ（失敗する npm test の修正、391 件のテストを緑のまま保つ機能追加、大きなコミットに埋もれたバグの発見）の合計コスト、ルールなしの同じエージェントに対する割合、どのアームも RTK なし：caveman 123%、ponytail 109%、Chisle 90%。全実行でタスクを完了。">
  </picture>
</p>

<p align="center"><sub>負けた実行も含め、生のログはすべてコミット済みです。<a href="../docs/benchmarks.md">手法とデータ</a> · <a href="https://jaypokale.me/writing/chisle-benchmarks-it-loses">負けた結果も公開する理由</a></sub></p>

<p align="center"><img src="../assets/readme/line.svg" width="100%" height="4" alt=""></p>

<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="../assets/readme/ja/trim-dark.svg">
    <img src="../assets/readme/ja/trim-light.svg" width="880" alt="Chisle のツール出力圧縮のアニメーション例：色コード、同じ 6 行、成功した 172 行のテストを含む npm test の出力が短くなります。色コードを除き、繰り返しをまとめ、中間を省略して全文をファイルに保存し、失敗したテストとそのエラーは残します。">
  </picture>
</p>

<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="../assets/readme/ja/filters-dark.svg">
    <img src="../assets/readme/ja/filters-light.svg" width="880" alt="実際の出力に対するコマンド別フィルター、生の文字数 → Claude が読む量：npm test 19,374 → 445（−98%）、失敗する npm test 16,107 → 309（−98%）、git status 485 → 92（−81%）、git log -n 15 6,561 → 3,784（−42%）。37 コマンドで Claude が読む生の出力は Chisle で 28%、caveman・ponytail で 100%。">
  </picture>
</p>

<p align="center"><img src="../assets/readme/line.svg" width="100%" height="4" alt=""></p>

<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="../assets/readme/ja/ladder-dark.svg">
    <img src="../assets/readme/ja/ladder-light.svg" width="880" alt="Chisle の効率はしご。コードを書く前に、最初に当てはまる段で止まる：1 そもそも必要か、2 すでにコードベースにあるか、3 標準ライブラリでできるか、4 プラットフォームの標準機能でできるか、5 インストール済みの依存関係でできるか、6 1 行で書けるか、7 そこで初めて、動く最小限のコード。">
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
    <source media="(prefers-color-scheme: dark)" srcset="../assets/readme/ja/commands-dark.svg">
    <img src="../assets/readme/ja/commands-light.svg" width="880" alt="チートシート：npx chisle ですべてのエージェントを設定、--dry-run で事前確認、--uninstall ですべて元に戻す、/chisle off で一時停止、/chisle-review で過剰設計をレビュー、/chisle-audit で膨らんだコードと文章を監査、npx chisle tools で料金を払っているのに使っていないツールスキーマを表示、npx chisle mcp wrap でどのエージェントでも MCP 出力を削減。">
  </picture>
</p>

<p align="center"><img src="../assets/readme/line.svg" width="100%" height="4" alt=""></p>

<p align="center">
  <a href="https://www.star-history.com/?repos=JayPokale%2FChisle&type=date&legend=top-left">
    <picture>
      <source media="(prefers-color-scheme: dark)" srcset="https://api.star-history.com/svg?repos=jaypokale%2Fchisle&type=date&legend=top-left&theme=dark">
      <img src="https://api.star-history.com/svg?repos=jaypokale%2Fchisle&type=date&legend=top-left" width="800" alt="GitHub スター数の推移">
    </picture>
  </a>
</p>

<p align="center"><img src="../assets/readme/line.svg" width="100%" height="4" alt=""></p>

<p align="center">
  <a href="https://buymeacoffee.com/jaypokale3b">
    <picture>
      <source media="(prefers-color-scheme: dark)" srcset="../assets/readme/ja/support-dark.svg">
      <img src="../assets/readme/ja/support-light.svg" width="880" alt="Chisle は無料です。ベンチマークは無料ではありません。ベンチマークを 1 回回すたびに実際の API 料金がかかります。トークンを節約できたら、コーヒーをおごってください。">
    </picture>
  </a>
</p>

<p align="center"><a href="https://github.com/JayPokale/Chisle/stargazers">⭐ リポジトリにスターを</a>：トークンは 1 つもかかりません。</p>

<p align="center">
  <a href="https://github.com/JayPokale/Chisle/graphs/contributors"><img src="https://contrib.rocks/image?repo=JayPokale/Chisle" alt="Contributors"></a>
</p>

<p align="center"><sub><a href="../LICENSE">MIT</a> · <a href="../CONTRIBUTING.md">コントリビュート</a> · <a href="https://github.com/JuliusBrussee/caveman">caveman</a> と <a href="https://github.com/DietrichGebert/ponytail">ponytail</a> の統合から誕生（<a href="../NOTICE">表記</a>）· コマンドフィルターは <a href="https://github.com/rtk-ai/rtk">RTK</a> の設計がベース</sub></p>
