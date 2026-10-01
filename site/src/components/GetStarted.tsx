"use client";

import { useState } from "react";
import Reveal from "./Reveal";
import CopyCmd from "./CopyCmd";

// Every install path the project documents. Kept in sync with the README's
// Install section. If a command changes there, it changes here.
const INSTALLS = [
  { id: "npx", label: "npx", cmd: "npx chisle", note: "Auto-detects all 11 agents." },
  {
    id: "plugin",
    label: "Claude Code",
    cmd: "claude plugin marketplace add JayPokale/Chisle\nclaude plugin install chisle@chisle",
    note: "Marketplace plugin.",
  },
  {
    id: "curl",
    label: "curl",
    cmd: "curl -fsSL https://raw.githubusercontent.com/JayPokale/Chisle/main/install.sh | bash",
    note: "macOS · Linux.",
  },
  {
    id: "powershell",
    label: "PowerShell",
    cmd: "irm https://raw.githubusercontent.com/JayPokale/Chisle/main/install.ps1 | iex",
    note: "Windows.",
  },
  {
    id: "dry-run",
    label: "dry run",
    cmd: "npx chisle --dry-run",
    note: "Prints every file it would touch, changes nothing.",
  },
];

function Step({ n, title, children }: { n: number; title: string; children: React.ReactNode }) {
  return (
    <li className="relative grid gap-4 pb-12 pl-14 last:pb-0">
      <span
        aria-hidden
        className="absolute left-0 top-0 grid h-9 w-9 place-items-center rounded-full border border-brand-hover/60 bg-accent-soft font-mono text-sm font-semibold text-accent"
      >
        {n}
      </span>
      <h3 className="pt-1 text-lg font-semibold tracking-tight">{title}</h3>
      {children}
    </li>
  );
}

export default function GetStarted() {
  const [active, setActive] = useState(INSTALLS[0].id);
  const current = INSTALLS.find((i) => i.id === active)!;

  return (
    <section id="get-started" className="mx-auto max-w-6xl px-5 py-28">
      <div className="grid gap-14 lg:grid-cols-[1fr_1.4fr]">
        <Reveal>
          <p className="text-sm font-medium text-accent">Get started</p>
          <h2 className="mt-3 text-3xl font-bold tracking-tight sm:text-5xl">
            Cut the bill in under a minute
          </h2>
          <p className="mt-4 max-w-md text-dim">
            One command installs the persona, the compressor hook and the context-diet rules
            into every agent it finds. Nothing to configure, nothing to call home.
          </p>
          <a
            href="https://github.com/JayPokale/Chisle/blob/main/INSTALL.md"
            target="_blank"
            rel="noopener noreferrer"
            className="mt-6 inline-block text-sm font-medium text-accent hover:underline underline-offset-4"
          >
            Full install guide →
          </a>
        </Reveal>

        <Reveal delay={0.08}>
          <ol className="relative before:absolute before:left-[17px] before:top-10 before:bottom-10 before:w-px before:bg-line">
            <Step n={1} title="Install">
              <div className="flex flex-wrap gap-1 rounded-lg border border-line bg-surface p-1 w-fit" role="tablist" aria-label="Installation method">
                {INSTALLS.map((i) => (
                  <button
                    key={i.id}
                    role="tab"
                    aria-selected={i.id === active}
                    onClick={() => setActive(i.id)}
                    className={`rounded-md px-3 py-1 text-xs font-medium transition-colors ${
                      i.id === active ? "bg-raised text-fg shadow-sm" : "text-dim hover:text-fg"
                    }`}
                  >
                    {i.label}
                  </button>
                ))}
              </div>
              <CopyCmd cmd={current.cmd} label={current.label} />
              <p className="-mt-2 text-xs text-dim">{current.note}</p>
            </Step>

            <Step n={2} title="Open your agent as usual">
              <p className="text-sm leading-relaxed text-dim">
                The ruleset loads once on a new session (~900 tokens), then a ~50-token reminder
                per turn keeps it alive through compaction. Tool output gets compressed before the
                model reads it, and the statusline shows what was actually elided.
              </p>
              <div className="w-fit rounded-md border border-line bg-surface px-3 py-1.5 font-mono text-xs">
                <span className="text-accent">[CHISLE]</span> <span className="text-dim">⇣9k tok</span>
              </div>
            </Step>

            <Step n={3} title="Update, or switch it off">
              <div className="grid gap-2 font-mono text-xs">
                {[
                  ["update", "npx chisle@latest --update"],
                  ["persona off", '"stop chisle"'],
                  ["remove all", "npx chisle --uninstall"],
                ].map(([k, v]) => (
                  <div key={k} className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 rounded-md border border-line bg-surface px-3 py-2">
                    <p className="text-[10px] uppercase tracking-wider text-dim">{k}</p>
                    <p>{v}</p>
                  </div>
                ))}
              </div>
              <p className="text-xs text-dim">
                Plain <code className="font-mono">npx chisle</code> skips what is already installed,
                so updates need <code className="font-mono">@latest --update</code>.
              </p>
            </Step>
          </ol>
        </Reveal>
      </div>
    </section>
  );
}
