"use client";

import { useState } from "react";

// Each figure carries where it comes from. The point of the site is that the
// numbers survive being checked, so the source is one hover away, not buried.
const STATS = [
  { v: "52%", k: "of a bare model's 20-task bill", src: "20 live tasks, two suites, billed output tokens, from benchmarks/results/" },
  { v: "44%", k: "on coding prompts, 45% on long answers", src: "same cells, split by prompt kind (n=12) and by median answer size" },
  { v: "1/20", k: "backfires, where rivals hit 6 and 8", src: "a backfire is a task costing MORE than no tool at all; ours was root-caused and fixed" },
  { v: "0", k: "dependencies, network calls, LLM calls", src: "the plugin itself; the marketing site you are reading has its own" },
];

export default function Stats() {
  const [open, setOpen] = useState<string | null>(null);
  return (
    <section className="border-y border-line bg-panel/60">
      <div className="mx-auto grid max-w-5xl grid-cols-2 divide-line px-5 sm:grid-cols-4 sm:divide-x">
        {STATS.map((s) => (
          <button
            key={s.k}
            onMouseEnter={() => setOpen(s.k)}
            onMouseLeave={() => setOpen(null)}
            onClick={() => setOpen(open === s.k ? null : s.k)}
            className="lift group border border-transparent px-4 py-8 text-center hover:bg-amber-soft/30"
          >
            <p className="text-2xl font-semibold text-amber">{s.v}</p>
            <p className="mt-1.5 text-xs leading-snug text-dim">{s.k}</p>
            <p
              className={`mt-2 text-[10.5px] leading-snug text-dim transition-opacity ${
                open === s.k ? "opacity-100" : "opacity-0"
              }`}
            >
              {s.src}
            </p>
          </button>
        ))}
      </div>
    </section>
  );
}
