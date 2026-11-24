<!-- Translated from ../README.md. Keep images, numbers and links in sync with it. -->
<h1 align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="../assets/readme/es/banner-dark.svg">
    <img src="../assets/readme/es/banner-light.svg" width="100%" alt="Chisle: menos tokens de entrada, menos tokens de salida, las mismas respuestas.">
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
  <sub><a href="../README.md">English</a> &middot; <b>Español</b> &middot; <a href="README.ko.md">한국어</a> &middot; <a href="README.zh-CN.md">简体中文</a> &middot; <a href="README.ja.md">日本語</a></sub>
</p>

<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="../assets/readme/es/stats-dark.svg">
    <img src="../assets/readme/es/stats-light.svg" width="880" alt="Chisle frente al mismo modelo sin ruleset, en Sonnet 5.5: 39% menos tokens de salida facturados (Opus 5.5: 49%, Haiku 4.5: 9%), respuestas un 43% más cortas (Opus 5.5: 50%, Haiku 4.5: 39%), salidas de herramientas enormes un 48% más pequeñas, precisión de 156 sobre 156, igual que el modelo sin reglas.">
  </picture>
</p>

<p align="center"><b>Respuestas más cortas que caveman y ponytail. Sin perder precisión.</b></p>

```bash
npx chisle
```

<p align="center">
  <a href="https://buymeacoffee.com/jaypokale3b">
    <picture>
      <source media="(prefers-color-scheme: dark)" srcset="../assets/readme/es/strip-dark.svg">
      <img src="../assets/readme/es/strip-light.svg" width="880" alt="Chisle es gratis. Sus benchmarks no. ¿Te ahorró tokens? Invítame a un café.">
    </picture>
  </a>
</p>

<p align="center"><img src="../assets/readme/line.svg" width="100%" height="4" alt=""></p>

<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="../assets/readme/es/race-dark.svg">
    <img src="../assets/readme/es/race-light.svg" width="880" alt="Mismo prompt, cuatro rulesets, tokens de respuesta visibles: Chisle 515, ponytail 672, caveman 667, sin ruleset 1.081. Chisle es un 52% más corto que sin ruleset.">
  </picture>
</p>

<details>
<summary><b>Ver ambas respuestas</b></summary>
<br>

El prompt: *"Implement an order state machine covering created, paid, shipped, delivered, cancelled and refunded, with the legal transitions enforced and invalid ones rejected."* Extractos de las respuestas literales guardadas en [`raw-314-direct/large-s2`](../benchmarks/results/raw-314-direct/large-s2/):

<table>
<tr><th align="left" width="50%">sin ruleset: 132 líneas, 1.307 tokens de respuesta</th><th align="left" width="50%">Chisle: 60 líneas, 577 tokens de respuesta</th></tr>
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

…más una clase `StateTransition` que nada usa, ejemplos de uso y pruebas, y las secciones «Key Design Decisions», «Why these transitions» y «Features».

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

Luego un ejemplo breve y una lista de cinco líneas con las transiciones.

</td></tr>
</table>

</details>

<p align="center"><img src="../assets/readme/line.svg" width="100%" height="4" alt=""></p>

<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="../assets/benchmark-opus.svg">
    <img src="../assets/benchmark-opus-light.svg" width="860" alt="Claude Code con Opus 5.5, 39 respuestas (13 prompts, 3 ejecuciones) en una sesión, tokens de salida facturados como porcentaje del mismo modelo sin ruleset: caveman 86%, ponytail 58%, Chisle 51%.">
  </picture>
</p>

<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="../assets/benchmark-sonnet.svg">
    <img src="../assets/benchmark-sonnet-light.svg" width="860" alt="Claude Code con Sonnet 5.5, 39 respuestas (13 prompts, 3 ejecuciones) en una sesión, tokens de salida facturados como porcentaje del mismo modelo sin ruleset: caveman 78%, ponytail 73%, Chisle 61%.">
  </picture>
</p>

<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="../assets/benchmark.svg">
    <img src="../assets/benchmark-light.svg" width="860" alt="Claude Code con Haiku 4.5, los mismos prompts: caveman 96%, ponytail 115%, Chisle 91%. En Haiku todo ruleset añade razonamiento oculto, que se come casi todo lo que acortan las respuestas.">
  </picture>
</p>

<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="../assets/benchmark-terminal.svg">
    <img src="../assets/benchmark-terminal-light.svg" width="860" alt="Salida de terminal que lee Claude en 37 comandos, como porcentaje de la salida en bruto: sin reglas 100%, caveman 100%, ponytail 100% (solo reglas, no tocan la salida de herramientas), Chisle 28%.">
  </picture>
</p>

<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="../assets/benchmark-cost.svg">
    <img src="../assets/benchmark-cost-light.svg" width="860" alt="Coste total de cuatro tareas reales de agente con comandos ruidosos (arreglar un npm test que falla, añadir una función sin romper una suite de 391 tests, encontrar un fallo en un commit grande, encontrar los dos commits que rompieron una release), como porcentaje del mismo agente sin reglas, sin RTK en ningún caso y sin contar el prompt propio de cada ruleset (en caché): caveman 108%, ponytail 103%, Chisle 73%. Todas las ejecuciones resolvieron su tarea.">
  </picture>
</p>

<p align="center"><sub><b>Una tarea con todo a la vez</b> (<code>releasered</code>): los tests pasan en el tag <code>v2.0.0</code> y fallan seis commits después, por dos fallos sin relación. El agente ejecuta una suite de 517 tests (log de 27k caracteres), lee el historial y el diff desde el tag, arregla dos archivos y repite hasta que todo pasa. Coste como % de sin reglas, sin contar el prompt de cada ruleset (en caché), sin RTK; todas las ejecuciones arreglaron los dos fallos.</sub></p>

