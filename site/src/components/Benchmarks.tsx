"use client";

import { useRef } from "react";
import { motion, useInView } from "motion/react";
import Reveal from "./Reveal";
import SectionHead from "./SectionHead";

// Billed output tokens as % of the bare model, every arm in one run (Claude
// Code + Haiku 4.5, 26 answers, 2026-11-19). Matches assets/benchmark.svg and
// the README. 3.13 and 3.14 share one ruleset; the gap between them is noise.
const ARMS = [
  { name: "chisle", pct: 69, self: true },
  { name: "caveman", pct: 69 },
  { name: "chisle 3.13", pct: 70 },
  { name: "ponytail", pct: 80 },
  { name: "bare model", pct: 100 },
];

// % of the bare model. Claude Code rows from benchmarks/results/raw-314-sidebyside/
// (Chisle 3.14, Haiku 4.5, 26 answers in one run, tools off). Billed tokens tie
// with caveman; answers are shortest.
const ROWS = [
  { label: "billed tokens · Claude Code", caveman: "69%", ponytail: "80%", chisle: "69%" },
  { label: "answer length · Claude Code", caveman: "56%", ponytail: "63%", chisle: "51%" },
  { label: "answer lines · Claude Code", caveman: "67%", ponytail: "67%", chisle: "46%" },
  // benchmarks/results/raw-314-commands/commands.json: 37 shell commands; caveman and
  // ponytail are rulesets only, so they pass tool output through untouched.
  { label: "terminal output read · 37 commands", caveman: "100%", ponytail: "100%", chisle: "28%" },
  // benchmarks/agentic/raw-noisylog/: one real task (fix a failing npm test,
  // 17k-char log), mean $ per fix, 3 runs per arm, every run fixed it.
  // Matches assets/benchmark-cost.svg.
  { label: "cost per fix · real failing-test task", caveman: "109%", ponytail: "93%", chisle: "73%" },
];

// Correctness, Chisle 3.14 vs bare, Haiku 4.5: benchmarks/quality/raw-314/ and
// benchmarks/agentic/raw-314/.
const CORRECT = [
  { label: "maths + coding, 52 problems × 3 seeds", bare: "156 / 156", chisle: "156 / 156" },
  { label: "real repos, hidden tests, 7 fixtures × 5 seeds", bare: "31 / 35", chisle: "31 / 35" },
];

export default function Benchmarks() {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, margin: "-100px" });

  return (
    <section id="numbers" className="border-y border-line bg-surface py-28">
      <div className="mx-auto max-w-6xl px-5">
        <SectionHead eyebrow="Benchmarks" title="The shortest answers, measured">
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
          <h3 className="mt-16 text-lg font-semibold tracking-tight">Shortest answers, cheapest fix</h3>
          <p className="mt-2 max-w-xl text-sm text-dim">
            % of the bare model, Chisle 3.14 (ruleset unchanged since 3.10) on Haiku 4.5, 26 answers
            in one run. On Sonnet 5.5, Chisle bills 53% of the bare model. Terminal output: caveman and
            ponytail never touch it; RTK leaves Claude 84% of it to read, Chisle 28%. On a real
            agent task, fixing a failing npm test, a fix costs 73% of the bare agent with Chisle
            (RTK 96%), 47% less than with Chisle 3.13.
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
