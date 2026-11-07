"use client";

import { useRef } from "react";
import { motion, useInView } from "motion/react";
import Reveal from "./Reveal";
import SectionHead from "./SectionHead";

// Billed output tokens as % of the bare model, every arm in one run (Claude
// Code + Haiku 4.5, 25 tasks). Matches assets/benchmark.svg and the README.
const ARMS = [
  { name: "chisle", pct: 71, self: true },
  { name: "chisle 3.8.1", pct: 75 },
  { name: "caveman", pct: 87 },
  { name: "ponytail", pct: 90 },
  { name: "bare model", pct: 100 },
];

// % of the bare model; Chisle is lowest on every row. Claude Code rows from
// benchmarks/results/raw-nov-sidebyside/ (Chisle 3.9, Haiku 4.5, 25 prompts in
// one run, tools off).
const ROWS = [
  { label: "billed tokens · Claude Code", caveman: "87%", ponytail: "90%", chisle: "71%" },
  { label: "answer length · Claude Code", caveman: "59%", ponytail: "62%", chisle: "55%" },
  { label: "answer lines · Claude Code", caveman: "55%", ponytail: "60%", chisle: "45%" },
];

// Correctness, Chisle 3.9+ vs bare, Haiku 4.5: benchmarks/quality/raw-nov/ and
// benchmarks/agentic/raw-nov/.
const CORRECT = [
  { label: "maths + coding, 52 problems × 3 seeds", bare: "154 / 156", chisle: "156 / 156" },
  { label: "real repos, hidden tests, 7 fixtures × 6 seeds", bare: "36 / 42", chisle: "38 / 42" },
];

export default function Benchmarks() {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, margin: "-100px" });

  return (
    <section id="numbers" className="border-y border-line bg-surface py-28">
      <div className="mx-auto max-w-6xl px-5">
        <SectionHead eyebrow="Benchmarks" title="The lowest bill, measured">
          Same model, same prompts, one difference: the injected ruleset. Billed output tokens as a
          share of the bare model, every arm in one run on Claude Code + Haiku 4.5. Raw transcripts and the runner{" "}
          <a
            href="https://github.com/JayPokale/Chisle/tree/main/benchmarks"
            className="text-accent underline underline-offset-4"
            target="_blank"
            rel="noopener noreferrer"
          >
            ship in the repo
          </a>
          .
        </SectionHead>

        <div ref={ref} className="mt-12 space-y-5 rounded-xl border border-line bg-bg p-6 sm:p-8">
          {ARMS.map((a, i) => (
            <div key={a.name} className="grid grid-cols-[7.5rem_1fr] items-center gap-4 text-sm">
              <span className={a.self ? "font-semibold" : "text-dim"}>{a.name}</span>
              <div className="h-8 overflow-hidden rounded-md bg-raised">
                <motion.div
                  initial={{ width: 0 }}
                  animate={inView ? { width: `${a.pct}%` } : {}}
                  transition={{ duration: 1, delay: i * 0.12, ease: [0.16, 1, 0.3, 1] }}
                  className={`flex h-full items-center justify-end rounded-md pr-2.5 text-xs font-semibold ${
                    a.self ? "bg-gradient-to-r from-brand to-[#ffc56b] text-on-brand" : "bg-dim/35 text-fg"
                  }`}
                >
                  {a.pct}%
                </motion.div>
              </div>
            </div>
          ))}
        </div>

        <Reveal delay={0.1}>
          <h3 className="mt-16 text-lg font-semibold tracking-tight">Leanest on every row</h3>
          <p className="mt-2 max-w-xl text-sm text-dim">
            % of the bare model, current Chisle (ruleset unchanged since 3.9) on Haiku 4.5, 25 live
            prompts in one run. On Sonnet 5.5, Chisle bills 57% of the bare model.
          </p>
          <div className="pane-scroll mt-6 overflow-x-auto rounded-xl border border-line bg-bg px-5 py-2">
            <table className="w-full text-left text-sm">
              <thead className="text-xs uppercase tracking-wide text-dim">
                <tr>
                  <th className="py-2 pr-4 font-medium">metric</th>
                  <th className="py-2 pr-4 text-right font-medium">caveman</th>
                  <th className="py-2 pr-4 text-right font-medium">ponytail</th>
                  <th className="py-2 text-right font-medium text-accent">chisle</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {ROWS.map((r) => (
                  <tr key={r.label} className="transition-colors hover:bg-accent-soft/40">
                    <td className="py-2 pr-4">{r.label}</td>
                    <td className="py-2 pr-4 text-right text-dim tabular-nums">{r.caveman}</td>
                    <td className="py-2 pr-4 text-right text-dim tabular-nums">{r.ponytail}</td>
                    <td className="py-2 text-right font-semibold text-accent tabular-nums">{r.chisle}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <h3 className="mt-16 text-lg font-semibold tracking-tight">Correctness: shorter, not wronger</h3>
          <p className="mt-2 max-w-xl text-sm text-dim">
            Auto-graded, no judge model. Neither gap is significant (Fisher p = 0.498, 0.738).
          </p>
          <div className="pane-scroll mt-6 overflow-x-auto rounded-xl border border-line bg-bg px-5 py-2">
            <table className="w-full text-left text-sm">
              <thead className="text-xs uppercase tracking-wide text-dim">
                <tr>
                  <th className="py-2 pr-4 font-medium">suite</th>
                  <th className="py-2 pr-4 text-right font-medium">bare model</th>
                  <th className="py-2 text-right font-medium text-accent">chisle</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {CORRECT.map((r) => (
                  <tr key={r.label} className="transition-colors hover:bg-accent-soft/40">
                    <td className="py-2 pr-4">{r.label}</td>
                    <td className="py-2 pr-4 text-right text-dim tabular-nums">{r.bare}</td>
                    <td className="py-2 text-right font-semibold text-accent tabular-nums">{r.chisle}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="mt-4 text-xs text-dim">
            Plus the input side: the compressor trims ~46% off every oversized tool output before
            it re-enters context. Chisle began as a merge of caveman and ponytail; their MIT notices
            are in the repo&apos;s NOTICE file.
          </p>
        </Reveal>
      </div>
    </section>
  );
}
