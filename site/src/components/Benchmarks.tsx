"use client";

import { useRef } from "react";
import { motion, useInView } from "motion/react";
import Reveal from "./Reveal";

// Verified numbers — benchmarks/results/, 20 live tasks, billed output tokens.
const ARMS = [
  { name: "chisle", pct: 52, self: true, note: "1 backfire" },
  { name: "ponytail", pct: 68, note: "6 backfires" },
  { name: "caveman", pct: 80, note: "8 backfires" },
  { name: "bare model", pct: 100, note: "baseline" },
];

export default function Benchmarks() {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, margin: "-100px" });

  return (
    <section id="numbers" className="border-y border-line bg-panel/60 py-24">
      <div className="mx-auto max-w-5xl px-5">
        <Reveal>
          <h2 className="text-2xl font-semibold tracking-tight sm:text-4xl">
            The 20-task bill
          </h2>
          <p className="mt-3 max-w-xl text-sm text-dim">
            Four arms, same 20 live tasks, same model, isolated configs, billed tokens — shown as
            a share of the bare model. Raw transcripts and the runner{" "}
            <a
              href="https://github.com/JayPokale/Chisle/tree/main/benchmarks"
              className="text-amber underline underline-offset-4"
              target="_blank"
              rel="noopener noreferrer"
            >
              ship in the repo
            </a>
            .
          </p>
        </Reveal>

        <div ref={ref} className="mt-12 space-y-5">
          {ARMS.map((a, i) => (
            <div key={a.name} className="grid grid-cols-[6.5rem_1fr_5.5rem] items-center gap-4 text-sm">
              <span className={a.self ? "font-semibold" : "text-dim"}>{a.name}</span>
              <div className="h-6 overflow-hidden rounded bg-line/60">
                <motion.div
                  initial={{ width: 0 }}
                  animate={inView ? { width: `${a.pct}%` } : {}}
                  transition={{ duration: 1, delay: i * 0.12, ease: [0.16, 1, 0.3, 1] }}
                  className={`flex h-full items-center justify-end rounded pr-2 text-xs font-medium ${
                    a.self ? "bg-amber text-paper" : "bg-dim/50 text-paper"
                  }`}
                >
                  {a.pct}%
                </motion.div>
              </div>
              <span className="text-right text-xs text-dim">{a.note}</span>
            </div>
          ))}
        </div>

        <Reveal delay={0.1}>
          <p className="mt-8 text-xs text-dim">
            Average task: 69% vs 91% / 98%. Worst single task: 173% vs 227% / 424%. Both rivals
            are credited in the repo&apos;s prior-art table — right above these numbers.
          </p>
        </Reveal>
      </div>
    </section>
  );
}
