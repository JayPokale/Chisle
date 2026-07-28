"use client";

import { useState } from "react";
import Reveal from "./Reveal";

// Where each axis attaches to a session — the SVG twin of the README mermaid
// diagram. Inline SVG rather than a diagram library: see the note in Ladder.tsx.
//
// The point of the picture is the loop. Tool output is re-billed on every later
// request in the session, so compressing it once pays repeatedly — and Read/Edit
// sit deliberately outside it, because their exact bytes feed later edits.
//
// viewBox is cropped to the drawn content (x 8→708, y 34→280). The earlier
// 860-wide box left ~150px of dead space on the right, which read as the whole
// diagram being off-centre.

const HOOKS = [
  {
    id: "session",
    label: "SessionStart",
    body: "Injects the ruleset once, on a genuinely new session. Resume, clear and compact get a 27-token reactivation line instead — re-sending the full ~1.6k every time was most of the plugin's own overhead.",
  },
  {
    id: "prompt",
    label: "UserPromptSubmit",
    body: "A ~50-token reminder each turn, so the mode survives context compression. Cheap enough not to be worth optimising, and it is what lets SessionStart stay quiet on resume.",
  },
  {
    id: "post",
    label: "PostToolUse",
    body: "Scrub, elide, dedup — deterministic, no LLM, no network. Rebuilds the result into the tool's own response shape, because a bare string gets rejected by the harness. Read and Edit are never touched.",
  },
] as const;

type HookId = (typeof HOOKS)[number]["id"];

