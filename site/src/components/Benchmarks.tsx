"use client";

import { useRef, useState } from "react";
import { motion, useInView } from "motion/react";
import Reveal from "./Reveal";
import SectionHead from "./SectionHead";
import samples from "@/data/samples.json";

// From benchmarks/results/2026-10-01-live-rerun.md: 13 live prompts x 2 seeds,
// billed output tokens, shipped ruleset, current harness and rival versions.
const ARMS = [
  { name: "chisle", pct: 83, self: true, note: "worst cell 170%" },
  { name: "bare model", pct: 100, note: "baseline" },
  { name: "caveman", pct: 102, note: "worst cell 305%" },
  { name: "ponytail", pct: 105, note: "worst cell 493%" },
];
const MAX_PCT = Math.max(...ARMS.map((a) => a.pct));

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
// Agent loop: 6 fixture repos x 6 seeds per arm, Haiku 4.5, hidden tests, hooks
// off, trimmed ruleset. From benchmarks/agentic/README.md (2026-10-01 run).
const LOOP_ROWS = [
  { label: "hidden tests passed", bare: "28/36", chisle: "28/36", delta: "tie" },
  { label: "output tokens / run", bare: "1,118", chisle: "1,155", delta: "+3.3%" },
  { label: "context tokens / run", bare: "115,063", chisle: "133,974", delta: "+16%" },
  { label: "turns / run", bare: "5.42", chisle: "5.92", delta: "+9%" },
  { label: "cost / run", bare: "$0.0397", chisle: "$0.0424", delta: "+6.8%" },
];


