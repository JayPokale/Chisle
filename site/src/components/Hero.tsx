"use client";

import { useState } from "react";
import { motion } from "motion/react";
import { Glyph } from "./icons";

const TAGS = [
  { icon: "persona", label: "Terse persona" },
  { icon: "compress", label: "Output compressor" },
  { icon: "diet", label: "Context diet" },
  { icon: "deps", label: "Zero dependencies" },
  { icon: "offline", label: "No network calls" },
  { icon: "open", label: "MIT licensed" },
];

const INSTALL = "npx chisle";

// Tile grid behind the copy: faint lines in three soft patches, plus a few lit
// cells. Drawn in currentColor so it follows the theme.
const CELL = 60;
const LIT: [col: number, row: number, opacity: number][] = [
  [0, 0, 0.03], [2, 1, 0.045],
  [13, 0, 0.04], [15, 0, 0.03], [12, 1, 0.045], [14, 1, 0.035],
  [4, 6, 0.03], [6, 6, 0.05], [3, 8, 0.025], [4, 9, 0.04], [6, 9, 0.05], [5, 10, 0.025],
  [22, 6, 0.03], [24, 7, 0.05], [23, 8, 0.04], [22, 9, 0.045], [27, 6, 0.025], [28, 7, 0.04],
];

function TileGrid() {
  return (
    <svg
      aria-hidden
      viewBox="0 0 1720 820"
      preserveAspectRatio="xMidYMin slice"
      className="pointer-events-none absolute left-1/2 top-0 h-full w-full max-w-[1720px] -translate-x-1/2 text-fg"
    >
      <defs>
        <pattern id="tg-lines" width={CELL} height={CELL} patternUnits="userSpaceOnUse">
          <path d={`M${CELL} 0H0V${CELL}`} fill="none" stroke="currentColor" />
        </pattern>
        <radialGradient id="tg-fade">
          <stop offset="0" stopColor="#fff" />
          <stop offset="1" stopColor="#000" />
        </radialGradient>
        <mask id="tg-mask">
          <ellipse cx="360" cy="460" rx="380" ry="260" fill="url(#tg-fade)" />
          <ellipse cx="1420" cy="440" rx="380" ry="260" fill="url(#tg-fade)" />
          <ellipse cx="860" cy="40" rx="280" ry="150" fill="url(#tg-fade)" />
        </mask>
        <filter id="tg-soft">
          <feGaussianBlur stdDeviation="4" />
        </filter>
      </defs>
      <rect width="1720" height="820" fill="url(#tg-lines)" mask="url(#tg-mask)" opacity="0.08" />
      <g fill="currentColor" filter="url(#tg-soft)">
        {LIT.map(([c, r, o]) => (
          <rect key={`${c}-${r}`} x={c * CELL + 2} y={r * CELL + 2} width={CELL - 4} height={CELL - 4} opacity={o} />
        ))}
      </g>
    </svg>
  );
}

// The install card: header row with a hint and copy button, then the command
// with its two most useful companions as comments. Copy takes the command only.
function InstallCard() {
  const [copied, setCopied] = useState(false);
  return (
    <div className="neon w-full max-w-[640px]">
      <div className="overflow-hidden rounded-[9px] bg-term text-left">
        <div className="flex items-center gap-2.5 border-b border-term-line bg-white/[0.02] px-4 py-3">
          <span aria-hidden className="grid h-5 w-5 place-items-center rounded bg-gradient-to-br from-brand to-[#ffc56b] font-mono text-[10px] font-bold text-on-brand">
            C
          </span>
          <span className="flex-1 font-mono text-sm font-medium text-term-fg">Run this. Done.</span>
          <button
            type="button"
            onClick={() => {
              navigator.clipboard.writeText(INSTALL);
              setCopied(true);
              setTimeout(() => setCopied(false), 1600);
            }}
            aria-label={copied ? "Copied" : `Copy ${INSTALL}`}
            className={`rounded p-1 transition-colors ${copied ? "text-[#86c06c]" : "text-term-dim hover:text-term-fg"}`}
          >
            <Glyph name={copied ? "check" : "copy"} size={16} />
          </button>
        </div>
        <pre className="pane-scroll overflow-x-auto px-6 py-5 font-mono text-sm leading-[1.8]">
          <code>
            <span className="text-term-accent">npx</span> <span className="text-term-fg">chisle</span>
            {"\n"}
            <span className="text-term-dim"># auto-detects all 12 agents · zero deps · zero network calls</span>
            {"\n"}
            <span className="text-term-dim"># preview: </span>
            <span className="text-term-fg/80">npx chisle</span> <span className="text-[#ffc56b]">--dry-run</span>
            <span className="text-term-dim">   undo: </span>
            <span className="text-term-fg/80">npx chisle</span> <span className="text-[#ffc56b]">--uninstall</span>
          </code>
        </pre>
      </div>
    </div>
  );
}

const ease = [0.16, 1, 0.3, 1] as const;

export default function Hero() {
  return (
    <header id="top" className="hero-wash relative overflow-hidden px-5 pt-40 pb-20 sm:pb-24">
      <TileGrid />
      <div aria-hidden className="aurora" />

      <div className="relative mx-auto flex max-w-6xl flex-col items-center gap-10 sm:gap-16">
        <div className="flex flex-col items-center gap-7 sm:gap-10">
          <motion.div
            initial={{ opacity: 0, x: -24 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.6, ease }}
            className="flex flex-col items-center gap-5 text-center"
          >
            <h1 className="text-4xl font-semibold leading-[1.08] tracking-tight sm:text-6xl lg:text-7xl">
              Cut the filler.
              <br />
              <span className="text-gradient">Keep the facts.</span>
            </h1>
            <p className="max-w-2xl text-base leading-relaxed text-fg/85 sm:text-lg">
              One command. Twelve agents. Three levers.
              <br className="hidden sm:block" />{" "}
              Answers bill 83% of a bare model, where caveman and ponytail bill 102–105%. Receipts,
              losses included, in the repo.
            </p>
          </motion.div>

          <motion.ul
            initial={{ opacity: 0, x: 24 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.6, delay: 0.1, ease }}
            className="flex max-w-4xl flex-wrap justify-center gap-2"
          >
            {TAGS.map((t) => (
              <li
                key={t.label}
                className="flex items-center gap-1.5 whitespace-nowrap rounded-full border border-fg/10 bg-fg/[0.04] px-3.5 py-1.5 text-xs text-fg/70 transition-colors hover:border-brand/40 hover:bg-accent-soft hover:text-fg"
              >
                <span className="text-accent">
                  <Glyph name={t.icon} size={12} />
                </span>
                {t.label}
              </li>
            ))}
          </motion.ul>
        </div>

        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.2, ease }}
          className="flex w-full justify-center"
        >
          <InstallCard />
        </motion.div>

        <motion.div
          initial={{ opacity: 0, scale: 0.94 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.5, delay: 0.3, ease }}
          className="flex w-full flex-col gap-3 sm:w-auto sm:flex-row sm:gap-4"
        >
          <a
            href="#get-started"
            className="rounded-md bg-brand px-7 py-3 text-center text-base font-medium text-on-brand transition-colors hover:bg-brand-hover"
          >
            Get started
          </a>
          <a
            href="https://github.com/JayPokale/Chisle"
            target="_blank"
            rel="noopener noreferrer"
            className="rounded-md border border-fg/25 px-7 py-3 text-center text-base font-medium text-fg transition-colors hover:border-fg/60 hover:bg-fg/5"
          >
            View on GitHub
          </a>
        </motion.div>
      </div>
    </header>
  );
}
