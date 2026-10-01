"use client";

import { useState } from "react";
import Reveal from "./Reveal";
import SectionHead from "./SectionHead";
import Markdown from "./Markdown";
import samples from "@/data/samples.json";

// Live before/after built from benchmarks/results/raw/ via scripts/build-samples.js.
// Every word and number below is the committed transcript. No mock-ups, no
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
    <section id="compare" className="py-28">
      <div className="mx-auto max-w-6xl px-5">
        <SectionHead eyebrow="Compare" title="Same prompt. Same model. Real transcripts.">
          Pick a task and an arm. Both panels are the{" "}
          <strong className="text-fg">verbatim committed output</strong> from the benchmark run,
          not a mock-up written for this page. The arms differ only in the injected system prompt.
        </SectionHead>

        <Reveal delay={0.06}>
          <div className="mt-8 flex flex-wrap gap-2">
            {TASKS.map((t) => (
              <button
                key={t.id}
                onClick={() => setTaskId(t.id)}
                aria-pressed={t.id === taskId}
                className={`rounded-md border px-3 py-1.5 font-mono text-xs transition-colors ${
                  t.id === taskId
                    ? "border-brand-hover bg-accent-soft text-accent"
                    : "border-line text-dim hover:border-brand-hover/50 hover:text-fg"
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
            <div className="flex min-w-0 flex-col rounded-xl border border-line bg-surface">
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
                    … truncated for the page; the token count is the full response
                  </p>
                )}
              </div>
            </div>

            {/* selected arm */}
            <div className="flex min-w-0 flex-col rounded-xl border border-brand-hover/60 bg-surface shadow-[0_0_40px_-12px_#ffa028]">
              <header className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-2 border-b border-line px-4 py-3">
                <div className="flex gap-1.5">
                  {RIVALS.filter((r) => task.arms[r.key]).map((r) => (
                    <button
                      key={r.key}
                      onClick={() => setArm(r.key)}
                      aria-pressed={r.key === arm}
                      className={`rounded px-2 py-0.5 font-mono text-xs transition-colors ${
                        r.key === arm
                          ? "bg-accent-soft text-accent"
                          : "text-dim hover:text-fg"
                      }`}
                    >
                      {r.label}
                    </button>
                  ))}
                </div>
                <span className="shrink-0 font-mono text-xs">
                  <span className={share > 100 ? "text-waste" : "text-accent"}>{share}%</span>
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
                    … truncated for the page; the token count is the full response
                  </p>
                )}
              </div>
            </div>
          </div>
        </Reveal>

        <Reveal delay={0.14}>
          <p className="mt-5 max-w-3xl text-xs text-dim">
            <span className="mr-2 rounded bg-accent-soft px-1.5 py-0.5 font-mono text-[10px] text-accent">
              basis: measured
            </span>
            {samples.suite} Percentages are billed output tokens against that task&apos;s own
            baseline.{" "}
            {task.id === "cache" && (
              <>
                <strong className="text-fg">Read this one carefully:</strong> the prompt shipped
                with no codebase attached. The bare model invented a 150-line class for a project it
                never saw; chisle&apos;s 7 lines are a request for the language and framework, not a
                cache. The saving is real, but it comes from refusing to guess.{" "}
              </>
            )}
            Browse every cell in{" "}
            <a
              className="text-accent underline-offset-4 hover:underline"
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
