// Each figure carries where it comes from. The point of the site is that the
// numbers survive being checked, so the source sits right under the number.
const STATS = [
  { v: "83%", k: "of a bare model's output; rivals land at 102–105%", src: "13 live prompts x 2 seeds, Haiku 4.5, 2026-10-01; 95% CI 69–95%, from benchmarks/results/" },
  { v: "77%", k: "on long answers; short ones break even (106%)", src: "same 26 cells split at the median baseline; little to cut in a three-line reply" },
  { v: "−51%", k: "ruleset cost per request since the trim", src: "1,779 → 877 input tokens, measured live; it rides along on every request" },
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