<div align="center">
<table>
<tr><th></th><th>Haiku 4.5 (5 ejecuciones)</th><th>Sonnet 5.5 (3 ejecuciones)</th><th>Opus 5.5 (3 ejecuciones)</th></tr>
<tr><td>sin reglas</td><td>100%</td><td>100%</td><td>100%</td></tr>
<tr><td>caveman</td><td>97%</td><td>94%</td><td>97%</td></tr>
<tr><td>ponytail</td><td>102%</td><td>104%</td><td>102%</td></tr>
<tr><td><b>Chisle</b></td><td><b>61%</b></td><td><b>88%</b></td><td><b>81%</b></td></tr>
</table>
</div>

<p align="center"><sub>Todas las transcripciones originales están en el repo, derrotas incluidas. <a href="../docs/benchmarks.md">Método y datos</a> · <a href="https://jaypokale.me/writing/chisle-benchmarks-it-loses">por qué publicamos las derrotas</a></sub></p>

<p align="center"><img src="../assets/readme/line.svg" width="100%" height="4" alt=""></p>

<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="../assets/readme/es/trim-dark.svg">
    <img src="../assets/readme/es/trim-light.svg" width="880" alt="Ilustración animada del compresor de salidas de Chisle: la salida de npm test con códigos de color, seis líneas idénticas y 172 líneas de tests aprobados se convierte en una versión corta: sin códigos de color, repeticiones colapsadas, el tramo central omitido y guardado completo en un archivo, y el test fallido con su error conservados.">
  </picture>
</p>

<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="../assets/readme/es/filters-dark.svg">
    <img src="../assets/readme/es/filters-light.svg" width="880" alt="Filtros por comando sobre salida real, caracteres en bruto frente a lo que lee Claude: npm test 19.374 → 445 (−98%), un npm test que falla 16.107 → 309 (−98%), git status 485 → 92 (−81%), git log -n 15 6.561 → 3.784 (−42%). En 37 comandos Claude lee el 28% de la salida en bruto con Chisle y el 100% con caveman o ponytail.">
  </picture>
</p>

<p align="center"><img src="../assets/readme/line.svg" width="100%" height="4" alt=""></p>

<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="../assets/readme/es/ladder-dark.svg">
    <img src="../assets/readme/es/ladder-light.svg" width="880" alt="La escalera de eficiencia de Chisle. Antes de escribir código, detente en el primer peldaño que se cumpla: 1 ¿hace falta que exista?, 2 ¿ya está en este código?, 3 ¿lo hace la biblioteca estándar?, 4 ¿una función nativa de la plataforma?, 5 ¿una dependencia ya instalada?, 6 ¿cabe en una línea?, 7 solo entonces, el código mínimo que funciona.">
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
    <source media="(prefers-color-scheme: dark)" srcset="../assets/readme/es/commands-dark.svg">
    <img src="../assets/readme/es/commands-light.svg" width="880" alt="Chuleta: npx chisle configura cada agente; --dry-run muestra los cambios antes; --uninstall lo deja todo como estaba; /chisle off lo pausa; /chisle-review busca sobreingeniería; /chisle-audit busca código y prosa inflados; npx chisle tools muestra los esquemas de herramientas que pagas pero nunca usas; npx chisle mcp wrap recorta la salida MCP en cualquier agente.">
  </picture>
</p>

<p align="center"><img src="../assets/readme/line.svg" width="100%" height="4" alt=""></p>

<p align="center">
  <a href="https://www.star-history.com/?repos=JayPokale%2FChisle&type=date&legend=top-left">
    <picture>
      <source media="(prefers-color-scheme: dark)" srcset="https://api.star-history.com/svg?repos=jaypokale%2Fchisle&type=date&legend=top-left&theme=dark">
      <img src="https://api.star-history.com/svg?repos=jaypokale%2Fchisle&type=date&legend=top-left" width="800" alt="Estrellas de GitHub a lo largo del tiempo">
    </picture>
  </a>
</p>

<p align="center"><img src="../assets/readme/line.svg" width="100%" height="4" alt=""></p>

<p align="center">
  <a href="https://buymeacoffee.com/jaypokale3b">
    <picture>
      <source media="(prefers-color-scheme: dark)" srcset="../assets/readme/es/support-dark.svg">
      <img src="../assets/readme/es/support-light.svg" width="880" alt="Chisle es gratis. Sus benchmarks no. Cada ejecución de benchmark cuesta dinero real de API. ¿Te ahorró tokens? Invítame a un café.">
    </picture>
  </a>
</p>

<p align="center"><a href="https://github.com/JayPokale/Chisle/stargazers">⭐ Dale una estrella al repo</a>: no cuesta ni un token.</p>

<p align="center">
  <a href="https://github.com/JayPokale/Chisle/graphs/contributors"><img src="https://contrib.rocks/image?repo=JayPokale/Chisle" alt="Contributors"></a>
</p>

<p align="center"><sub><a href="../LICENSE">MIT</a> · <a href="../CONTRIBUTING.md">Contribuir</a> · Nació como una fusión de <a href="https://github.com/JuliusBrussee/caveman">caveman</a> y <a href="https://github.com/DietrichGebert/ponytail">ponytail</a> (<a href="../NOTICE">avisos</a>) · Filtros de comandos basados en el diseño de <a href="https://github.com/rtk-ai/rtk">RTK</a></sub></p>
