<!-- Translated from ../README.md. Keep images, numbers and links in sync with it. -->
<h1 align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="../assets/readme/banner-dark.svg">
    <img src="../assets/readme/banner-light.svg" width="100%" alt="Chisle: menos tokens de entrada, menos tokens de salida, las mismas respuestas.">
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
  <sub><a href="../README.md">English</a> &middot; <b>Español</b> &middot; <a href="README.ko.md">한국어</a> &middot; <a href="README.zh-CN.md">简体中文</a> &middot; <a href="README.ja.md">日本語</a></sub>
</p>

<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="../assets/readme/stats-dark.svg">
    <img src="../assets/readme/stats-light.svg" width="880" alt="Chisle frente al mismo modelo sin ruleset: 29% menos tokens de salida facturados, respuestas un 45% más cortas, salidas de herramientas enormes un 48% más pequeñas, precisión de 156 sobre 156 frente a 154 sobre 156.">
  </picture>
</p>

<p align="center"><b>Menos tokens que caveman y ponytail. Sin perder precisión.</b></p>

```bash
npx chisle
```

<p align="center">
  <a href="https://buymeacoffee.com/jaypokale3b">
    <picture>
      <source media="(prefers-color-scheme: dark)" srcset="../assets/readme/strip-dark.svg">
      <img src="../assets/readme/strip-light.svg" width="880" alt="Chisle es gratis. Sus benchmarks no. ¿Te ahorró tokens? Invítame a un café.">
    </picture>
  </a>
</p>

<p align="center"><img src="../assets/readme/line.svg" width="100%" height="4" alt=""></p>

<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="../assets/readme/race-dark.svg">
    <img src="../assets/readme/race-light.svg" width="880" alt="Mismo prompt, cuatro rulesets, tokens de respuesta visibles: Chisle 530, caveman 604, ponytail 747, sin ruleset 1.186. Chisle es un 55% más corto que sin ruleset.">
  </picture>
</p>

<details>
<summary><b>Ver ambas respuestas</b></summary>
<br>

El prompt: *"Implement an order state machine covering created, paid, shipped, delivered, cancelled and refunded, with the legal transitions enforced and invalid ones rejected."* Extractos de las respuestas literales guardadas en [`raw-nov-sidebyside/large-s2`](../benchmarks/results/raw-nov-sidebyside/large-s2/):

<table>
<tr><th align="left" width="50%">sin ruleset: 121 líneas, 1.186 tokens de respuesta</th><th align="left" width="50%">Chisle: 62 líneas, 530 tokens de respuesta</th></tr>
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

…más ejemplos de uso, tests, salida impresa y un resumen de las transiciones.

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

Después, un bloque corto de uso.

</td></tr>
</table>

</details>

<p align="center"><img src="../assets/readme/line.svg" width="100%" height="4" alt=""></p>

<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="../assets/benchmark.svg">
    <img src="../assets/benchmark-light.svg" width="860" alt="Benchmark de Claude Code, 25 tareas en una ejecución, tokens de salida facturados como porcentaje del mismo modelo sin ruleset. caveman 87%, ponytail 90%, Chisle 3.8.1 75%, Chisle 71%.">
  </picture>
</p>

<p align="center"><sub>Todas las transcripciones originales están en el repo, derrotas incluidas. <a href="../docs/benchmarks.md">Método y datos</a> · <a href="https://jaypokale.me/writing/chisle-benchmarks-it-loses">por qué publicamos las derrotas</a></sub></p>

<p align="center"><img src="../assets/readme/line.svg" width="100%" height="4" alt=""></p>

<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="../assets/readme/trim-dark.svg">
    <img src="../assets/readme/trim-light.svg" width="880" alt="Ilustración animada del compresor de salidas de Chisle: la salida de npm test con códigos de color, seis líneas idénticas y 172 líneas de tests aprobados se convierte en una versión corta: sin códigos de color, repeticiones colapsadas, el tramo central omitido y guardado completo en un archivo, y el test fallido con su error conservados.">
  </picture>
</p>

<p align="center"><img src="../assets/readme/line.svg" width="100%" height="4" alt=""></p>

