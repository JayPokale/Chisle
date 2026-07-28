"use client";

import Reveal from "./Reveal";

// The YAGNI ladder, mirroring the mermaid diagram in the README.
//
// Deliberately NOT mermaid: that package is ~83MB unpacked against a site with
// four runtime dependencies, to draw boxes and arrows. Rung 1 of this very
// ladder says don't. Plain markup themed with the site tokens covers it.
const RUNGS = [
  { q: "Does this need to exist at all?", a: "Skip it. Say so in one line.", tag: "YAGNI" },
  { q: "Already in this codebase?", a: "Reuse it. Don't rewrite.", tag: "reuse" },
  { q: "Stdlib does it?", a: "Use the stdlib.", tag: "stdlib" },
  { q: "Native platform feature covers it?", a: "CSS over JS. DB constraint over app code.", tag: "native" },
  { q: "Already-installed dependency?", a: "Use it — never add a dep for a few lines.", tag: "dep" },
  { q: "Can it be one line?", a: "One line.", tag: "one line" },
  { q: "Only then", a: "The minimum code that works.", tag: "minimum" },
];

export default function Ladder() {
  return (
    <section id="ladder" className="py-24">
      <div className="mx-auto max-w-5xl px-5">
        <Reveal>
          <h2 className="text-2xl font-semibold tracking-tight sm:text-4xl">
            The ladder, before a line gets written
          </h2>
          <p className="mt-3 max-w-xl text-sm text-dim">
            The agent stops at the <strong>first</strong> rung that holds — and the ladder runs
            after reading the problem, never instead of it.
          </p>
        </Reveal>

        <ol className="mt-10 space-y-px">
          {RUNGS.map((r, i) => (
            <Reveal key={r.tag} delay={0.04 * i}>
              <li className="group relative flex flex-col gap-1 border-l-2 border-line bg-panel/40 py-4 pl-6 pr-4 transition-colors hover:border-amber sm:flex-row sm:items-center sm:gap-6">
                <span
                  aria-hidden
                  className="absolute -left-[7px] top-1/2 h-3 w-3 -translate-y-1/2 rounded-full border-2 border-line bg-panel transition-colors group-hover:border-amber"
                />
                <span className="w-8 shrink-0 font-mono text-xs text-dim">{i + 1}</span>
                <span className="flex-1 text-sm font-medium">{r.q}</span>
                <span className="flex-1 text-sm text-dim">→ {r.a}</span>
                <span className="shrink-0 rounded bg-amber-soft px-2 py-0.5 font-mono text-[11px] text-amber">
                  {r.tag}
                </span>
              </li>
            </Reveal>
          ))}
        </ol>

        <Reveal delay={0.1}>
          <p className="mt-8 max-w-xl text-xs text-dim">
            Every rung exits the same way: ship it, then say what was skipped and when to add it —
            so &ldquo;later&rdquo; doesn&apos;t quietly become &ldquo;never&rdquo;. Lazy about the
            solution, never about the reading. Trust-boundary validation, data-loss handling,
            security and accessibility are never on the chopping block.
          </p>
        </Reveal>
      </div>
    </section>
  );
}
