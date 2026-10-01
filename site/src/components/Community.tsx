import { getRepoStats } from "@/lib/github";
import Reveal from "./Reveal";
import CopyCmd from "./CopyCmd";
import { GitHubIcon } from "./Nav";

export default async function Community() {
  const stats = await getRepoStats();

  return (
    <section className="px-5 pb-28">
      <Reveal>
        <div className="relative mx-auto max-w-6xl overflow-hidden rounded-2xl border border-line bg-surface px-6 py-20 text-center">
          <div aria-hidden className="grid-bg pointer-events-none absolute inset-0" />
          <div aria-hidden className="glow pointer-events-none absolute inset-0" />
          <div className="relative">
            <h2 className="mx-auto max-w-2xl text-3xl font-bold tracking-tight sm:text-5xl">
              Stop paying for filler. <span className="text-gradient">Start shipping.</span>
            </h2>
            <p className="mx-auto mt-4 max-w-md text-dim">
              MIT licensed, built in the open. Land a PR, or file an issue good enough to fix
              itself, and you are credited in the repo.
            </p>
            <div className="mx-auto mt-8 max-w-sm">
              <CopyCmd cmd="npx chisle" label="npx install" />
            </div>
            <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
              <a
                href="https://github.com/JayPokale/Chisle"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 rounded-md bg-brand px-5 py-2.5 text-sm font-medium text-on-brand shadow-[0_0_30px_-6px_#ffa028] transition-colors hover:bg-brand-hover"
              >
                <GitHubIcon size={15} />
                Star on GitHub{stats.stars > 0 ? ` · ${stats.stars.toLocaleString()}` : ""}
              </a>
              <a
                href="https://www.npmjs.com/package/chisle"
                target="_blank"
                rel="noopener noreferrer"
                className="rounded-md border border-line bg-bg/60 px-5 py-2.5 text-sm font-medium transition-colors hover:border-brand-hover"
              >
                View on npm
              </a>
            </div>
            <p className="mt-6 text-xs text-dim">
              Co-engineered with Claude, Codex &amp; Antigravity · descended from caveman &amp; ponytail
            </p>
          </div>
        </div>
      </Reveal>
    </section>
  );
}
