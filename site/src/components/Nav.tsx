import { getRepoStats } from "@/lib/github";
import ThemeToggle from "./ThemeToggle";
import NavLinks from "./NavLinks";

export function GitHubIcon({ size = 15 }: { size?: number }) {
  return (
    <svg viewBox="0 0 16 16" width={size} height={size} fill="currentColor" aria-hidden>
      <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27s1.36.09 2 .27c1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.01 8.01 0 0 0 16 8c0-4.42-3.58-8-8-8Z" />
    </svg>
  );
}

export function Logo() {
  return (
    <span className="flex items-center gap-2 font-semibold tracking-tight">
      <span
        aria-hidden
        className="grid h-7 w-7 place-items-center rounded-md bg-gradient-to-br from-brand to-[#cd88ff] font-mono text-xs text-white"
      >
        C
      </span>
      chisle
    </span>
  );
}

export default async function Nav() {
  const stats = await getRepoStats();
  return (
    <nav className="fixed top-0 z-40 w-full border-b border-line/70 bg-bg/75 backdrop-blur-md">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-5 py-3">
        <a href="#top" aria-label="Chisle home">
          <Logo />
        </a>
        <div className="flex items-center gap-6 text-sm text-dim">
          <NavLinks />
        </div>
        <div className="flex items-center gap-2.5">
          <a
            href="https://github.com/JayPokale/Chisle"
            target="_blank"
            rel="noopener noreferrer"
            className="hidden items-center gap-1.5 rounded-md border border-line px-2.5 py-1.5 text-xs text-dim transition-colors hover:text-fg sm:flex"
          >
            <GitHubIcon size={14} />
            {stats.stars > 0 ? stats.stars.toLocaleString() : "GitHub"}
          </a>
          <ThemeToggle />
          <a
            href="#get-started"
            className="rounded-md bg-brand px-3.5 py-1.5 text-sm font-medium text-white transition-colors hover:bg-brand-hover"
          >
            Get started
          </a>
        </div>
      </div>
    </nav>
  );
}
