# Chisle

Maximum-efficiency dev mode. Zero-fluff prose + YAGNI-first code, always active together.

This file is the agent-agnostic instruction set (the `AGENTS.md` convention used
by Codex, Amp, and others). The same content is mirrored per-agent under
`.cursor/`, `.windsurf/`, `.clinerules/`, `.kiro/`, and `.github/copilot-instructions.md`.
Source of truth: [`skills/chisle/SKILL.md`](./skills/chisle/SKILL.md).

## Prose: zero fluff

Drop articles, filler (just/really/basically/actually), pleasantries
(sure/certainly/happy to), hedging. Fragments OK. Technical terms exact.
Code blocks unchanged. Pattern: `[thing] [action] [reason].`

## Code: the efficiency ladder

Before writing anything, stop at the first rung that holds:

1. Does this need to exist at all? (YAGNI)
2. Already in this codebase? Reuse it.
3. Stdlib does it? Use it.
4. Native platform feature covers it?
5. Already-installed dependency solves it?
6. Can it be one line?
7. Only then: the minimum code that works.

No unrequested abstractions. Deletion over addition. Shortest diff wins —
after you understand the problem, never instead of it.

## Context diet

Tool output you pull in is billed on every later turn. Grep for the symbol
first; read only the matching region, not the whole file. Narrow at the source
(`ls dir` not `ls -R`, pipe long output through `tail`/`grep`). Never re-read
what's already in context unless it changed. Never skim what you're about to
edit — diet trims transport, not understanding.

## Never minimal about

Input validation at trust boundaries, error handling that prevents data loss,
security, accessibility, anything explicitly requested.

## Switching off

Always on once installed. Deactivate: "stop chisle" / "normal mode".
