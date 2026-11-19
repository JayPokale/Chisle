"use client";

import { useRef } from "react";
import { motion, useInView } from "motion/react";
import Reveal from "./Reveal";
import SectionHead from "./SectionHead";

// Command-aware filters (hooks/chisle-command-filters.js) on real output, Chisle
// 3.14: raw chars → what the model reads, from benchmarks/replay-commands.js. The
// failing run goes through chisle-run.js, as on Claude Code in bypass mode.
// Same numbers as the README's filters card (scripts/build-readme-art.js).
const ROWS = [
  { cmd: "npm test", raw: 19374, kept: 445, note: "256 passing tests hidden, summary kept" },
  { cmd: "npm test  # 1 failing", raw: 16107, kept: 309, note: "400 passes hidden, the failure kept whole" },
  { cmd: "git status", raw: 485, kept: 92, note: "long form rewritten in git's short form" },
  { cmd: "git log -n 15", raw: 6561, kept: 3784, note: "one line per commit, long messages counted" },
];

const fmt = (n: number) => n.toLocaleString("en-US");

export default function Filters() {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, margin: "-100px" });

  return (
    <section className="mx-auto max-w-6xl px-5 pb-28">
      <SectionHead eyebrow="Command-aware filters" title="Knows the command. Drops the noise.">
        RTK-style filtering, built into the same hook: no extra binary, any OS. It knows git,
        test runners and package managers, and drops hints, passing tests and download progress
        at any size. Errors, failures and summaries always stay.
      </SectionHead>

      <div ref={ref} className="mt-10 space-y-6 rounded-xl border border-line bg-surface p-6 sm:p-8">
        {ROWS.map((r, i) => {
          const pct = Math.max(0.6, (r.kept / r.raw) * 100);
          return (
            <div key={r.cmd} className="grid gap-2 sm:grid-cols-[15rem_1fr_4rem] sm:items-center sm:gap-5">
              <div>
                <p className="font-mono text-sm text-accent">$ {r.cmd}</p>
                <p className="mt-0.5 text-xs text-dim">{r.note}</p>
              </div>
              <div>
                <div className="h-4 overflow-hidden rounded-md bg-raised">
                  <motion.div
                    initial={{ width: "100%" }}
                    animate={inView ? { width: `${pct}%` } : {}}
                    transition={{ duration: 1, delay: 0.2 + i * 0.12, ease: [0.16, 1, 0.3, 1] }}
                    className="h-full rounded-md bg-gradient-to-r from-brand to-[#ffc56b]"
                  />
                </div>
                <p className="mt-1 font-mono text-[11px] text-dim">
                  {fmt(r.raw)} → {fmt(r.kept)} chars
                </p>
              </div>
              <p className="text-lg font-bold text-accent sm:text-right">
                −{Math.round(100 * (1 - r.kept / r.raw))}%
              </p>
            </div>
          );
        })}
      </div>

      <Reveal delay={0.1}>
        <p className="mt-4 text-xs text-dim">
          Across 37 commands Claude reads 28% of the raw output with Chisle and 84% with RTK.
          Failed test and build runs are filtered too when Claude Code runs in bypass-permissions
          mode. Output piped into anything but head/tail is left alone, so <code>| cat</code> shows
          it raw; commands already run through rtk are skipped. <code>CHISLE_COMPRESS_FILTERS=0</code>{" "}
          turns it off.
        </p>
      </Reveal>
    </section>
  );
}
