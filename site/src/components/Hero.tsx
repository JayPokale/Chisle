"use client";

import { motion } from "motion/react";
import CopyCmd from "./CopyCmd";

const BADGES = [
  "Terse persona",
  "Output compressor",
  "Context diet",
  "11 agents",
  "Zero dependencies",
  "MIT",
];

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
    <header id="top" className="relative overflow-hidden px-5 pt-36 pb-24 text-center">
      <div aria-hidden className="grid-bg pointer-events-none absolute inset-0" />
      <div aria-hidden className="glow pointer-events-none absolute inset-0" />

      <div className="relative">
        <motion.a
          href="#numbers"
          custom={0}
          initial="hidden"
          animate="show"
          variants={rise}
          className="mx-auto mb-7 flex w-fit items-center gap-2 rounded-full border border-line bg-surface/80 py-1 pl-1 pr-3 text-xs text-dim backdrop-blur transition-colors hover:border-brand-hover hover:text-fg"
        >
          <span className="rounded-full bg-accent-soft px-2 py-0.5 font-medium text-accent">measured</span>
          20 live tasks · receipts in the repo · failures published too →
        </motion.a>

        <motion.h1
          custom={1}
          initial="hidden"
          animate="show"
          variants={rise}
          className="mx-auto max-w-4xl text-4xl font-bold leading-[1.05] tracking-tight sm:text-7xl"
        >
          Your agent writes <span className="text-gradient">less than half</span> as much.
          <br className="hidden sm:block" /> Same answers.
        </motion.h1>

        <motion.p
          custom={2}
          initial="hidden"
          animate="show"
          variants={rise}
          className="mx-auto mt-6 max-w-2xl text-base leading-relaxed text-dim sm:text-lg"
        >
          On coding work it bills <strong className="text-fg">44%</strong> of a bare model, and{" "}
          <strong className="text-fg">41%</strong> on the long coding tasks where the bill actually
          hurts. Every figure here is recomputed from transcripts committed to the repo, including
          the task it loses.
        </motion.p>

        <motion.ul
          custom={3}
          initial="hidden"
          animate="show"
          variants={rise}
          className="mx-auto mt-8 flex max-w-2xl flex-wrap justify-center gap-2"
        >
          {BADGES.map((b) => (
            <li
              key={b}
              className="flex items-center gap-1.5 rounded-md border border-line bg-surface/70 px-2.5 py-1 text-xs text-dim backdrop-blur"
            >
              <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-accent" />
              {b}
            </li>
          ))}
        </motion.ul>

        <motion.div
          custom={4}
          initial="hidden"
          animate="show"
          variants={rise}
          className="mx-auto mt-10 max-w-md"
        >
          <CopyCmd cmd="npx chisle" label="npx install" />
        </motion.div>

        <motion.div
          custom={5}
          initial="hidden"
          animate="show"
          variants={rise}
          className="mt-6 flex flex-wrap items-center justify-center gap-3"
        >
          <a
            href="#get-started"
            className="rounded-md bg-brand px-5 py-2.5 text-sm font-medium text-white shadow-[0_0_30px_-6px_#631bff] transition-colors hover:bg-brand-hover"
          >
            Get started
          </a>
          <a
            href="https://github.com/JayPokale/Chisle"
            target="_blank"
            rel="noopener noreferrer"
            className="rounded-md border border-line bg-surface/60 px-5 py-2.5 text-sm font-medium text-fg backdrop-blur transition-colors hover:border-brand-hover"
          >
            View on GitHub
          </a>
        </motion.div>

        <motion.p custom={6} initial="hidden" animate="show" variants={rise} className="mt-6 text-xs text-dim">
          Zero network calls · zero LLM calls ·{" "}
          <code className="rounded border border-line bg-surface px-1.5 py-0.5 font-mono">
            npx chisle --uninstall
          </code>{" "}
          puts everything back
        </motion.p>
      </div>
    </header>
  );
}
