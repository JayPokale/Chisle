"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import SectionHead from "./SectionHead";

const QA = [
  {
    q: "Does terse output mean worse answers?",
    a: "No. Terse ≠ incomplete. The rules cut words around the facts, never the facts: the fix, the gotcha, the caveat all stay. On 156 auto-graded maths and coding problems Chisle 3.9 scored 156/156, the bare model 154/156; on 42 agentic repo runs with hidden tests, 38 vs 36.",
  },
  {
    q: "Can the compressor corrupt my files?",
    a: "No. It runs behind a hard allowlist and never touches Read, Edit, or Write, whose exact bytes feed later edits. That boundary is covered by the test suite.",
  },
  {
    q: "Does it work outside Claude Code?",
    a: "Thirteen agents in total. Pi runs both axes with live toggling and a savings badge, the same as Claude Code. OpenCode runs both axes too, via a native plugin that compresses tool output plus the fenced ruleset and on-demand skills, but has no live toggle. Copilot CLI runs both axes through its global instructions file and a postToolUse hook, also without a live toggle. Hermes gets the skills as /chisle commands. The ruleset alone ships to Cursor, Windsurf, Cline, Kiro, Antigravity, Codex, Gemini, and Copilot via generated rule files; there the persona is always on, and npx chisle mcp wrap adds compression for MCP tool output.",
  },
  {
    q: "Why does Chisle tell me to /compact after a break?",
    a: "The prompt cache lives about an hour. After a longer break, the next request re-sends your whole context at full price and every later turn re-reads it. In Claude Code, on the first prompt after a 60-minute gap with 150k+ tokens of context, Chisle shows one line suggesting /compact or /clear. It never blocks the prompt and the model never sees it. On the maintainer's sessions those re-writes were 14% of spend.",
  },
  {
    q: "What does npx chisle tools do?",
    a: "Claude Code sends the schema of every loaded tool and a description of every skill on every request, used or not. npx chisle tools reports their size against how often you actually used them; npx chisle tools trim denies the unused tools (never core tools) and lists unused skills name-only, still callable, and npx chisle tools restore undoes exactly that. On the agentic suite the tool trim cut cost per request by 10%, and no trimmed tool or skill was ever needed.",
  },
  {
    q: "Does it fight with my Claude Code output style?",
    a: "No, not since 3.5.0. Output styles also govern prose structure, so an active style and Chisle's prose rules used to issue contradicting instructions with no precedence between them. Chisle now reads the active style and steps its prose rules aside on its own, with nothing to configure. The code rules, the ladder, the context diet, and the compressor all keep running. If you want the prose rules even with a style active, set sections.prose to true in ~/.config/chisle/config.json; explicit config always beats detection.",
  },
  {
    q: "How do I turn it off?",
    a: "\"stop chisle\" for the persona, CHISLE_COMPRESS=0 for the compressor, npx chisle --uninstall to remove everything.",
  },
  {
    q: "How do I update it?",
    a: "npx chisle@latest --update covers every agent you have installed. Plain npx chisle will not upgrade you: every install path skips what is already present, so the run reports success and changes nothing. The @latest pin matters too, since npx can serve a cached copy of the package. Add --only <id> for one agent: claude, pi, gemini, codex, copilot-cli, opencode, hermes, cursor, windsurf, cline, kiro, copilot. Native equivalents work as well: claude plugin update chisle@chisle, or pi install npm:chisle. Cursor, Windsurf, Cline, Kiro, and Copilot keep their rule file inside the repo, so cd into the project first — run from your home directory and --update reports \"Nothing to update\" even when the project is set up correctly. Full per-agent table in INSTALL.md.",
  },
];

export default function Faq() {
  const [open, setOpen] = useState<number | null>(0);
  return (
    <section id="faq" className="py-28">
      <div className="mx-auto max-w-3xl px-5">
        <SectionHead eyebrow="FAQ" title="Questions, answered tersely" center />
        <div className="mt-12 space-y-3">
          {QA.map((item, i) => (
            <div key={i} className="rounded-xl border border-line bg-surface px-5 transition-colors has-[[aria-expanded=true]]:border-brand-hover/60">
              <button
                onClick={() => setOpen(open === i ? null : i)}
                className="flex w-full items-center justify-between gap-4 py-4 text-left font-medium transition-colors hover:text-accent"
                aria-expanded={open === i}
              >
                <span>{item.q}</span>
                <span aria-hidden className={`grid h-6 w-6 shrink-0 place-items-center rounded-md bg-accent-soft text-accent transition-transform ${open === i ? "rotate-45" : ""}`}>+</span>
              </button>
              <AnimatePresence initial={false}>
                {open === i && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
                    className="overflow-hidden"
                  >
                    <p className="pb-5 text-sm leading-relaxed text-dim">{item.a}</p>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
