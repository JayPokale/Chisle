"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "motion/react";

const QA = [
  {
    q: "Does terse output mean worse answers?",
    a: "No. Terse ≠ incomplete. The rules cut words around the facts, never the facts: the fix, the gotcha, the caveat all stay. In the 20-task benchmark every Chisle answer was verified correct.",
  },
  {
    q: "What's the overhead of the plugin itself?",
    a: "~1.6k tokens of rules at session start, plus a ~50-token reminder per turn. It used to be worse: the ruleset was re-sent on every resume and clear, which a user measured across 173 sessions as roughly cancelling the compressor's savings. That re-injection is fixed. On a one-line throwaway prompt the overhead still exceeds the saving.",
  },
  {
    q: "Can the compressor corrupt my files?",
    a: "No. It runs behind a hard allowlist and never touches Read, Edit, or Write, whose exact bytes feed later edits. That boundary is covered by the test suite.",
  },
  {
    q: "Does it work outside Claude Code?",
    a: "Pi runs both axes, with live toggling and a savings badge, the same as Claude Code. The ruleset ships to Cursor, Windsurf, Cline, Kiro, Codex, Gemini, and Copilot via generated rule files; there the persona is always on and the compressor does not apply.",
  },
  {
    q: "How do I turn it off?",
    a: "\"stop chisle\" for the persona, CHISLE_COMPRESS=0 for the compressor, npx chisle --uninstall to remove everything.",
  },
];

export default function Faq() {
  const [open, setOpen] = useState<number | null>(0);
  return (
    <section id="faq" className="border-t border-line py-24">
      <div className="mx-auto max-w-2xl px-5">
        <h2 className="text-center text-2xl font-semibold tracking-tight sm:text-4xl">FAQ</h2>
        <div className="mt-10 divide-y divide-line border-y border-line">
          {QA.map((item, i) => (
            <div key={i}>
              <button
                onClick={() => setOpen(open === i ? null : i)}
                className="flex w-full items-center justify-between gap-4 py-4 text-left text-sm font-medium transition-colors hover:text-amber"
                aria-expanded={open === i}
              >
                <span>{item.q}</span>
                <span className={`text-amber transition-transform ${open === i ? "rotate-45" : ""}`}>+</span>
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
