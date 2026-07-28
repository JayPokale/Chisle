"use client";

import { useState } from "react";
import { motion } from "motion/react";

function CopyCmd() {
  const [copied, setCopied] = useState(false);
  return (
    <button
      onClick={() => {
        navigator.clipboard.writeText("npx chisle");
        setCopied(true);
        setTimeout(() => setCopied(false), 1600);
      }}
      className="group flex items-center gap-3 rounded-lg border border-line bg-panel px-5 py-3 font-mono text-sm transition-colors hover:border-amber"
      style={{ fontFamily: "var(--font-mono)" }}
      aria-label="Copy install command"
    >
      <span className="text-dim">$</span>
      <span>npx chisle</span>
      <span className="text-xs text-dim transition-colors group-hover:text-amber">
        {copied ? "copied" : "copy"}
      </span>
    </button>
  );
}

const rise = {
  hidden: { opacity: 0, y: 16 },
  show: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { delay: 0.08 * i, duration: 0.5, ease: [0.16, 1, 0.3, 1] as const },
  }),
};

export default function Hero() {
  return (
    <header id="top" className="px-5 pt-36 pb-20 text-center">
      <motion.p
        custom={0}
        initial="hidden"
        animate="show"
        variants={rise}
        className="mx-auto mb-5 w-fit rounded-full border border-line bg-panel px-3 py-1 text-xs text-dim"
      >
        Measured against caveman &amp; ponytail — and wins
      </motion.p>
      <motion.h1
        custom={1}
        initial="hidden"
        animate="show"
        variants={rise}
        className="mx-auto max-w-3xl text-4xl font-semibold tracking-tight sm:text-6xl"
      >
        Cut Claude Code&apos;s token bill on <span className="text-amber">three axes</span>
      </motion.h1>
      <motion.p
        custom={2}
        initial="hidden"
        animate="show"
        variants={rise}
        className="mx-auto mt-6 max-w-xl text-base leading-relaxed text-dim"
      >
        A terse dev persona, a tool-output compressor, and context-diet rules — one plugin.
        Across 20 live tasks it billed 52% of a bare model, with 1 backfire instead of 6 or 8.
      </motion.p>
      <motion.div
        custom={3}
        initial="hidden"
        animate="show"
        variants={rise}
        className="mt-9 flex flex-wrap items-center justify-center gap-3"
      >
        <CopyCmd />
        <a
          href="https://github.com/JayPokale/Chisle"
          target="_blank"
          rel="noopener noreferrer"
          className="rounded-lg px-5 py-3 text-sm text-dim transition-colors hover:text-ink"
        >
          GitHub →
        </a>
      </motion.div>
      <motion.p custom={4} initial="hidden" animate="show" variants={rise} className="mt-5 text-xs text-dim">
        or{" "}
        <code className="rounded bg-panel px-1.5 py-0.5" style={{ fontFamily: "var(--font-mono)" }}>
          claude plugin marketplace add JayPokale/Chisle
        </code>
      </motion.p>
    </header>
  );
}
