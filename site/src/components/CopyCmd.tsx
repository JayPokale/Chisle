"use client";

import { useState } from "react";

// One-click copy for a shell command. Multi-line commands keep their breaks.
export default function CopyCmd({ cmd, label }: { cmd: string; label: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      onClick={() => {
        navigator.clipboard.writeText(cmd);
        setCopied(true);
        setTimeout(() => setCopied(false), 1600);
      }}
      className="group flex w-full items-start gap-3 rounded-lg border border-line bg-surface/90 px-4 py-3 text-left font-mono text-sm backdrop-blur transition-colors hover:border-brand-hover"
      aria-label={`Copy ${label} command`}
    >
      <span className="shrink-0 select-none text-accent">$</span>
      <span className="min-w-0 flex-1 whitespace-pre-wrap break-all">{cmd}</span>
      <span className="shrink-0 rounded border border-line px-1.5 py-0.5 text-[11px] text-dim transition-colors group-hover:text-fg">
        {copied ? "copied" : "copy"}
      </span>
    </button>
  );
}
