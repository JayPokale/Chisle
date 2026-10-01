import { Logo } from "./Nav";

const COLS = [
  {
    title: "Product",
    links: [
      ["Get started", "#get-started"],
      ["Features", "#features"],
      ["Benchmarks", "#numbers"],
      ["FAQ", "#faq"],
    ],
  },
  {
    title: "Resources",
    links: [
      ["Install guide", "https://github.com/JayPokale/Chisle/blob/main/INSTALL.md"],
      ["Raw transcripts", "https://github.com/JayPokale/Chisle/tree/main/benchmarks"],
      ["Changelog", "https://github.com/JayPokale/Chisle/blob/main/CHANGELOG.md"],
    ],
  },
  {
    title: "Community",
    links: [
      ["GitHub", "https://github.com/JayPokale/Chisle"],
      ["npm", "https://www.npmjs.com/package/chisle"],
      ["Contributing", "https://github.com/JayPokale/Chisle/blob/main/CONTRIBUTING.md"],
    ],
  },
];

export default function Footer() {
  return (
    <footer className="border-t border-line bg-surface">
      <div className="mx-auto grid max-w-6xl gap-10 px-5 py-14 sm:grid-cols-2 lg:grid-cols-[1.5fr_1fr_1fr_1fr]">
        <div>
          <Logo />
          <p className="mt-3 max-w-xs text-sm text-dim">
            Cut your coding agent&apos;s token bill on three axes. MIT · Jay Pokale.
          </p>
        </div>
        {COLS.map((c) => (
          <nav key={c.title} aria-label={c.title}>
            <p className="text-sm font-semibold">{c.title}</p>
            <ul className="mt-3 space-y-2 text-sm text-dim">
              {c.links.map(([label, href]) => (
                <li key={label}>
                  <a
                    href={href}
                    {...(href.startsWith("http") ? { target: "_blank", rel: "noopener noreferrer" } : {})}
                    className="transition-colors hover:text-fg"
                  >
                    {label}
                  </a>
                </li>
              ))}
            </ul>
          </nav>
        ))}
      </div>
    </footer>
  );
}
