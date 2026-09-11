"use client";

import { useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import Reveal from "./Reveal";

// The YAGNI ladder, mirroring the mermaid diagram in the README.
//
// Deliberately NOT mermaid: that package is ~83MB unpacked against a site with
// a handful of runtime dependencies, to draw boxes and arrows. Rung 1 of this
// very ladder says don't.
//
// Each rung expands to a real before/after. The `after` strings for cache and
// debounce are the committed benchmark answers; the rest are drawn from the
// skill's own worked examples. Nothing here is invented for the page.
const RUNGS = [
  {
    tag: "YAGNI",
    q: "Does this need to exist at all?",
    a: "Skip it. Say so in one line.",
    before: "class ApiCacheManager:\n    def __init__(self, ttl=300, max_size=1000,\n                 eviction='lru', enable_stats=True):\n        ...",
    after: "No cache until the profiler says so.\nWhen it does: @lru_cache.",
    why: "Speculative need is still no need. The one line that says you skipped it is the whole deliverable.",
  },
  {
    tag: "reuse",
    q: "Already in this codebase?",
    a: "Reuse it. Don't rewrite.",
    before: "// new file: useDebounce.ts\nexport function useDebounce<T>(value: T, delay: number): T {\n  ...\n}",
    after: "useEffect(() => {\n  const t = setTimeout(fetchResults, 300);\n  return () => clearTimeout(t);\n}, [query]);",
    why: "Re-implementing what is already nearby is the most common slop. Look before writing.",
  },
  {
    tag: "stdlib",
    q: "Stdlib does it?",
    a: "Use the stdlib.",
    before: "def memoize(fn):\n    cache = {}\n    def wrapper(*args):\n        ...",
    after: "from functools import lru_cache\n\n@lru_cache(maxsize=1000)",
    why: "Hand-rolled caches, debounces and retry loops are the classic reinvention. The stdlib version is already tested.",
  },
  {
    tag: "native",
    q: "Native platform feature covers it?",
    a: "CSS over JS. DB constraint over app code.",
    before: '<DatePicker onChange={...} locale={...} />\n// + 40kB of picker library',
    after: '<input type="date">',
    why: "The platform ships more than people remember. A DB constraint outlives every validator you write above it.",
  },
  {
    tag: "dep",
    q: "Already-installed dependency?",
    a: "Use it. Never add one for a few lines.",
    before: "npm i lodash.debounce  # for one call site",
    after: "// lodash is already a dependency\nimport debounce from 'lodash/debounce';",
    why: "Using what is installed is free. Adding a dependency for a few lines is a permanent cost for a temporary convenience.",
  },
  {
    tag: "one line",
    q: "Can it be one line?",
    a: "One line.",
    before: "let out = [];\nfor (const x of xs) {\n  if (x.active) out.push(x.id);\n}",
    after: "const out = xs.filter(x => x.active).map(x => x.id);",
    why: "Boring over clever, though. Deletion beats addition; obfuscation is not deletion.",
  },
  {
    tag: "minimum",
    q: "Only then",
    a: "The minimum code that works.",
    before: "// interface + factory + registry, one implementation",
    after: "// the one function, plus a note:\n// chisle: single impl; add the interface at the second one",
    why: "You still write it, just the smallest version that holds, with the shortcut marked so it can be found later.",
  },
];

export default function Ladder() {
  const [open, setOpen] = useState<number | null>(0);

  return (
    <section id="ladder" className="py-24">
      <div className="mx-auto max-w-5xl px-5">
        <Reveal>
          <h2 className="text-2xl font-semibold tracking-tight sm:text-4xl">
            The ladder, before a line gets written
          </h2>
          <p className="mt-3 max-w-xl text-sm text-dim">
            The agent stops at the <strong className="text-ink">first</strong> rung that holds, and
            the ladder runs after reading the problem, never instead of it.{" "}
            <span className="text-amber">Open a rung</span> to see it applied.
          </p>
        </Reveal>

        <ol className="mt-10 space-y-px">
          {RUNGS.map((r, i) => {
            const isOpen = open === i;
            return (
              <Reveal key={r.tag} delay={0.03 * i}>
                <li className="border-l-2 border-line bg-panel/40 transition-colors data-[open=true]:border-amber" data-open={isOpen}>
                  <button
                    onClick={() => setOpen(isOpen ? null : i)}
                    aria-expanded={isOpen}
                    className="group flex w-full flex-col gap-1 py-4 pl-6 pr-4 text-left sm:flex-row sm:items-center sm:gap-6"
                  >
                    <span className="w-8 shrink-0 font-mono text-xs text-dim">{i + 1}</span>
                    <span className="flex-1 text-sm font-medium">{r.q}</span>
                    <span className="flex-1 text-sm text-dim">→ {r.a}</span>
                    <span
                      className={`shrink-0 rounded px-2 py-0.5 font-mono text-[11px] transition-colors ${
                        isOpen ? "bg-amber text-paper" : "bg-amber-soft text-amber"
                      }`}
                    >
                      {r.tag}
                    </span>
                    <span
                      aria-hidden
                      className={`shrink-0 font-mono text-xs text-dim transition-transform ${isOpen ? "rotate-90 text-amber" : "group-hover:text-amber"}`}
                    >
                      ›
                    </span>
                  </button>

                  <AnimatePresence initial={false}>
                    {isOpen && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: "auto", opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.22, ease: "easeOut" }}
                        className="overflow-hidden"
                      >
                        <div className="grid gap-3 px-6 pb-5 pt-1 sm:grid-cols-2 sm:pl-14">
                          <div>
                            <p className="mb-1.5 font-mono text-[10px] uppercase tracking-wide text-dim">
                              instead of
                            </p>
                            <pre className="pane-scroll overflow-x-auto rounded border border-line bg-paper/70 p-2.5 font-mono text-[11px] leading-relaxed text-dim">
                              {r.before}
                            </pre>
                          </div>
                          <div>
                            <p className="mb-1.5 font-mono text-[10px] uppercase tracking-wide text-amber">
                              chisle
                            </p>
                            <pre className="pane-scroll overflow-x-auto rounded border border-amber/40 bg-amber-soft/40 p-2.5 font-mono text-[11px] leading-relaxed">
                              {r.after}
                            </pre>
                          </div>
                          <p className="text-xs text-dim sm:col-span-2">{r.why}</p>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </li>
              </Reveal>
            );
          })}
        </ol>

        <Reveal delay={0.1}>
          <p className="mt-8 max-w-xl text-xs text-dim">
            Every rung exits the same way: ship it, then say what was skipped and when to add it,
            so &ldquo;later&rdquo; doesn&apos;t quietly become &ldquo;never&rdquo;. Lazy about the
            solution, never about the reading. Trust-boundary validation, data-loss handling,
            security and accessibility are never on the chopping block.
          </p>
        </Reveal>
      </div>
    </section>
  );
}
