# Support

Three places, depending on what you have:

| You have | Go to |
|----------|-------|
| A question — install, config, "why isn't it firing for my agent" | [Discussions → Q&A](https://github.com/JayPokale/Chisle/discussions/categories/q-a) |
| A reproducible defect | [Open a bug report](https://github.com/JayPokale/Chisle/issues/new?template=bug_report.md) |
| An idea, not yet a concrete request | [Discussions → Ideas](https://github.com/JayPokale/Chisle/discussions/categories/ideas) |
| A specific, well-formed feature request | [Open a feature request](https://github.com/JayPokale/Chisle/issues/new?template=feature_request.md) |
| Your own before/after numbers, or a setup that worked | [Discussions → Show and tell](https://github.com/JayPokale/Chisle/discussions/categories/show-and-tell) |
| A security vulnerability | **Not a public issue** — see [SECURITY.md](SECURITY.md) |

## Before you ask

- [README](README.md) for what Chisle does and the measured numbers.
- [INSTALL.md](INSTALL.md) for per-agent install paths and the verification
  steps ("did it actually install?").
- [`docs/`](docs/) for agent portability, Windows notes, and releasing.

Chisle wires eleven agents with different config layouts, so most "it isn't
working" reports come down to *which* agent and *where* it installed. Running
`npx chisle --list` and pasting the output answers that in one step.

## What helps a question get answered

- The agent and version (Claude Code, Pi, OpenCode, …).
- OS and `node --version` — the installer needs Node ≥18.
- Output of `npx chisle --list`, and `npx chisle --dry-run` if the install
  itself is the problem.
- For compression questions, whether `CHISLE_COMPRESS=0` is set, and what
  `npx chisle --stats` reports.

## Response expectations

This is a small project maintained in spare time: best effort, no SLA. Q&A
answers get marked as accepted so the next person with the same problem finds
them without asking again — which is the main reason questions belong in
Discussions rather than the issue tracker.
