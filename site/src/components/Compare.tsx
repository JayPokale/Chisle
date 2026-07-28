"use client";

import { useState } from "react";
import Reveal from "./Reveal";
import Markdown from "./Markdown";
import samples from "@/data/samples.json";

// Live before/after built from benchmarks/results/raw/ via scripts/build-samples.js.
// Every word and number below is the committed transcript — no mock-ups, no
// hand-written "illustrative" rewrites. That is the whole differentiator, so the
// basis label stays visible at all times.

type Cell = { tokens: number; lines: number; chars: number; truncated: boolean; text: string };
type Task = { id: string; kind: string; prompt: string; arms: Record<string, Cell> };

const TASKS = samples.tasks as Task[];
const RIVALS = [
  { key: "caveman", label: "caveman" },
  { key: "ponytail", label: "ponytail" },
  { key: "rdxmin", label: "chisle" },
] as const;

function pct(a: number, b: number) {
  return Math.round((a / b) * 100);
}

export default function Compare() {
  const [taskId, setTaskId] = useState(TASKS[0].id);
  const [arm, setArm] = useState<string>("rdxmin");

  const task = TASKS.find((t) => t.id === taskId)!;
  const base = task.arms.vanilla;
  const cur = task.arms[arm] ?? task.arms.rdxmin;
  const share = pct(cur.tokens, base.tokens);

  return (
    <section id="compare" className="py-24">
      <div className="mx-auto max-w-5xl px-5">
        <Reveal>
          <h2 className="text-2xl font-semibold tracking-tight sm:text-4xl">
            Same prompt. Same model. Real transcripts.
          </h2>
          <p className="mt-3 max-w-2xl text-sm text-dim">
            Pick a task and an arm. Both panels are the{" "}
            <strong className="text-ink">verbatim committed output</strong> from the benchmark run —
            not a mock-up written for this page. The arms differ only in the injected system prompt.
          </p>
        </Reveal>

        <Reveal delay={0.06}>
          <div className="mt-8 flex flex-wrap gap-2">
            {TASKS.map((t) => (
              <button
                key={t.id}
                onClick={() => setTaskId(t.id)}
                aria-pressed={t.id === taskId}
                className={`rounded border px-3 py-1.5 font-mono text-xs transition-colors ${
                  t.id === taskId
                    ? "border-amber bg-amber-soft text-amber"
                    : "border-line text-dim hover:border-amber/50 hover:text-ink"
                }`}
              >
                {t.id}
                <span className="ml-1.5 opacity-60">{t.kind}</span>
              </button>
            ))}
          </div>

          <p className="mt-5 border-l-2 border-line pl-4 text-sm italic text-dim">
            &ldquo;{task.prompt}&rdquo;
          </p>
        </Reveal>

        <Reveal delay={0.1}>
          <div className="mt-8 grid gap-4 lg:grid-cols-2">
            {/* baseline */}
            <div className="flex flex-col rounded-lg border border-line bg-panel/40">
              <header className="flex items-baseline justify-between border-b border-line px-4 py-3">
                <span className="text-sm font-semibold">bare model</span>
                <span className="font-mono text-xs text-dim">
                  {base.tokens.toLocaleString()} tok · {base.lines} lines
                </span>
              </header>
              <div className="pane-scroll max-h-96 flex-1 overflow-auto px-4 py-3 text-[12px] leading-relaxed text-dim">
                <Markdown>{base.text}</Markdown>
                {base.truncated && (
                  <p className="mt-3 border-t border-line pt-2 font-mono text-[10.5px] text-dim">
                    … truncated for the page — the token count is the full response
                  </p>
                )}
              </div>
            </div>

            {/* selected arm */}
            <div className="flex flex-col rounded-lg border border-amber/60 bg-panel/40">
              <header className="flex items-baseline justify-between gap-3 border-b border-line px-4 py-3">
                <div className="flex gap-1.5">
                  {RIVALS.filter((r) => task.arms[r.key]).map((r) => (
                    <button
                      key={r.key}
                      onClick={() => setArm(r.key)}
                      aria-pressed={r.key === arm}
                      className={`rounded px-2 py-0.5 font-mono text-xs transition-colors ${
                        r.key === arm
                          ? "bg-amber-soft text-amber"
                          : "text-dim hover:text-ink"
                      }`}
                    >
                      {r.label}
                    </button>
                  ))}
                </div>
                <span className="shrink-0 font-mono text-xs">
                  <span className={share > 100 ? "text-waste" : "text-amber"}>{share}%</span>
                  <span className="text-dim">
                    {" "}
                    · {cur.tokens.toLocaleString()} tok · {cur.lines} lines
                  </span>
                </span>
              </header>
              <div className="pane-scroll max-h-96 flex-1 overflow-auto px-4 py-3 text-[12px] leading-relaxed">
                <Markdown>{cur.text}</Markdown>
                {cur.truncated && (
                  <p className="mt-3 border-t border-line pt-2 font-mono text-[10.5px] text-dim">
                    … truncated for the page — the token count is the full response
                  </p>
                )}
              </div>
            </div>
          </div>
        </Reveal>

        <Reveal delay={0.14}>
          <p className="mt-5 max-w-3xl text-xs text-dim">
            <span className="mr-2 rounded bg-amber-soft px-1.5 py-0.5 font-mono text-[10px] text-amber">
              basis: measured
            </span>
            {samples.suite} Percentages are billed output tokens against that task&apos;s own
            baseline.{" "}
            {task.id === "cache" && (
              <>
                <strong className="text-ink">Read this one carefully:</strong> the prompt shipped
                with no codebase attached. The bare model invented a 150-line class for a project it
                never saw; chisle&apos;s 7 lines are a request for the language and framework, not a
                cache. The saving is real, but it comes from refusing to guess.{" "}
              </>
            )}
            Browse every cell in{" "}
            <a
              className="text-amber underline-offset-4 hover:underline"
              href="https://github.com/JayPokale/Chisle/tree/main/benchmarks/results/raw"
            >
              benchmarks/results/raw
            </a>
            .
          </p>
        </Reveal>
      </div>
    </section>
  );
}
