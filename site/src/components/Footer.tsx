export default function Footer() {
  return (
    <footer className="border-t border-line py-10">
      <div className="mx-auto flex max-w-5xl flex-col items-center justify-between gap-4 px-5 text-xs text-dim sm:flex-row">
        <p>
          <span className="text-amber" style={{ fontFamily: "var(--font-mono)" }}>[CHISLE]</span> ·
          MIT · Jay Pokale
        </p>
        <nav className="flex gap-5">
          <a className="transition-colors hover:text-ink" href="https://github.com/JayPokale/Chisle" target="_blank" rel="noopener noreferrer">GitHub</a>
          <a className="transition-colors hover:text-ink" href="https://www.npmjs.com/package/chisle" target="_blank" rel="noopener noreferrer">npm</a>
          <a className="transition-colors hover:text-ink" href="https://github.com/JayPokale/Chisle/tree/main/benchmarks" target="_blank" rel="noopener noreferrer">Benchmarks</a>
          <a className="transition-colors hover:text-ink" href="https://github.com/JayPokale/Chisle/blob/main/CHANGELOG.md" target="_blank" rel="noopener noreferrer">Changelog</a>
        </nav>
      </div>
    </footer>
  );
}
