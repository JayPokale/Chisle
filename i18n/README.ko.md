<!-- Translated from ../README.md. Keep images, numbers and links in sync with it. -->
<h1 align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="../assets/readme/ko/banner-dark.svg">
    <img src="../assets/readme/ko/banner-light.svg" width="100%" alt="Chisle: 입력 토큰도, 출력 토큰도 줄이고 답은 그대로.">
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
  <sub><a href="../README.md">English</a> &middot; <a href="README.es.md">Español</a> &middot; <b>한국어</b> &middot; <a href="README.zh-CN.md">简体中文</a> &middot; <a href="README.ja.md">日本語</a></sub>
</p>

<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="../assets/readme/ko/stats-dark.svg">
    <img src="../assets/readme/ko/stats-light.svg" width="880" alt="Chisle과 규칙 세트가 없는 같은 모델 비교: 과금 출력 토큰 29% 감소, 답변 길이 45% 감소, 큰 도구 출력 48% 감소, 정확도 156/156 대 154/156.">
  </picture>
</p>

<p align="center"><b>caveman과 ponytail보다 적은 토큰. 정확도 손실 없음.</b></p>

```bash
npx chisle
```

<p align="center">
  <a href="https://buymeacoffee.com/jaypokale3b">
    <picture>
      <source media="(prefers-color-scheme: dark)" srcset="../assets/readme/ko/strip-dark.svg">
      <img src="../assets/readme/ko/strip-light.svg" width="880" alt="Chisle은 무료입니다. 벤치마크는 아닙니다. 토큰을 아꼈다면 커피 한 잔 사 주세요.">
    </picture>
  </a>
</p>

<p align="center"><img src="../assets/readme/line.svg" width="100%" height="4" alt=""></p>

<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="../assets/readme/ko/race-dark.svg">
    <img src="../assets/readme/ko/race-light.svg" width="880" alt="같은 프롬프트, 네 가지 규칙 세트, 보이는 답변 토큰: Chisle 530, caveman 604, ponytail 747, 규칙 없음 1,186. Chisle은 규칙 없음보다 55% 짧습니다.">
  </picture>
</p>

<details>
<summary><b>두 답변 보기</b></summary>
<br>

프롬프트: *"Implement an order state machine covering created, paid, shipped, delivered, cancelled and refunded, with the legal transitions enforced and invalid ones rejected."* 커밋된 원본 답변에서 발췌했습니다: [`raw-nov-sidebyside/large-s2`](../benchmarks/results/raw-nov-sidebyside/large-s2/)

<table>
<tr><th align="left" width="50%">규칙 없음: 121줄, 답변 토큰 1,186개</th><th align="left" width="50%">Chisle: 62줄, 답변 토큰 530개</th></tr>
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

…여기에 사용 예시, 테스트, 출력 결과, 전이 요약까지.

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

그다음 짧은 사용 예시.

</td></tr>
</table>

</details>

<p align="center"><img src="../assets/readme/line.svg" width="100%" height="4" alt=""></p>

<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="../assets/benchmark.svg">
    <img src="../assets/benchmark-light.svg" width="860" alt="Claude Code 벤치마크, 한 번의 실행에서 25개 작업, 규칙 세트가 없는 같은 모델 대비 과금 출력 토큰 비율. caveman 87%, ponytail 90%, Chisle 3.8.1 75%, Chisle 71%.">
  </picture>
</p>

<p align="center"><sub>진 결과까지 포함해 모든 원본 기록이 커밋되어 있습니다. <a href="../docs/benchmarks.md">방법과 데이터</a> · <a href="https://jaypokale.me/writing/chisle-benchmarks-it-loses">진 결과를 공개하는 이유</a></sub></p>

<p align="center"><img src="../assets/readme/line.svg" width="100%" height="4" alt=""></p>

<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="../assets/readme/ko/trim-dark.svg">
    <img src="../assets/readme/ko/trim-light.svg" width="880" alt="Chisle 도구 출력 압축기의 애니메이션 예시: 색상 코드, 똑같은 6줄, 통과한 테스트 172줄이 담긴 npm test 출력이 짧은 버전으로 바뀝니다. 색상 코드는 지우고, 반복은 한 줄로 접고, 가운데는 생략해 전체를 파일로 저장하며, 실패한 테스트와 오류는 남깁니다.">
  </picture>
</p>

