// Each figure carries where it comes from. The point of the site is that the
// numbers survive being checked, so the source sits right under the number.
const STATS = [
  { v: "−33%", k: "shorter coding answers in Claude Code; caveman and ponytail run 10% longer", src: "14 coding cells, Claude Code 2.1.285 + Haiku 4.5, 2026-10-01; answer = billed minus reasoning, from benchmarks/results/" },
  { v: "−24%", k: "Claude's bill on coding prompts; rivals land at 100–120%", src: "same 14 cells; across all 26 prompts Chisle bills 83%, rivals 102–105%" },
  { v: "−46%", k: "per oversized tool output, before Claude reads it", src: "PostToolUse hook replayed over 171 real Claude Code sessions; Read/Edit never touched" },
  { v: "0", k: "dependencies, network calls, LLM calls", src: "the plugin itself; the marketing site you are reading has its own" },
];

export default function Stats() {
  return (
    <section className="border-y border-line bg-surface">
      <dl className="mx-auto grid max-w-6xl grid-cols-2 lg:grid-cols-4">
        {STATS.map((s) => (
          <div key={s.k} className="group border-line px-6 py-10 odd:border-r lg:border-r lg:last:border-r-0 [&:nth-child(-n+2)]:border-b lg:[&:nth-child(-n+2)]:border-b-0">
            <dt className="sr-only">{s.k}</dt>
            <dd>
              <p className="text-4xl font-bold tracking-tight text-gradient w-fit">{s.v}</p>
              <p className="mt-2 text-sm text-fg">{s.k}</p>
              <p className="mt-2 text-xs leading-snug text-dim">{s.src}</p>
            </dd>
          </div>
        ))}
      </dl>
    </section>
  );
}
