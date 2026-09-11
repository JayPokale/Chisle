import { getRepoStats } from "@/lib/github";
import Reveal from "./Reveal";

export default async function Community() {
  const stats = await getRepoStats();

  return (
    <section className="mx-auto max-w-5xl px-5 py-24 text-center">
      <Reveal>
        <h2 className="text-2xl font-semibold tracking-tight sm:text-4xl">Built in the open</h2>
        <p className="mx-auto mt-3 max-w-md text-sm text-dim">
          MIT licensed, zero dependencies. Land a PR, or file an issue good enough to fix
          itself, and you are credited in the repo.
        </p>
      </Reveal>

      <Reveal delay={0.15}>
        <div className="mt-10 flex items-center justify-center gap-3">
          <a
            href="https://github.com/JayPokale/Chisle"
            target="_blank"
            rel="noopener noreferrer"
            className="rounded-lg bg-ink px-5 py-3 text-sm font-medium text-paper transition-opacity hover:opacity-85"
          >
            Star on GitHub{stats.stars > 0 ? ` · ${stats.stars.toLocaleString()}★` : ""}
          </a>
          <a
            href="https://www.npmjs.com/package/chisle"
            target="_blank"
            rel="noopener noreferrer"
            className="rounded-lg border border-line px-5 py-3 text-sm text-dim transition-colors hover:text-ink"
          >
            npm
          </a>
        </div>
        <p className="mt-4 text-xs text-dim">
          Co-engineered with Claude, Codex &amp; Antigravity · descended from caveman &amp; ponytail
        </p>
      </Reveal>
    </section>
  );
}
