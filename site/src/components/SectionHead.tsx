import Reveal from "./Reveal";

// Shared section header: eyebrow, heading, lede.
export default function SectionHead({
  eyebrow,
  title,
  children,
  center = false,
}: {
  eyebrow: string;
  title: React.ReactNode;
  children?: React.ReactNode;
  center?: boolean;
}) {
  return (
    <Reveal>
      <div className={center ? "mx-auto max-w-2xl text-center" : "max-w-2xl"}>
        <p className="text-sm font-medium text-accent">{eyebrow}</p>
        <h2 className="mt-3 text-3xl font-bold tracking-tight sm:text-5xl">{title}</h2>
        {children && <p className="mt-4 text-dim">{children}</p>}
      </div>
    </Reveal>
  );
}
