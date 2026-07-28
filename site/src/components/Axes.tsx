import Reveal from "./Reveal";

const AXES = [
  {
    name: "Terse persona",
    what: "How the model writes",
    body: "Senior-dev voice: fragments over sentences, YAGNI-first code, reuse before new code. Three levels — /chisle lite, full, ultra. Commits and security warnings stay verbose on purpose.",
  },
  {
    name: "Output compressor",
    what: "What survives into context",
    body: "A PostToolUse hook shrinks tool results before the model reads them: ANSI scrub, head + tail elide with error-line salvage, same-session dedup. Never touches Read, Edit, or Write.",
  },
  {
    name: "Context diet",
    what: "What gets read at all",
    body: "Rules that teach the model to fetch the slice, not the file: grep first, sliced reads, filter at the source, never re-read what's already in context.",
  },
];

const EXTRAS = [
  { name: "Live savings statusline", body: "A ⇣9k tok badge showing measured chars elided — real baseline, not an estimate." },
  { name: "Works beyond Claude Code", body: "Generated rulesets for Cursor, Windsurf, Cline, Kiro, and Copilot ship in the same install." },
  { name: "Tested where it matters", body: "The compressor is where a bug corrupts files — it's covered by the test suite, with a hard allowlist." },
  { name: "Easy off-switch", body: "\"stop chisle\" for the persona, CHISLE_COMPRESS=0 for the hook, npx chisle --uninstall for everything." },
];

export default function Axes() {
  return (
    <section id="features" className="mx-auto max-w-5xl px-5 py-24">
      <Reveal>
        <h2 className="text-2xl font-semibold tracking-tight sm:text-4xl">
          One plugin, three levers
        </h2>
        <p className="mt-3 max-w-xl text-sm text-dim">
          Other token savers only make the model write less. Tool output is the bigger bill —
          67.5% of a session — and it re-bills every turn.
        </p>
      </Reveal>
      <div className="mt-12 grid gap-px overflow-hidden rounded-xl border border-line bg-line sm:grid-cols-3">
        {AXES.map((a, i) => (
          <Reveal key={a.name} delay={i * 0.08}>
            <div className="h-full bg-paper p-6">
              <p className="text-xs text-amber">{a.what}</p>
              <h3 className="mt-2 text-lg font-semibold">{a.name}</h3>
              <p className="mt-2.5 text-sm leading-relaxed text-dim">{a.body}</p>
            </div>
          </Reveal>
        ))}
      </div>
      <div className="mt-5 grid gap-px overflow-hidden rounded-xl border border-line bg-line sm:grid-cols-2 lg:grid-cols-4">
        {EXTRAS.map((e, i) => (
          <Reveal key={e.name} delay={i * 0.06}>
            <div className="h-full bg-paper p-5">
              <h3 className="text-sm font-semibold">{e.name}</h3>
              <p className="mt-2 text-xs leading-relaxed text-dim">{e.body}</p>
            </div>
          </Reveal>
        ))}
      </div>
    </section>
  );
}
