const STATS = [
  { v: "52%", k: "of a bare model's 20-task bill" },
  { v: "44%", k: "on coding prompts — 45% on long answers" },
  { v: "1/20", k: "backfires — rivals hit 6 and 8" },
  { v: "0", k: "dependencies, network calls, LLM calls" },
];

export default function Stats() {
  return (
    <section className="border-y border-line bg-panel/60">
      <div className="mx-auto grid max-w-5xl grid-cols-2 divide-line px-5 sm:grid-cols-4 sm:divide-x">
        {STATS.map((s) => (
          <div key={s.k} className="px-4 py-8 text-center">
            <p className="text-2xl font-semibold text-amber">{s.v}</p>
            <p className="mt-1.5 text-xs leading-snug text-dim">{s.k}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
