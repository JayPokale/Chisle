"use client";

import { useState } from "react";
import Reveal from "./Reveal";
import { Glyph } from "./icons";

const AXES = [
  {
    icon: "persona",
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
    icon: "compress",
    name: "Output compressor",
    what: "What survives into context",
    body: "A post-tool hook shrinks tool results before the model reads them: ANSI scrub, head + tail elide with error-line salvage, same-session dedup. Never touches Read, Edit, or Write. Runs on Claude Code, Pi, and OpenCode.",
    demo: [
      ["scrub", "strips ANSI escapes, collapses blank runs and `line repeated N×`, losslessly"],
      ["elide", "oversized output → head + tail, error-like lines salvaged from the cut"],
      ["dedup", "byte-identical repeat of a tool's previous output → one-line marker"],
    ],
  },
  {
    icon: "diet",
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
  { icon: "status", name: "Live savings statusline", body: "A ⇣9k tok badge showing chars actually elided. Before v2.0.0 it counted compressions the harness went on to reject. That is fixed, and it now records only what is really applied." },
  { icon: "tested", name: "Tested where it matters", body: "The compressor is where a bug corrupts files, so it's covered by the test suite, with a hard allowlist." },
  { icon: "off", name: "Easy off-switch", body: "\"stop chisle\" for the persona, CHISLE_COMPRESS=0 for the hook, npx chisle --uninstall for everything." },
];

function Icon({ name }: { name: string }) {
  return (
    <span className="grid h-10 w-10 place-items-center rounded-lg border border-brand-hover/40 bg-accent-soft text-accent">
      <Glyph name={name} />
    </span>
  );
}

export default function Axes() {
  const [open, setOpen] = useState<number | null>(null);
  return (
    <section id="features" className="mx-auto max-w-6xl px-5 py-28">
      <Reveal>
        <div className="mx-auto max-w-2xl text-center">
          <p className="text-sm font-medium text-accent">Features</p>
          <h2 className="mt-3 text-3xl font-bold tracking-tight sm:text-5xl">One plugin, three levers</h2>
          <p className="mt-4 text-dim">
            Other token savers only make the model write less. Tool output is the bigger bill,
            67.5% of a session, and it re-bills every turn.
          </p>
        </div>
      </Reveal>

      <div className="mt-14 grid gap-4 md:grid-cols-3">
        {AXES.map((a, i) => (
          <Reveal key={a.name} delay={i * 0.08}>
            <div className="lift flex h-full flex-col rounded-xl border border-line bg-surface p-6">
              <Icon name={a.icon} />
              <p className="mt-5 text-xs font-medium uppercase tracking-wider text-accent">{a.what}</p>
              <h3 className="mt-1.5 text-xl font-semibold">{a.name}</h3>
              <p className="mt-3 flex-1 text-sm leading-relaxed text-dim">{a.body}</p>
              <button
                onClick={() => setOpen(open === i ? null : i)}
                aria-expanded={open === i}
                className="mt-5 w-fit text-sm font-medium text-accent hover:underline underline-offset-4"
              >
                {open === i ? "Hide example" : "See it applied →"}
              </button>
              {open === i && (
                <dl className="mt-4 space-y-2.5 rounded-lg border border-line bg-bg p-3">
                  {a.demo.map(([k, v]) => (
                    <div key={k}>
                      <dt className="font-mono text-[10px] uppercase tracking-wider text-dim">{k}</dt>
                      <dd className="mt-0.5 font-mono text-[11.5px] leading-relaxed">{v}</dd>
                    </div>
                  ))}
                </dl>
              )}
            </div>
          </Reveal>
        ))}
        {EXTRAS.map((e, i) => (
          <Reveal key={e.name} delay={0.2 + i * 0.06}>
            <div className="lift h-full rounded-xl border border-line bg-surface p-6">
              <Icon name={e.icon} />
              <h3 className="mt-5 text-base font-semibold">{e.name}</h3>
              <p className="mt-2 text-sm leading-relaxed text-dim">{e.body}</p>
            </div>
          </Reveal>
        ))}
      </div>
    </section>
  );
}
