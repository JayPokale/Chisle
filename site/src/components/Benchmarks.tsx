"use client";

import { useRef, useState } from "react";
import { motion, useInView } from "motion/react";
import Reveal from "./Reveal";
import samples from "@/data/samples.json";

// Verified numbers from benchmarks/results/, 20 live tasks, billed output tokens.
const ARMS = [
  { name: "chisle", pct: 52, self: true, note: "1 backfire" },
  { name: "ponytail", pct: 68, note: "8 backfires" },
  { name: "caveman", pct: 80, note: "6 backfires" },
  { name: "bare model", pct: 100, note: "baseline" },
];

// Generated from every committed cell by scripts/build-samples.js. Two
// metrics, because they answer different questions: tokens is the bill, lines
// is how much the reader actually wades through.
const AGG = samples.aggregates;
const METRICS = [
  { key: "tokens", label: "billed tokens", hint: "what the model charged you" },
  { key: "lines", label: "answer lines", hint: "what you actually read" },
] as const;
// The Pi arm, 6 tasks on Pi 0.85.1 + openai-codex/gpt-5.5, as % of the vanilla
// baseline. Published because Chisle lost billed output here, and the rule of
// this repo is that the losing rows ship too.
const PI_ROWS = [
  { label: "coding billed", vanilla: 100, caveman: 87, ponytail: 49, chisle: 73 },
  { label: "non-coding billed", vanilla: 100, caveman: 43, ponytail: 76, chisle: 39 },
  { label: "all billed", vanilla: 100, caveman: 72, ponytail: 59, chisle: 61 },
  { label: "visible answer", vanilla: 100, caveman: 56, ponytail: 49, chisle: 37 },
  { label: "answer lines", vanilla: 100, caveman: 75, ponytail: 38, chisle: 37 },
];


export default function Benchmarks() {
  const [metric, setMetric] = useState<"tokens" | "lines">("tokens");
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
            Four arms, same 20 live tasks, same model, isolated configs, billed tokens, shown as
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
            are credited in the repo&apos;s prior-art table, right above these numbers.
          </p>
        </Reveal>

        <Reveal delay={0.15}>
          <div className="mt-16 flex flex-wrap items-end justify-between gap-4">
            <div>
              <h3 className="text-lg font-semibold tracking-tight">Where the average hides the story</h3>
              <p className="mt-2 max-w-xl text-sm text-dim">
                Same 20 cells, sliced two ways. Above 100% means the tool made the model produce{" "}
                <em>more</em> than using nothing at all.
              </p>
            </div>
            <div className="flex gap-1.5">
              {METRICS.map((m) => (
                <button
                  key={m.key}
                  onClick={() => setMetric(m.key)}
                  aria-pressed={metric === m.key}
                  title={m.hint}
                  className={`lift rounded border px-3 py-1.5 font-mono text-[11px] ${
                    metric === m.key
                      ? "border-amber bg-amber-soft text-amber"
                      : "border-line text-dim hover:text-ink"
                  }`}
                >
                  {m.label}
                </button>
              ))}
            </div>
          </div>

          <div className="mt-6 overflow-x-auto">
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
                {AGG.groups.map((g) => {
                  const row = g[metric] as Record<string, number>;
                  const best = Math.min(row.caveman, row.ponytail, row.rdxmin);
                  const cell = (v: number) =>
                    `py-2 pr-4 text-right tabular-nums ${v > 100 ? "text-waste" : ""} ${v === best ? "font-semibold" : ""}`;
                  return (
                    <tr key={g.label} className="transition-colors hover:bg-amber-soft/25">
                      <td className="py-2 pr-4">{g.label}</td>
                      <td className="py-2 pr-4 text-right text-dim tabular-nums">{g.n}</td>
                      <td className={cell(row.caveman)}>{row.caveman}%</td>
                      <td className={cell(row.ponytail)}>{row.ponytail}%</td>
                      <td className={`py-2 text-right tabular-nums font-semibold text-amber ${row.rdxmin > 100 ? "text-waste" : ""}`}>
                        {row.rdxmin}%
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <p className="mt-4 max-w-xl text-xs text-dim">
            Honest reading: on <strong className="text-ink">short coding</strong> prompts caveman
            wins outright (62% to our 70%): little to skip, and the ruleset costs more than the
            ladder saves. Kind and size are correlated too, since coding prompts run ~3&times; the
            baseline of explanation ones. Cells are small; directional, not a leaderboard.
          </p>
        </Reveal>
        <Reveal>
          <div className="mt-20 border-t border-line pt-12">
            <h3 className="text-xl font-semibold tracking-tight sm:text-2xl">
              The Pi arm, including the row we lost
            </h3>
            <p className="mt-3 max-w-2xl text-sm text-dim">
              Six tasks on Pi 0.85.1 with openai-codex/gpt-5.5, as a share of the bare model.
              ponytail took total billed output 59% to 61%. Chisle still wrote the smallest
              answers of any arm.
            </p>

            <div className="mt-6 overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="text-xs uppercase tracking-wide text-dim">
                  <tr>
                    <th className="py-2 pr-4 font-medium">metric</th>
                    <th className="py-2 pr-4 text-right font-medium">bare</th>
                    <th className="py-2 pr-4 text-right font-medium">caveman</th>
                    <th className="py-2 pr-4 text-right font-medium">ponytail</th>
                    <th className="py-2 text-right font-medium text-amber">chisle</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {PI_ROWS.map((r) => {
                    const best = Math.min(r.caveman, r.ponytail, r.chisle);
                    const cell = (v: number) =>
                      `py-2 pr-4 text-right tabular-nums ${v === best ? "font-semibold" : ""}`;
                    return (
                      <tr key={r.label} className="transition-colors hover:bg-amber-soft/25">
                        <td className="py-2 pr-4">{r.label}</td>
                        <td className="py-2 pr-4 text-right text-dim tabular-nums">{r.vanilla}%</td>
                        <td className={cell(r.caveman)}>{r.caveman}%</td>
                        <td className={cell(r.ponytail)}>{r.ponytail}%</td>
                        <td className={`py-2 text-right tabular-nums font-semibold text-amber`}>
                          {r.chisle}%
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