<p align="center"><img src="../assets/readme/line.svg" width="100%" height="4" alt=""></p>

<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="../assets/readme/ko/ladder-dark.svg">
    <img src="../assets/readme/ko/ladder-light.svg" width="880" alt="Chisle 효율 사다리. 코드를 쓰기 전에 성립하는 첫 단계에서 멈춥니다: 1 꼭 있어야 하나, 2 이미 코드베이스에 있나, 3 표준 라이브러리로 되나, 4 플랫폼 기본 기능이 있나, 5 이미 설치된 의존성이 있나, 6 한 줄로 되나, 7 그때서야 동작하는 최소한의 코드.">
  </picture>
</p>

<p align="center"><img src="../assets/readme/line.svg" width="100%" height="4" alt=""></p>

<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="../assets/readme/install-dark.svg">
    <img src="../assets/readme/install-light.svg" width="880" alt="애니메이션 터미널: npx chisle이 Claude Code, Gemini CLI, Codex, OpenCode, Copilot CLI, Cursor를 감지해 각각에 설치하고 Done을 출력합니다.">
  </picture>
</p>

<details>
<summary><b>다른 설치 방법</b></summary>
<br>

```bash
# Claude Code 플러그인 마켓플레이스
claude plugin marketplace add JayPokale/Chisle
claude plugin install chisle@chisle

# curl
curl -fsSL https://raw.githubusercontent.com/JayPokale/Chisle/main/install.sh | bash
```

```powershell
# Windows
irm https://raw.githubusercontent.com/JayPokale/Chisle/main/install.ps1 | iex
```

에이전트별 설정, 업그레이드, 설정: [docs/usage.md](../docs/usage.md).

</details>

<p align="center"><img src="../assets/readme/line.svg" width="100%" height="4" alt=""></p>

<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="../assets/readme/ko/commands-dark.svg">
    <img src="../assets/readme/ko/commands-light.svg" width="880" alt="치트 시트: npx chisle은 모든 에이전트를 설정, --dry-run은 미리 보기, --uninstall은 모두 되돌리기, /chisle off는 일시 중지, /chisle-review는 과잉 설계 검토, /chisle-audit은 부풀려진 코드와 글 감사, npx chisle tools는 비용만 내고 쓰지 않는 도구 스키마 표시, npx chisle mcp wrap은 모든 에이전트에서 MCP 출력 축소.">
  </picture>
</p>

<p align="center"><img src="../assets/readme/line.svg" width="100%" height="4" alt=""></p>

<p align="center">
  <a href="https://www.star-history.com/#JayPokale/Chisle&Date">
    <picture>
      <source media="(prefers-color-scheme: dark)" srcset="https://raw.githubusercontent.com/JayPokale/Chisle/stars/stars-dark.svg">
      <img src="https://raw.githubusercontent.com/JayPokale/Chisle/stars/stars-light.svg" width="880" alt="시간에 따른 GitHub 스타 수">
    </picture>
  </a>
</p>

<p align="center"><img src="../assets/readme/line.svg" width="100%" height="4" alt=""></p>

<p align="center">
  <a href="https://buymeacoffee.com/jaypokale3b">
    <picture>
      <source media="(prefers-color-scheme: dark)" srcset="../assets/readme/ko/support-dark.svg">
      <img src="../assets/readme/ko/support-light.svg" width="880" alt="Chisle은 무료입니다. 벤치마크는 아닙니다. 벤치마크를 한 번 돌릴 때마다 실제 API 비용이 듭니다. 토큰을 아꼈다면 커피 한 잔 사 주세요.">
    </picture>
  </a>
</p>

<p align="center"><a href="https://github.com/JayPokale/Chisle/stargazers">⭐ 저장소에 별 주기</a>: 토큰은 하나도 들지 않습니다.</p>

<p align="center">
  <a href="https://github.com/JayPokale/Chisle/graphs/contributors"><img src="https://contrib.rocks/image?repo=JayPokale/Chisle" alt="Contributors"></a>
</p>

<p align="center"><sub><a href="../LICENSE">MIT</a> · <a href="../CONTRIBUTING.md">기여하기</a> · <a href="https://github.com/JuliusBrussee/caveman">caveman</a>과 <a href="https://github.com/DietrichGebert/ponytail">ponytail</a>을 합치며 시작 (<a href="../NOTICE">고지</a>)</sub></p>