export default function Benchmarks() {
  const [metric, setMetric] = useState<"tokens" | "lines">("tokens");
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, margin: "-100px" });

  return (
    <section id="numbers" className="border-y border-line bg-surface py-28">
      <div className="mx-auto max-w-6xl px-5">
        <SectionHead eyebrow="Benchmarks" title="The bill, re-measured">
          Four arms, 13 live prompts × 2 seeds, same model, isolated configs, billed output
          tokens as a share of the bare model. Re-run on 2026-10-01 with the shipped ruleset,
          after the June headline of 52% turned out to lean on one outlier baseline. Raw
          transcripts and the runner{" "}
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
            <div key={a.name} className="grid grid-cols-[6.5rem_1fr_5.5rem] items-center gap-4 text-sm">
              <span className={a.self ? "font-semibold" : "text-dim"}>{a.name}</span>
              <div className="h-8 overflow-hidden rounded-md bg-raised">
                <motion.div
                  initial={{ width: 0 }}
                  animate={inView ? { width: `${(a.pct / MAX_PCT) * 100}%` } : {}}
                  transition={{ duration: 1, delay: i * 0.12, ease: [0.16, 1, 0.3, 1] }}
                  className={`flex h-full items-center justify-end rounded-md pr-2.5 text-xs font-semibold ${
                    a.self ? "bg-gradient-to-r from-brand to-[#ffc56b] text-on-brand" : "bg-dim/35 text-fg"
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
            95% interval for Chisle&apos;s total: 69–95%; neither rival&apos;s clears 100%. Average
            cell: 93% vs 113% (caveman) and 124% (ponytail). Both rivals are credited in the
            repo&apos;s prior-art table.
          </p>
        </Reveal>

        <Reveal delay={0.15}>
          <div className="mt-16 flex flex-wrap items-end justify-between gap-4">
            <div>
              <h3 className="text-lg font-semibold tracking-tight">Where the average hides the story</h3>
              <p className="mt-2 max-w-xl text-sm text-dim">
                Same 26 cells, sliced two ways. Above 100% means the tool made the model produce{" "}
                <em>more</em> than using nothing at all.
              </p>
            </div>
            <div className="flex gap-1 rounded-lg border border-line bg-bg p-1">
              {METRICS.map((m) => (
                <button
                  key={m.key}
                  onClick={() => setMetric(m.key)}
                  aria-pressed={metric === m.key}
                  title={m.hint}
                  className={`rounded-md px-3 py-1 text-xs font-medium transition-colors ${
                    metric === m.key ? "bg-raised text-fg shadow-sm" : "text-dim hover:text-fg"
                  }`}
                >
                  {m.label}
                </button>
              ))}
            </div>
          </div>

          <div className="pane-scroll mt-6 overflow-x-auto rounded-xl border border-line bg-bg px-5 py-2">
            <table className="w-full text-left text-sm">
              <thead className="text-xs uppercase tracking-wide text-dim">
                <tr>
                  <th className="py-2 pr-4 font-medium">split</th>
                  <th className="py-2 pr-4 text-right font-medium">n</th>
                  <th className="py-2 pr-4 text-right font-medium">caveman</th>
                  <th className="py-2 pr-4 text-right font-medium">ponytail</th>
                  <th className="py-2 text-right font-medium text-accent">chisle</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {AGG.groups.map((g) => {
                  const row = g[metric] as Record<string, number>;
                  const best = Math.min(row.caveman, row.ponytail, row.rdxmin);
                  const cell = (v: number) =>
                    `py-2 pr-4 text-right tabular-nums ${v > 100 ? "text-waste" : ""} ${v === best ? "font-semibold" : ""}`;
                  return (
                    <tr key={g.label} className="transition-colors hover:bg-accent-soft/40">
                      <td className="py-2 pr-4">{g.label}</td>
                      <td className="py-2 pr-4 text-right text-dim tabular-nums">{g.n}</td>
                      <td className={cell(row.caveman)}>{row.caveman}%</td>
                      <td className={cell(row.ponytail)}>{row.ponytail}%</td>
                      <td className={`py-2 text-right tabular-nums font-semibold ${row.rdxmin > 100 ? "text-waste" : "text-accent"}`}>
                        {row.rdxmin}%
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <p className="mt-4 max-w-xl text-xs text-dim">
            Honest reading: Chisle pays on <strong className="text-fg">long answers</strong> (77%)
            and breaks even on short ones (106%), where there is little to cut. On explanation
            prompts ponytail is leaner (86% to our 91%). The saving is in what gets written:
            reasoning tokens run 107% of bare. One prompt swung 57% → 135% between seeds, so read
            totals, not single cells.
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

            <div className="pane-scroll mt-6 overflow-x-auto rounded-xl border border-line bg-bg px-5 py-2">
              <table className="w-full text-left text-sm">
                <thead className="text-xs uppercase tracking-wide text-dim">
                  <tr>
                    <th className="py-2 pr-4 font-medium">metric</th>
                    <th className="py-2 pr-4 text-right font-medium">bare</th>
                    <th className="py-2 pr-4 text-right font-medium">caveman</th>
                    <th className="py-2 pr-4 text-right font-medium">ponytail</th>
                    <th className="py-2 text-right font-medium text-accent">chisle</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {PI_ROWS.map((r) => {
                    const best = Math.min(r.caveman, r.ponytail, r.chisle);
                    const cell = (v: number) =>
                      `py-2 pr-4 text-right tabular-nums ${v === best ? "font-semibold" : ""}`;
                    return (
                      <tr key={r.label} className="transition-colors hover:bg-accent-soft/40">
                        <td className="py-2 pr-4">{r.label}</td>
                        <td className="py-2 pr-4 text-right text-dim tabular-nums">{r.vanilla}%</td>
                        <td className={cell(r.caveman)}>{r.caveman}%</td>
                        <td className={cell(r.ponytail)}>{r.ponytail}%</td>
                        <td className={`py-2 text-right tabular-nums font-semibold text-accent`}>
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
        <Reveal>
          <div className="mt-20 border-t border-line pt-12">
            <h3 className="text-xl font-semibold tracking-tight sm:text-2xl">
              In an agent loop, Chisle costs more
            </h3>
            <p className="mt-3 max-w-2xl text-sm text-dim">
              Six real repos, 6 seeds per arm, hidden tests, hooks off, trimmed ruleset. Correctness
              ties. Context and cost come out higher: the ruleset rides along on every request, and
              Chisle took 9% more turns, each of which re-sends the whole context. Shorter answers
              do not make a loop on a small repo cheaper. Before the trim it was −4.6% context and
              +2.6% cost; the trim did not fix it.
            </p>

            <div className="pane-scroll mt-6 overflow-x-auto rounded-xl border border-line bg-bg px-5 py-2">
              <table className="w-full text-left text-sm">
                <thead className="text-xs uppercase tracking-wide text-dim">
                  <tr>
                    <th className="py-2 pr-4 font-medium">metric</th>
                    <th className="py-2 pr-4 text-right font-medium">bare</th>
                    <th className="py-2 pr-4 text-right font-medium text-accent">chisle</th>
                    <th className="py-2 text-right font-medium">change</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {LOOP_ROWS.map((r) => (
                    <tr key={r.label} className="transition-colors hover:bg-accent-soft/40">
                      <td className="py-2 pr-4">{r.label}</td>
                      <td className="py-2 pr-4 text-right text-dim tabular-nums">{r.bare}</td>
                      <td className="py-2 pr-4 text-right font-semibold text-accent tabular-nums">{r.chisle}</td>
                      <td className={`py-2 text-right tabular-nums ${r.delta.startsWith("+") ? "text-waste" : ""}`}>
                        {r.delta}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
