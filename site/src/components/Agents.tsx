import Reveal from "./Reveal";

// Coverage per agent, matching the FAQ and README: "full" runs both axes,
// "skills" gets /chisle commands, "rules" gets the generated ruleset only.
const AGENTS = [
  { name: "Claude Code", level: "full" },
  { name: "Pi", level: "full" },
  { name: "OpenCode", level: "full" },
  { name: "Hermes", level: "skills" },
  { name: "Cursor", level: "rules" },
  { name: "Windsurf", level: "rules" },
  { name: "Cline", level: "rules" },
  { name: "Kiro", level: "rules" },
  { name: "Antigravity", level: "rules" },
  { name: "Codex", level: "rules" },
  { name: "Gemini", level: "rules" },
  { name: "Copilot", level: "rules" },
] as const;

const LEVEL = {
  full: { label: "persona + compressor", cls: "bg-accent-soft text-accent" },
  skills: { label: "/chisle skills", cls: "bg-raised text-fg" },
  rules: { label: "ruleset", cls: "bg-raised text-dim" },
};

export default function Agents() {
  return (
    <section className="border-y border-line bg-surface py-24">
      <div className="mx-auto max-w-6xl px-5">
        <Reveal>
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="text-sm font-medium text-accent">Runs where you work</p>
              <h2 className="mt-3 text-3xl font-bold tracking-tight sm:text-4xl">Twelve agents, one install</h2>
            </div>
            <p className="max-w-sm text-sm text-dim">
              Full coverage where the agent exposes hooks. Elsewhere the persona ships as a
              generated rule file and stays always on.
            </p>
          </div>
        </Reveal>

        <div className="mt-10 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {AGENTS.map((a, i) => (
            <Reveal key={a.name} delay={0.03 * i}>
              <div className="lift flex h-full items-center gap-3 rounded-lg border border-line bg-bg p-4">
                <span
                  aria-hidden
                  className="grid h-10 w-10 shrink-0 place-items-center rounded-md border border-line bg-raised font-mono text-sm font-semibold"
                >
                  {a.name.slice(0, 2)}
                </span>
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold">{a.name}</p>
                  <span className={`mt-1 inline-block rounded px-1.5 py-0.5 text-[10.5px] ${LEVEL[a.level].cls}`}>
                    {LEVEL[a.level].label}
                  </span>
                </div>
              </div>
            </Reveal>
          ))}
          <Reveal delay={0.35}>
            <a
              href="https://github.com/JayPokale/Chisle/blob/main/INSTALL.md"
              target="_blank"
              rel="noopener noreferrer"
              className="lift flex h-full items-center justify-center rounded-lg border border-dashed border-line p-4 text-sm font-medium text-accent"
            >
              Per-agent install table →
            </a>
          </Reveal>
        </div>
      </div>
    </section>
  );
}
