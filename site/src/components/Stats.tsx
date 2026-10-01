// Each figure carries where it comes from. The point of the site is that the
// numbers survive being checked, so the source sits right under the number.
const STATS = [
  { v: "52%", k: "of a bare model's 20-task bill", src: "20 live tasks, two suites, billed output tokens, from benchmarks/results/" },
  { v: "44%", k: "on coding prompts, 45% on long answers", src: "same cells, split by prompt kind (n=12) and by median answer size" },
  { v: "1/20", k: "backfires, where rivals hit 6 and 8", src: "a backfire is a task costing MORE than no tool at all; ours was root-caused and fixed" },
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
