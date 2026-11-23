// Each figure carries where it comes from. The point of the site is that the
// numbers survive being checked, so the source sits right under the number.
const STATS = [
  { v: "−43%", k: "answer length on Sonnet 5.5; caveman −23%, ponytail −36%", src: "13 prompts × 3 runs in one session, Claude Code + Sonnet 5.5, every arm answered every prompt; benchmarks/results/raw-314-sonnet-direct/" },
  { v: "−39%", k: "billed output tokens on Sonnet 5.5; caveman −22%, ponytail −27%", src: "same run; on Haiku 4.5 every ruleset adds hidden thinking, Chisle −9%; benchmarks/results/raw-314-direct/" },
  { v: "−48%", k: "per oversized tool output, before Claude reads it", src: "PostToolUse hook replayed over the maintainer's recent Claude Code sessions; Read/Edit never touched" },
  { v: "156/156", k: "auto-graded maths and coding answers correct, same as the bare model", src: "52 problems × 3 seeds, Haiku 4.5, hidden tests, no judge model; benchmarks/quality/raw-314/" },
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
