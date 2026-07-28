"use client";

import { useState } from "react";
import Reveal from "./Reveal";

const AXES = [
  {
    name: "Terse persona",
    what: "How the model writes",
    body: "Senior-dev voice: fragments over sentences, YAGNI-first code, reuse before new code. One mode, no dials. Commits and security warnings stay verbose on purpose.",
    demo: [
      ["prompt", "Why does this React component re-render?"],
      ["bare model", "A component re-renders whenever its state or props change. In your case, you are creating a new object on every render, which means the prop identity changes each time…"],
      ["chisle", "New object ref each render. Inline object prop = new ref = re-render. `useMemo`."],
    ],
  },
  {
    name: "Output compressor",
    what: "What survives into context",
    body: "A PostToolUse hook shrinks tool results before the model reads them: ANSI scrub, head + tail elide with error-line salvage, same-session dedup. Never touches Read, Edit, or Write.",
    demo: [
      ["scrub", "strips ANSI escapes, collapses blank runs and `line repeated N×` — lossless"],
      ["elide", "oversized output → head + tail, error-like lines salvaged from the cut"],
      ["dedup", "byte-identical repeat of a tool's previous output → one-line marker"],
    ],
  },
  {
    name: "Context diet",
    what: "What gets read at all",
    body: "Rules that teach the model to fetch the slice, not the file: grep first, sliced reads, filter at the source, never re-read what's already in context.",
    demo: [
      ["before", "ls -R  ·  git log  ·  Read(whole file)"],
      ["after", "ls dir  ·  git log --oneline -10  ·  Read(offset, limit)"],
      ["why", "whole-file reads were 5.6M chars in the measured corpus, and cannot be compressed without breaking later edits"],
    ],
  },
];

const EXTRAS = [
  { name: "Live savings statusline", body: "A ⇣9k tok badge showing chars actually elided. Before v2.0.0 it counted compressions the harness went on to reject — that is fixed, and it now records only what is really applied." },
  { name: "Works beyond Claude Code", body: "Generated rulesets for Cursor, Windsurf, Cline, Kiro, and Copilot ship in the same install." },
  { name: "Tested where it matters", body: "The compressor is where a bug corrupts files — it's covered by the test suite, with a hard allowlist." },
  { name: "Easy off-switch", body: "\"stop chisle\" for the persona, CHISLE_COMPRESS=0 for the hook, npx chisle --uninstall for everything." },
];

export default function Axes() {
  const [open, setOpen] = useState<number | null>(null);
  return (
    <section id="features" className="mx-auto max-w-5xl px-5 py-24">
      <Reveal>
        <h2 className="text-2xl font-semibold tracking-tight sm:text-4xl">
          One plugin, three levers
        </h2>
        <p className="mt-3 max-w-xl text-sm text-dim">
          Other token savers only make the model write less. Tool output is the bigger bill —
          67.5% of a session — and it re-bills every turn.
        </p>
      </Reveal>
      <div className="mt-12 grid gap-px overflow-hidden rounded-xl border border-line bg-line sm:grid-cols-3">
        {AXES.map((a, i) => (
          <Reveal key={a.name} delay={i * 0.08}>
            <button
              onClick={() => setOpen(open === i ? null : i)}
              aria-expanded={open === i}
              className="lift h-full w-full border border-transparent bg-paper p-6 text-left hover:bg-panel/50"
            >
              <p className="text-xs text-amber">{a.what}</p>
              <h3 className="mt-2 text-lg font-semibold">{a.name}</h3>
              <p className="mt-2.5 text-sm leading-relaxed text-dim">{a.body}</p>
              <p className="mt-3 font-mono text-[10.5px] text-amber">
                {open === i ? "− hide" : "+ show it"}
              </p>
              {open === i && (
                <dl className="mt-3 space-y-2 border-t border-line pt-3">
                  {a.demo.map(([k, v]) => (
                    <div key={k}>
                      <dt className="font-mono text-[10px] uppercase tracking-wide text-dim">{k}</dt>
                      <dd className="mt-0.5 font-mono text-[11px] leading-relaxed">{v}</dd>
                    </div>
                  ))}
                </dl>
              )}
            </button>
          </Reveal>
        ))}
      </div>
      <div className="mt-5 grid gap-px overflow-hidden rounded-xl border border-line bg-line sm:grid-cols-2 lg:grid-cols-4">
        {EXTRAS.map((e, i) => (
          <Reveal key={e.name} delay={i * 0.06}>
            <div className="h-full bg-paper p-5">
              <h3 className="text-sm font-semibold">{e.name}</h3>
              <p className="mt-2 text-xs leading-relaxed text-dim">{e.body}</p>
            </div>
          </Reveal>
        ))}
      </div>
    </section>
  );
}
