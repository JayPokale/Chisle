"use client";

import { useRef } from "react";
import { motion, useInView } from "motion/react";
import Reveal from "./Reveal";

// Verified numbers — benchmarks/results/, 20 live tasks, billed output tokens.
const ARMS = [
  { name: "chisle", pct: 52, self: true, note: "1 backfire" },
  { name: "ponytail", pct: 68, note: "8 backfires" },
  { name: "caveman", pct: 80, note: "6 backfires" },
  { name: "bare model", pct: 100, note: "baseline" },
];

// The 52% headline is a blend. Split by what the prompt asks for, and by
// answer size, the tool separates sharply — see the README for the full 2x2
// and its caveats (thin cells, weak per-task correlation).
const SPLITS = [
  { label: "coding prompts", n: 12, caveman: 74, ponytail: 59, chisle: 44 },
  { label: "explanation prompts", n: 8, caveman: 103, ponytail: 104, chisle: 87 },
  { label: "short answers", n: 10, caveman: 84, ponytail: 106, chisle: 84 },
  { label: "long answers", n: 10, caveman: 79, ponytail: 59, chisle: 45 },
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

        <Reveal delay={0.15}>
          <h3 className="mt-16 text-lg font-semibold tracking-tight">Where the average hides the story</h3>
          <p className="mt-2 max-w-xl text-sm text-dim">
            Same 20 cells, split two ways. Lower is cheaper; above 100% means the tool made the
            model write <em>more</em> than using nothing at all.
          </p>
          <div className="pane-scroll mt-6 overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="text-xs uppercase tracking-wide text-dim">
                <tr>
                  <th className="py-2 pr-4 font-medium">split</th>
                  <th className="py-2 pr-4 text-right font-medium">n</th>
                  <th className="py-2 pr-4 text-right font-medium">caveman</th>
                  <th className="py-2 pr-4 text-right font-medium">ponytail</th>
                  <th className="py-2 text-right font-medium text-amber">chisle</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {SPLITS.map((r) => (
                  <tr key={r.label}>
                    <td className="py-2 pr-4">{r.label}</td>
                    <td className="py-2 pr-4 text-right text-dim">{r.n}</td>
                    <td className={`py-2 pr-4 text-right ${r.caveman > 100 ? "text-waste" : ""}`}>{r.caveman}%</td>
                    <td className={`py-2 pr-4 text-right ${r.ponytail > 100 ? "text-waste" : ""}`}>{r.ponytail}%</td>
                    <td className="py-2 text-right font-semibold text-amber">{r.chisle}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="mt-4 max-w-xl text-xs text-dim">
            Honest reading: on <strong>short coding</strong> prompts caveman actually wins (62% to
            our 70%) — there is little to skip and the ruleset costs more than the ladder saves.
            Kind and size are also correlated, since coding prompts run ~3&times; the baseline of
            explanation ones. Cells are small; directional, not a leaderboard.
          </p>
        </Reveal>
      </div>
    </section>
  );
}
