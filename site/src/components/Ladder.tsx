"use client";

import Reveal from "./Reveal";
import SectionHead from "./SectionHead";

// The YAGNI ladder, mirroring the mermaid diagram in the README.
//
// Deliberately NOT mermaid: that package is ~83MB unpacked against a site with
// a handful of runtime dependencies, to draw boxes and arrows. Rung 1 of this
// very ladder says don't.
//
// Each rung card shows a real before/after. The `after` strings for cache and
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
  return (
    <section id="ladder" className="py-28">
      <div className="mx-auto max-w-6xl px-5">
        <SectionHead eyebrow="The efficiency ladder" title="Seven rungs, before a line gets written">
          The agent stops at the <strong className="text-fg">first</strong> rung that holds, and
          the ladder runs after reading the problem, never instead of it. Scroll the rungs →
        </SectionHead>
      </div>

      <Reveal delay={0.08}>
        <ol
          className="pane-scroll mt-12 flex snap-x snap-mandatory gap-4 overflow-x-auto px-5 pb-4 [scroll-padding-inline:1.25rem] xl:px-[calc((100vw-72rem)/2+1.25rem)] xl:[scroll-padding-inline:calc((100vw-72rem)/2+1.25rem)]"
          aria-label="Ladder rungs"
        >
          {RUNGS.map((r, i) => (
            <li
              key={r.tag}
              className="lift flex w-[85vw] max-w-[22rem] shrink-0 snap-start flex-col rounded-xl border border-line bg-surface p-5"
            >
              <div className="flex items-center justify-between">
                <span className="font-mono text-xs text-dim">rung {i + 1}/7</span>
                <span className="rounded-md bg-accent-soft px-2 py-0.5 font-mono text-[11px] text-accent">{r.tag}</span>
              </div>
              <h3 className="mt-4 text-lg font-semibold leading-snug">{r.q}</h3>
              <p className="mt-1 text-sm text-accent">→ {r.a}</p>
              <p className="mt-4 font-mono text-[10px] uppercase tracking-wider text-dim">instead of</p>
              <pre className="pane-scroll mt-1.5 overflow-x-auto rounded-lg border border-line bg-bg p-3 font-mono text-[11px] leading-relaxed text-dim line-through decoration-waste/40">
                {r.before}
              </pre>
              <p className="mt-3 font-mono text-[10px] uppercase tracking-wider text-accent">chisle</p>
              <pre className="pane-scroll mt-1.5 overflow-x-auto rounded-lg border border-brand-hover/40 bg-accent-soft p-3 font-mono text-[11px] leading-relaxed">
                {r.after}
              </pre>
              <p className="mt-4 flex-1 text-xs leading-relaxed text-dim">{r.why}</p>
            </li>
          ))}
        </ol>
      </Reveal>

      <div className="mx-auto max-w-6xl px-5">
        <p className="mt-8 max-w-2xl text-sm text-dim">
          Every rung exits the same way: ship it, then say what was skipped and when to add it,
          so &ldquo;later&rdquo; doesn&apos;t quietly become &ldquo;never&rdquo;. Lazy about the
          solution, never about the reading. Trust-boundary validation, data-loss handling,
          security and accessibility are never on the chopping block.
        </p>
      </div>
    </section>
  );
}