export default function Pipeline() {
  const [hook, setHook] = useState<HookId | null>(null);

  // Hovering lifts the element itself rather than dimming its neighbours:
  // a thicker amber stroke and a soft ring, so attention is added, not removed.
  const box = (id: HookId) => ({
    onMouseEnter: () => setHook(id),
    onMouseLeave: () => setHook(null),
    style: { cursor: "pointer" as const },
  });
  const on = (id: HookId) => hook === id;

  return (
    <section className="border-y border-line bg-panel/60 py-24">
      <div className="mx-auto max-w-5xl px-5">
        <Reveal>
          <h2 className="text-center text-2xl font-semibold tracking-tight sm:text-4xl">
            Three hooks, one session
          </h2>
          <p className="mx-auto mt-3 max-w-xl text-center text-sm text-dim">
            Two hooks shape what the model writes. The third shrinks what it reads — and that one
            is a loop.
          </p>
        </Reveal>

        <Reveal delay={0.08}>
          <div className="mt-10 overflow-x-auto">
            <svg
              viewBox="0 20 716 274"
              className="mx-auto block w-full min-w-[620px] max-w-[760px]"
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
                <style>{`
                  .hook rect { transition: stroke 0.2s, stroke-width 0.2s; }
                  .ring { transition: opacity 0.25s, transform 0.25s; transform-box: fill-box; transform-origin: center; }
                `}</style>
              </defs>

              {/* SessionStart */}
              <g className="hook" {...box("session")}>
                <rect
                  className="ring"
                  x="4" y="30" width="196" height="60" rx="9"
                  fill="none" stroke="var(--color-amber)"
                  opacity={on("session") ? 0.35 : 0}
                  transform={on("session") ? "scale(1.04)" : "scale(0.98)"}
                />
                <rect x="8" y="34" width="188" height="52" rx="6" fill="var(--color-amber-soft)"
                  stroke={on("session") ? "var(--color-amber)" : "var(--color-line)"}
                  strokeWidth={on("session") ? 1.8 : 1} />
                <text x="102" y="55" textAnchor="middle" fontSize="11" fontWeight="600" fill="currentColor">SessionStart</text>
                <text x="102" y="72" textAnchor="middle" fontSize="11" fill="var(--color-dim)">~1.6k tok · new sessions only</text>
              </g>

              {/* UserPromptSubmit */}
              <g className="hook" {...box("prompt")}>
                <rect
                  className="ring"
                  x="4" y="102" width="196" height="60" rx="9"
                  fill="none" stroke="var(--color-amber)"
                  opacity={on("prompt") ? 0.35 : 0}
                  transform={on("prompt") ? "scale(1.04)" : "scale(0.98)"}
                />
                <rect x="8" y="106" width="188" height="52" rx="6" fill="var(--color-amber-soft)"
                  stroke={on("prompt") ? "var(--color-amber)" : "var(--color-line)"}
                  strokeWidth={on("prompt") ? 1.8 : 1} />
                <text x="102" y="127" textAnchor="middle" fontSize="11" fontWeight="600" fill="currentColor">UserPromptSubmit</text>
                <text x="102" y="144" textAnchor="middle" fontSize="11" fill="var(--color-dim)">~50 tok · every turn</text>
              </g>

              {/* model */}
              <rect x="286" y="58" width="132" height="76" rx="38" fill="var(--color-panel)" stroke="var(--color-amber)" strokeWidth="1.5" />
              <text x="352" y="102" textAnchor="middle" fontSize="15" fontWeight="700" fill="currentColor">model</text>

              <path d="M 196 60 L 282 88" stroke={on("session") ? "var(--color-amber)" : "var(--color-dim)"} fill="none" markerEnd={on("session") ? "url(#ar-amber)" : "url(#ar)"} />
              <path d="M 196 132 L 282 106" stroke={on("prompt") ? "var(--color-amber)" : "var(--color-dim)"} fill="none" markerEnd={on("prompt") ? "url(#ar-amber)" : "url(#ar)"} />

              {/* output */}
              <rect x="508" y="46" width="200" height="60" rx="6" fill="var(--color-panel)" stroke="var(--color-amber)" />
              <text x="608" y="70" textAnchor="middle" fontSize="12" fontWeight="600" fill="currentColor">terser prose</text>
              <text x="608" y="88" textAnchor="middle" fontSize="12" fontWeight="600" fill="currentColor">YAGNI-first code</text>
              <path d="M 418 82 L 504 76" stroke="var(--color-amber)" fill="none" markerEnd="url(#ar-amber)" />
              <text x="461" y="66" textAnchor="middle" fontSize="10" fill="var(--color-dim)">writes</text>

              {/* tool call */}
              <rect x="508" y="150" width="200" height="46" rx="6" fill="var(--color-panel)" stroke="var(--color-line)" />
              <text x="608" y="178" textAnchor="middle" fontSize="11.5" fill="currentColor">Bash · Grep · WebFetch · mcp__*</text>
              <path d="M 400 134 L 504 166" stroke="var(--color-dim)" fill="none" markerEnd="url(#ar)" />
              <text x="446" y="163" textAnchor="middle" fontSize="10" fill="var(--color-dim)">calls</text>

              {/* PostToolUse */}
              <g className="hook" {...box("post")}>
                <rect
                  className="ring"
                  x="504" y="218" width="208" height="66" rx="9"
                  fill="none" stroke="var(--color-amber)"
                  opacity={on("post") ? 0.35 : 0}
                  transform={on("post") ? "scale(1.03)" : "scale(0.98)"}
                />
                <rect x="508" y="222" width="200" height="58" rx="6" fill="var(--color-amber-soft)"
                  stroke="var(--color-amber)" strokeWidth={on("post") ? 2.4 : 1.5} />
                <text x="608" y="244" textAnchor="middle" fontSize="12" fontWeight="700" fill="currentColor">PostToolUse</text>
                <text x="608" y="262" textAnchor="middle" fontSize="11" fill="var(--color-dim)">scrub → elide → dedup</text>
              </g>
              <path d="M 608 196 L 608 218" stroke="var(--color-dim)" fill="none" markerEnd="url(#ar)" />

              {/* the loop back — the whole point of the picture */}
              <path
                d="M 508 251 L 352 251 L 352 138"
                stroke="var(--color-amber)" fill="none"
                strokeWidth={on("post") ? 2.4 : 1.5}
                markerEnd="url(#ar-amber)"
                strokeDasharray={on("post") ? "6 4" : undefined}
              >
                {on("post") && (
                  <animate attributeName="stroke-dashoffset" from="20" to="0" dur="0.8s" repeatCount="indefinite" />
                )}
              </path>
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
              onFocus={() => setHook(h.id)}
              onBlur={() => setHook(null)}
              aria-pressed={hook === h.id}
              className={`rounded border px-3 py-1 font-mono text-[11px] transition-all ${
                hook === h.id
                  ? "-translate-y-0.5 border-amber bg-amber-soft text-amber shadow-sm"
                  : "border-line text-dim hover:border-amber/50 hover:text-ink"
              }`}
            >
              {h.label}
            </button>
          ))}
        </div>

        <p className="mx-auto mt-3 min-h-[3.5rem] max-w-2xl text-center text-xs leading-relaxed text-dim">
          {hook ? HOOKS.find((h) => h.id === hook)!.body : "Hover a hook — in the diagram or below it."}
        </p>

        <Reveal delay={0.12}>
          <p className="mx-auto mt-6 max-w-2xl text-center text-xs text-dim">
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
