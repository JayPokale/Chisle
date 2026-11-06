// Each figure carries where it comes from. The point of the site is that the
// numbers survive being checked, so the source sits right under the number.
const STATS = [
  { v: "−45%", k: "answer length in Claude Code, shorter than caveman and ponytail", src: "25 live prompts in one run, Claude Code 2.1.285 + Haiku 4.5, tools off; benchmarks/results/raw-nov-sidebyside/" },
  { v: "−43%", k: "billed output tokens on Sonnet 5.5 vs the same model bare", src: "34 live prompts, Claude Code + Sonnet 5.5, tools off; benchmarks/results/raw-nov-sonnet/" },
  { v: "−48%", k: "per oversized tool output, before Claude reads it", src: "PostToolUse hook replayed over the maintainer's recent Claude Code sessions; Read/Edit never touched" },
  { v: "156/156", k: "auto-graded maths and coding answers correct; the bare model got 154", src: "52 problems × 3 seeds, hidden tests, no judge model; benchmarks/quality/raw-nov/" },
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