<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="../assets/readme/ladder-dark.svg">
    <img src="../assets/readme/ladder-light.svg" width="880" alt="La escalera de eficiencia de Chisle. Antes de escribir código, detente en el primer peldaño que se cumpla: 1 ¿hace falta que exista?, 2 ¿ya está en este código?, 3 ¿lo hace la biblioteca estándar?, 4 ¿una función nativa de la plataforma?, 5 ¿una dependencia ya instalada?, 6 ¿cabe en una línea?, 7 solo entonces, el código mínimo que funciona.">
  </picture>
</p>

<p align="center"><img src="../assets/readme/line.svg" width="100%" height="4" alt=""></p>

<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="../assets/readme/install-dark.svg">
    <img src="../assets/readme/install-light.svg" width="880" alt="Terminal animada: npx chisle detecta Claude Code, Gemini CLI, Codex, OpenCode, Copilot CLI y Cursor, se instala en cada uno e imprime Done.">
  </picture>
</p>

<details>
<summary><b>Otras formas de instalar</b></summary>
<br>

```bash
# Marketplace de plugins de Claude Code
claude plugin marketplace add JayPokale/Chisle
claude plugin install chisle@chisle

# curl
curl -fsSL https://raw.githubusercontent.com/JayPokale/Chisle/main/install.sh | bash
```

```powershell
# Windows
irm https://raw.githubusercontent.com/JayPokale/Chisle/main/install.ps1 | iex
```

Configuración por agente, actualizaciones y opciones: [docs/usage.md](../docs/usage.md).

</details>

<p align="center"><img src="../assets/readme/line.svg" width="100%" height="4" alt=""></p>

<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="../assets/readme/commands-dark.svg">
    <img src="../assets/readme/commands-light.svg" width="880" alt="Chuleta: npx chisle configura cada agente; --dry-run muestra los cambios antes; --uninstall lo deja todo como estaba; /chisle off lo pausa; /chisle-review busca sobreingeniería; /chisle-audit busca código y prosa inflados; npx chisle tools muestra los esquemas de herramientas que pagas pero nunca usas; npx chisle mcp wrap recorta la salida MCP en cualquier agente.">
  </picture>
</p>

<p align="center"><img src="../assets/readme/line.svg" width="100%" height="4" alt=""></p>

<p align="center">
  <a href="https://www.star-history.com/#JayPokale/Chisle&Date">
    <picture>
      <source media="(prefers-color-scheme: dark)" srcset="https://raw.githubusercontent.com/JayPokale/Chisle/stars/stars-dark.svg">
      <img src="https://raw.githubusercontent.com/JayPokale/Chisle/stars/stars-light.svg" width="880" alt="Estrellas de GitHub a lo largo del tiempo">
    </picture>
  </a>
</p>

<p align="center"><img src="../assets/readme/line.svg" width="100%" height="4" alt=""></p>

<p align="center">
  <a href="https://buymeacoffee.com/jaypokale3b">
    <picture>
      <source media="(prefers-color-scheme: dark)" srcset="../assets/readme/support-dark.svg">
      <img src="../assets/readme/support-light.svg" width="880" alt="Chisle es gratis. Sus benchmarks no. Cada ejecución de benchmark cuesta dinero real de API. ¿Te ahorró tokens? Invítame a un café.">
    </picture>
  </a>
</p>

<p align="center"><a href="https://github.com/JayPokale/Chisle/stargazers">⭐ Dale una estrella al repo</a>: no cuesta ni un token.</p>

<p align="center">
  <a href="https://github.com/JayPokale/Chisle/graphs/contributors"><img src="https://contrib.rocks/image?repo=JayPokale/Chisle" alt="Contributors"></a>
</p>

<p align="center"><sub><a href="../LICENSE">MIT</a> · <a href="../CONTRIBUTING.md">Contribuir</a> · Nació como una fusión de <a href="https://github.com/JuliusBrussee/caveman">caveman</a> y <a href="https://github.com/DietrichGebert/ponytail">ponytail</a> (<a href="../NOTICE">avisos</a>)</sub></p>
