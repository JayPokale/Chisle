"use client";

import { useRef } from "react";
import { motion, useInView } from "motion/react";
import Reveal from "./Reveal";
import SectionHead from "./SectionHead";

// Billed output tokens as % of the bare model, every arm in one session (Claude
// Code + Sonnet 5.5, 13 standalone prompts x 3 runs, 2026-11-23). Matches
// assets/benchmark-sonnet.svg and the README.
const ARMS = [
  { name: "chisle", pct: 61, self: true },
  { name: "ponytail", pct: 73 },
  { name: "caveman", pct: 78 },
  { name: "bare model", pct: 100 },
];

// % of the bare model. Claude Code rows from benchmarks/results/raw-314-opus-direct/,
// raw-314-sonnet-direct/ and raw-314-direct/ (Chisle 3.14, 39 answers per arm and
// model in one session, every arm answered every prompt).
const ROWS = [
  { label: "billed tokens · Opus 5.5", caveman: 86, ponytail: 58, chisle: 51 },
  { label: "billed tokens · Sonnet 5.5", caveman: 78, ponytail: 73, chisle: 61 },
  { label: "billed tokens · Haiku 4.5", caveman: 96, ponytail: 115, chisle: 91 },
  { label: "answer length · Opus 5.5", caveman: 83, ponytail: 59, chisle: 50 },
  { label: "answer length · Sonnet 5.5", caveman: 77, ponytail: 64, chisle: 57 },
  { label: "answer length · Haiku 4.5", caveman: 76, ponytail: 70, chisle: 61 },
  // benchmarks/agentic/raw-releasered{,-sonnet,-opus}/: one task with tests, git
  // history, diffs and two fixes; 5 runs on Haiku, 3 on Sonnet and Opus, all fixed.
  { label: "cost · red release · Haiku 4.5", caveman: 97, ponytail: 102, chisle: 61 },
  { label: "cost · red release · Sonnet 5.5", caveman: 94, ponytail: 104, chisle: 88 },
  { label: "cost · red release · Opus 5.5", caveman: 97, ponytail: 102, chisle: 81 },
  // The last two cards share the final row on wide screens (see Benchmarks below).
  // benchmarks/results/raw-314-commands/commands.json: 37 shell commands; caveman and
  // ponytail are rulesets only, so they pass tool output through untouched.
  { label: "terminal output read · 37 commands", caveman: 100, ponytail: 100, chisle: 28 },
  // benchmarks/agentic/raw-{noisylog,commands,releasered}/: four real tasks with
  // noisy commands (failing test, 391-test green suite, bug in a big commit, red
  // release), Haiku 4.5, 3-5 runs per arm per task, no RTK in any arm, every run
  // fixed its task; each ruleset's own cached prompt not counted. Matches
  // assets/benchmark-cost.svg.
  { label: "cost · 4 real agent tasks · Haiku 4.5", caveman: 108, ponytail: 103, chisle: 73 },
];

// Correctness, Chisle 3.14 vs bare, Haiku 4.5: benchmarks/quality/raw-314/ and
// benchmarks/agentic/raw-314/.
const CORRECT = [
  { label: "maths + coding, 52 problems × 3 seeds", bare: "156 / 156", chisle: "156 / 156" },
  { label: "real repos, hidden tests, 7 fixtures × 5 seeds", bare: "31 / 35", chisle: "31 / 35" },
];

// Bars run on a fixed scale so cards compare at a glance; the bare model is the
// dashed line at 100%.
const SCALE = 125;
const RIVALS = ["caveman", "ponytail", "chisle"] as const;

