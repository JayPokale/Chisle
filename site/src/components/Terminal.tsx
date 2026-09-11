"use client";

import { useEffect, useRef, useState } from "react";
import { useInView } from "motion/react";
import Reveal from "./Reveal";

// The one dark element on the page: the product doing its job.
const HEAD = [
  "$ npm test",
  "PASS  src/auth/session.test.ts",
  "PASS  src/auth/token.test.ts",
];
const NOISE_COUNT = 412;
const SALVAGED = [
  "FAIL  src/billing/invoice.test.ts",
  "  ● rounds line items: expected 1042, received 1041",
];
const TAIL = ["Tests: 1 failed, 96 passed, 97 total"];

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
    <section className="mx-auto max-w-5xl px-5 py-24">
      <Reveal>
        <h2 className="text-2xl font-semibold tracking-tight sm:text-4xl">
          400 lines of output. Two matter.
        </h2>
        <p className="mt-3 max-w-xl text-sm text-dim">
          Tool results re-bill on every later turn. The compressor keeps the head, the tail, and
          the error lines. The rest never reaches the model.
        </p>
      </Reveal>

      <Reveal delay={0.1}>
        <div
          ref={ref}
          className="mt-10 overflow-hidden rounded-xl border border-term-line bg-term"
          style={{ fontFamily: "var(--font-mono)" }}
        >
          <div className="flex items-center border-b border-term-line px-4 py-2.5">
            <span className="text-xs text-term-dim">PostToolUse · Bash</span>
            <span className="ml-auto rounded bg-term-amber/15 px-1.5 py-0.5 text-xs text-term-amber">
              [CHISLE]{phase === "done" ? " ⇣9k tok" : ""}
            </span>
          </div>
          <div className="h-64 overflow-hidden p-4 text-xs leading-relaxed">
            {HEAD.map((l) => (
              <div key={l} className="text-term-dim">{l}</div>
            ))}
            {phase === "flood" && (
              <div className="text-term-dim/50">
                {Array.from({ length: Math.min(7, Math.ceil(flood / 60)) }).map((_, i) => (
                  <div key={i}>PASS  src/{["api", "core", "db", "ui", "jobs"][i % 5]}/spec-{i * 60}.test.ts</div>
                ))}
                <div>… {flood} lines and counting …</div>
              </div>
            )}
            {phase === "done" && (
              <>
                <div className="my-2 w-fit rounded border border-dashed border-term-amber/50 px-3 py-1.5 text-term-amber">
                  ⋯ 412 lines elided — kept head, tail, 2 error lines ⋯
                </div>
                {SALVAGED.map((l) => (
                  <div key={l} className="text-[#e5484d]">{l}</div>
                ))}
                {TAIL.map((l) => (
                  <div key={l} className="text-term-paper">{l}</div>
                ))}
                <div className="mt-2 text-[#86c06c]">✓ 34,120 chars → 612 · billed once, saved every turn after</div>
              </>
            )}
            {phase !== "done" && <span className="caret" />}
          </div>
        </div>
      </Reveal>

      <Reveal delay={0.15}>
        <p className="mt-4 text-xs text-dim">
          Deterministic: no LLM calls, no network, no dependencies. Allowlist: Bash, Agent,
          WebFetch, WebSearch, Grep, Glob, mcp__*. Never Read/Edit/Write.
        </p>
      </Reveal>
    </section>
  );
}
