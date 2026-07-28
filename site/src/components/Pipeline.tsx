"use client";

import { useState } from "react";
import Reveal from "./Reveal";

// Where each axis attaches to a session — the SVG twin of the README mermaid
// diagram. Inline SVG rather than a diagram library: see the note in Ladder.tsx.
//
// The point of the picture is the loop. Tool output is re-billed on every later
// request in the session, so compressing it once pays repeatedly — and Read/Edit
// sit deliberately outside it, because their exact bytes feed later edits.
const HOOKS = [
  { id: "session", label: "SessionStart", body: "Injects the ruleset once, on a genuinely new session. Resume, clear and compact get a 27-token reactivation line instead — re-sending the full ~1.6k every time was most of the plugin's own overhead." },
  { id: "prompt", label: "UserPromptSubmit", body: "A ~50-token reminder each turn, so the mode survives context compression. Cheap enough that it is not worth optimising, and it is what lets SessionStart stay quiet on resume." },
  { id: "post", label: "PostToolUse", body: "Scrub, elide, dedup — deterministic, no LLM, no network. Rebuilds the result into the tool's own response shape, because a bare string gets rejected by the harness. Read and Edit are never touched." },
] as const;

export default function Pipeline() {
  const [hook, setHook] = useState<string | null>(null);
  const dim = (id: string) => (hook && hook !== id ? 0.28 : 1);

  return (
    <section className="border-y border-line bg-panel/60 py-24">
      <div className="mx-auto max-w-5xl px-5">
        <Reveal>
          <h2 className="text-2xl font-semibold tracking-tight sm:text-4xl">
            Three hooks, one session
          </h2>
          <p className="mt-3 max-w-xl text-sm text-dim">
            Two hooks shape what the model writes. The third shrinks what it reads — and that one
            is a loop.
          </p>
        </Reveal>

        <Reveal delay={0.08}>
          <div className="mt-10 flex justify-center overflow-x-auto">
            <svg
              viewBox="0 0 860 330"
              className="min-w-[680px] max-w-[860px] w-full"
              role="img"
              aria-label="Session diagram. SessionStart injects about 1.6k tokens on new sessions only. UserPromptSubmit adds a 50-token reminder each turn. Both feed the model, which either writes output or calls a tool. Tool output returns through the PostToolUse hook, which scrubs, elides and dedups it before the model reads it. Read and Edit results bypass the hook untouched."
            >
              <defs>
                <marker id="ar" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
                  <path d="M 0 0 L 10 5 L 0 10 z" fill="var(--color-dim)" />
                </marker>
                <marker id="ar-amber" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
                  <path d="M 0 0 L 10 5 L 0 10 z" fill="var(--color-amber)" />
                </marker>
              </defs>

              {/* inputs */}
              <g fontSize="11">
                <g
                  opacity={dim("session")}
                  onMouseEnter={() => setHook("session")}
                  onMouseLeave={() => setHook(null)}
                  style={{ cursor: "pointer", transition: "opacity 0.2s" }}
                >
                <rect x="8" y="34" width="188" height="52" rx="6" fill="var(--color-amber-soft)" stroke="var(--color-line)" />
                <text x="102" y="55" textAnchor="middle" fontWeight="600" fill="currentColor">SessionStart</text>
                <text x="102" y="72" textAnchor="middle" fill="var(--color-dim)">~1.6k tok · new sessions only</text>
                </g>
                <g
                  opacity={dim("prompt")}
                  onMouseEnter={() => setHook("prompt")}
                  onMouseLeave={() => setHook(null)}
                  style={{ cursor: "pointer", transition: "opacity 0.2s" }}
                >

                <rect x="8" y="106" width="188" height="52" rx="6" fill="var(--color-amber-soft)" stroke="var(--color-line)" />
                <text x="102" y="127" textAnchor="middle" fontWeight="600" fill="currentColor">UserPromptSubmit</text>
                <text x="102" y="144" textAnchor="middle" fill="var(--color-dim)">~50 tok · every turn</text>
                </g>
              </g>

              {/* model */}
              <rect x="286" y="58" width="132" height="76" rx="38" fill="var(--color-panel)" stroke="var(--color-amber)" strokeWidth="1.5" />
              <text x="352" y="102" textAnchor="middle" fontSize="15" fontWeight="700" fill="currentColor">model</text>

              <path d="M 196 60 L 282 88" stroke="var(--color-dim)" fill="none" markerEnd="url(#ar)" />
              <path d="M 196 132 L 282 106" stroke="var(--color-dim)" fill="none" markerEnd="url(#ar)" />

              {/* output */}
              <rect x="508" y="46" width="200" height="60" rx="6" fill="var(--color-panel)" stroke="var(--color-amber)" />
              <text x="608" y="70" textAnchor="middle" fontSize="12" fontWeight="600" fill="currentColor">terser prose</text>
              <text x="608" y="88" textAnchor="middle" fontSize="12" fontWeight="600" fill="currentColor">YAGNI-first code</text>
              <path d="M 418 82 L 504 76" stroke="var(--color-amber)" fill="none" markerEnd="url(#ar-amber)" />
              <text x="461" y="66" textAnchor="middle" fontSize="10" fill="var(--color-dim)">writes</text>

              {/* tool loop */}
              <rect x="508" y="150" width="200" height="46" rx="6" fill="var(--color-panel)" stroke="var(--color-line)" />
              <text x="608" y="178" textAnchor="middle" fontSize="11.5" fill="currentColor">Bash · Grep · WebFetch · mcp__*</text>
              <path d="M 400 134 L 504 166" stroke="var(--color-dim)" fill="none" markerEnd="url(#ar)" />
              <text x="446" y="163" textAnchor="middle" fontSize="10" fill="var(--color-dim)">calls</text>

              <g
                opacity={dim("post")}
                onMouseEnter={() => setHook("post")}
                onMouseLeave={() => setHook(null)}
                style={{ cursor: "pointer", transition: "opacity 0.2s" }}
              >
              <rect x="508" y="222" width="200" height="58" rx="6" fill="var(--color-amber-soft)" stroke="var(--color-amber)" strokeWidth="1.5" />
              <text x="608" y="244" textAnchor="middle" fontSize="12" fontWeight="700" fill="currentColor">PostToolUse</text>
              <text x="608" y="262" textAnchor="middle" fontSize="11" fill="var(--color-dim)">scrub → elide → dedup</text>
              <path d="M 608 196 L 608 218" stroke="var(--color-dim)" fill="none" markerEnd="url(#ar)" />
              </g>

              {/* the loop back */}
              <path d="M 508 251 L 352 251 L 352 138" stroke="var(--color-amber)" fill="none" strokeWidth="1.5" markerEnd="url(#ar-amber)" />
              <text x="430" y="243" textAnchor="middle" fontSize="10" fill="var(--color-amber)">compressed, in the tool&apos;s own shape</text>

              {/* excluded */}
              <rect x="8" y="222" width="188" height="58" rx="6" fill="none" stroke="var(--color-line)" strokeDasharray="4 3" />
              <text x="102" y="244" textAnchor="middle" fontSize="12" fontWeight="600" fill="currentColor">Read · Edit</text>
              <text x="102" y="262" textAnchor="middle" fontSize="10.5" fill="var(--color-dim)">never touched</text>
              <path d="M 196 244 L 330 138" stroke="var(--color-line)" fill="none" strokeDasharray="4 3" markerEnd="url(#ar)" />
            </svg>
          </div>
        </Reveal>

        <div className="mx-auto mt-6 flex max-w-3xl flex-wrap justify-center gap-2">
          {HOOKS.map((h) => (
            <button
              key={h.id}
              onMouseEnter={() => setHook(h.id)}
              onMouseLeave={() => setHook(null)}
              onClick={() => setHook(hook === h.id ? null : h.id)}
              aria-pressed={hook === h.id}
              className={`rounded border px-3 py-1 font-mono text-[11px] transition-colors ${
                hook === h.id
                  ? "border-amber bg-amber-soft text-amber"
                  : "border-line text-dim hover:border-amber/50 hover:text-ink"
              }`}
            >
              {h.label}
            </button>
          ))}
        </div>

        <p className="mx-auto mt-3 min-h-[3.5rem] max-w-2xl text-center text-xs leading-relaxed text-dim">
          {hook
            ? HOOKS.find((h) => h.id === hook)!.body
            : "Hover a hook to see what it does."}
        </p>

        <Reveal delay={0.12}>
          <p className="mx-auto mt-8 max-w-2xl text-xs text-dim">
            Tool output is billed again on <em>every</em> later request in the session, so shrinking
            it once pays repeatedly. The compressor rebuilds its result into the tool&apos;s own
            response shape — returning a bare string gets the replacement rejected, which is exactly
            the bug that made this axis a no-op before v2.0.0.
          </p>
        </Reveal>
      </div>
    </section>
  );
}