function Comparison({ row, show, delay, span }: { row: (typeof ROWS)[number]; show: boolean; delay: number; span: string }) {
  const [metric, ...context] = row.label.split(" · ");
  const summary = RIVALS.map((k) => `${k} ${row[k]}%`).join(", ");
  return (
    <figure className={`rounded-xl border border-line bg-bg p-4 ${span}`} aria-label={`${row.label}, % of the bare model: ${summary}`}>
      <figcaption className="text-sm">
        <span className="font-semibold">{metric}</span>
        <span className="text-dim"> · {context.join(" · ")}</span>
      </figcaption>
      <div className="mt-3 space-y-2" aria-hidden="true">
        {RIVALS.map((k, j) => {
          const v = row[k];
          const self = k === "chisle";
          return (
            <div key={k} className="grid grid-cols-[4.25rem_1fr_2.75rem] items-center gap-2 text-xs">
              <span className={self ? "font-semibold text-accent" : "text-dim"}>{k}</span>
              <div className="relative h-4 rounded bg-raised">
                <motion.div
                  initial={{ width: 0 }}
                  animate={show ? { width: `${(Math.min(v, SCALE) / SCALE) * 100}%` } : {}}
                  transition={{ duration: 0.9, delay: delay + j * 0.1, ease: [0.16, 1, 0.3, 1] }}
                  className={`h-full rounded ${self ? "bg-gradient-to-r from-brand to-[#ffc56b]" : "bg-dim/35"}`}
                />
                <span
                  className="absolute -inset-y-1 border-l border-dashed border-fg/50"
                  style={{ left: `${(100 / SCALE) * 100}%` }}
                />
              </div>
              <span className={`text-right tabular-nums ${self ? "font-semibold text-accent" : v > 100 ? "text-waste" : "text-dim"}`}>
                {v}%
              </span>
            </div>
          );
        })}
      </div>
    </figure>
  );
}

export default function Benchmarks() {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, margin: "-100px" });
  const cmpRef = useRef<HTMLDivElement>(null);
  const cmpInView = useInView(cmpRef, { once: true, margin: "-80px" });

  return (
    <section id="numbers" className="border-y border-line bg-surface py-28">
      <div className="mx-auto max-w-6xl px-5">
        <SectionHead eyebrow="Benchmarks" title="The shortest answers, measured">
          Same model, same prompts, one difference: the injected ruleset. Billed output tokens as a
          share of the bare model, every arm in one run on Claude Code + Sonnet 5.5. Raw transcripts and the runner{" "}
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
            % of the bare model, Chisle 3.14 (ruleset unchanged since 3.10) in Claude Code on Sonnet
            5.5, 39 answers in one session, every arm answering every prompt. On Opus 5.5 the gap
            widens: Chisle bills 51% of the bare model, ponytail 58%, caveman 86%. On Haiku 4.5 every
            ruleset adds hidden thinking, so the same answers save less: Chisle 91%, caveman 96%,
            ponytail 115%. Terminal output: caveman and
            ponytail never touch it; Chisle leaves Claude 28% of it to read. Across four real
            agent tasks with noisy test and git output, Chisle costs 73% of the bare agent,
            caveman 108%, ponytail 103% (each ruleset's own cached prompt not counted). On one
            task that needs all of it at once (a 517-test suite, git history and diffs, two
            fixes), Chisle is the cheapest arm on every model: 61% on Haiku, 88% on Sonnet, 81%
            on Opus. On the failing-test task alone, Chisle 3.14 costs 47%
            less than 3.13.
          </p>
          <div ref={cmpRef} className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-6">
            {ROWS.map((r, i) => (
              <Comparison
                key={r.label}
                row={r}
                show={cmpInView}
                delay={(i % 3) * 0.08}
                // Rows of three model cards; the two single cards close on a half-width pair.
                span={i < ROWS.length - 2 ? "lg:col-span-2" : i === ROWS.length - 1 ? "sm:col-span-2 lg:col-span-3" : "lg:col-span-3"}
              />
            ))}
          </div>
          <p className="mt-3 text-xs text-dim">
            Dashed line: the bare model (100%). Shorter bars are cheaper; amber is Chisle.
          </p>
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
