"use client";

import { useEffect, useRef, useState } from "react";
import { useInView } from "motion/react";
import Reveal from "./Reveal";
import SectionHead from "./SectionHead";

// The one dark element on the page: the product doing its job. Every number
// is the real hook run on a 411-line build log: 37,745 chars in, 8,756 out,
// 312 lines elided, both mid-log warnings salvaged. A successful command on
// purpose: Claude Code sends a failed one to PostToolUseFailure, which cannot
// rewrite output, so no hook can shrink a failing test run.
const HEAD = [
  "$ npm run build",
  "• Packages in scope: @shop/api, @shop/ui, @shop/web",
  "@shop/api:build: transforming...",
];
const NOISE_COUNT = 312;
const SALVAGED = [
  "@shop/api:build: warning: src/billing/invoice.ts:41 'roundCents' is declared but never used",
  "@shop/ui:build: WARNING in asset size limit: dist/ui.js (612 KiB) exceeds the recommended limit",
];
const TAIL = [" Tasks:    3 successful, 3 total"];

export default function Terminal() {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, margin: "-120px" });
  const [phase, setPhase] = useState<"idle" | "flood" | "done">("idle");
  const [flood, setFlood] = useState(0);

  useEffect(() => {
    if (!inView) return;
    setPhase("flood");
    let n = 0;
    const t = setInterval(() => {
      n += 41;
      if (n >= NOISE_COUNT) {
        clearInterval(t);
        setFlood(NOISE_COUNT);
        setTimeout(() => setPhase("done"), 700);
      } else {
        setFlood(n);
      }
    }, 100);
    return () => clearInterval(t);
  }, [inView]);

  return (
    <section className="mx-auto max-w-6xl px-5 py-28">
      <SectionHead eyebrow="The compressor, live" title="400 lines of build output. Two matter.">
        Tool results re-bill on every later turn. The compressor keeps the head, the tail, and
        any error or warning lines from the middle. The rest never reaches the model.
      </SectionHead>

      <Reveal delay={0.1}>
        <div
          ref={ref}
          className="mt-10 overflow-hidden rounded-xl border border-term-line bg-term"
          style={{ fontFamily: "var(--font-mono)" }}
        >
          <div className="flex items-center border-b border-term-line px-4 py-2.5">
            <span className="text-xs text-term-dim">PostToolUse · Bash</span>
            <span className="ml-auto rounded bg-term-accent/15 px-1.5 py-0.5 text-xs text-term-accent">
              [CHISLE]{phase === "done" ? " ⇣7k tok" : ""}
            </span>
          </div>
          <div className="h-64 overflow-hidden p-4 text-xs leading-relaxed">
            {HEAD.map((l) => (
              <div key={l} className="text-term-dim">{l}</div>
            ))}
            {phase === "flood" && (
              <div className="text-term-dim/50">
                {Array.from({ length: Math.min(7, Math.ceil(flood / 60)) }).map((_, i) => (
                  <div key={i}>@shop/{["api", "ui", "web"][i % 3]}:build: dist/assets/chunk-{(i * 7919 + 4096).toString(16)}.js  {(i * 3.7 + 4.2).toFixed(2)} kB</div>
                ))}
                <div>… {flood} lines and counting …</div>
              </div>
            )}
            {phase === "done" && (
              <>
                <div className="my-2 w-fit rounded border border-dashed border-term-accent/50 px-3 py-1.5 text-term-accent">
                  ⋯ 312 lines elided — kept first 60, last 40, and 2 error-like lines ⋯
                </div>
                {SALVAGED.map((l) => (
                  <div key={l} className="text-[#ffc56b]">{l}</div>
                ))}
                {TAIL.map((l) => (
                  <div key={l} className="text-term-fg">{l}</div>
                ))}
                <div className="mt-2 text-[#86c06c]">✓ 37,745 chars → 8,756 · billed once, saved every turn after</div>
              </>
            )}
            {phase !== "done" && <span className="caret" />}
          </div>
        </div>
      </Reveal>

      <Reveal delay={0.15}>
        <p className="mt-4 text-xs text-dim">
          Deterministic: no LLM calls, no network, no dependencies. Allowlist: Bash, Agent,
          WebFetch, WebSearch, Grep, Glob, mcp__*. Never Read/Edit/Write. Successful calls
          only: Claude Code sends a failed command to PostToolUseFailure, which no hook can
          rewrite, and truncates that output itself.
        </p>
      </Reveal>
    </section>
  );
}
