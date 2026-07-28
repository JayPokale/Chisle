"use client";

import { useEffect, useState } from "react";

// Documentation-site pattern: the nav tells you where you are, not just where
// you can go. A reading-progress rail sits under the bar, and the link for the
// section currently in view is marked.
const SECTIONS = [
  { id: "features", label: "Features" },
  { id: "compare", label: "Compare" },
  { id: "ladder", label: "Ladder" },
  { id: "numbers", label: "Benchmarks" },
  { id: "faq", label: "FAQ" },
];

export default function NavLinks() {
  const [active, setActive] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    // Progress is cheap enough to compute on scroll; the section marker uses an
    // observer so we are not measuring every element on every frame.
    const onScroll = () => {
      const h = document.documentElement;
      const max = h.scrollHeight - h.clientHeight;
      setProgress(max > 0 ? (h.scrollTop / max) * 100 : 0);
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });

    const obs = new IntersectionObserver(
      (entries) => {
        const seen = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)[0];
        if (seen) setActive(seen.target.id);
      },
      // Band across the upper-middle of the viewport: a section counts as
      // "current" once its top passes the header, not when it first peeks in.
      { rootMargin: "-20% 0px -70% 0px" }
    );
    SECTIONS.forEach((s) => {
      const el = document.getElementById(s.id);
      if (el) obs.observe(el);
    });

    return () => {
      window.removeEventListener("scroll", onScroll);
      obs.disconnect();
    };
  }, []);

  return (
    <>
      {SECTIONS.map((s) => (
        <a
          key={s.id}
          href={`#${s.id}`}
          aria-current={active === s.id ? "location" : undefined}
          className={`relative hidden transition-colors sm:block ${
            active === s.id ? "text-amber" : "hover:text-ink"
          }`}
        >
          {s.label}
          <span
            aria-hidden
            className={`absolute -bottom-1 left-0 h-px bg-amber transition-all duration-300 ${
              active === s.id ? "w-full opacity-100" : "w-0 opacity-0"
            }`}
          />
        </a>
      ))}
      <span
        aria-hidden
        className="pointer-events-none absolute inset-x-0 bottom-0 h-px bg-amber transition-[width] duration-150"
        style={{ width: `${progress}%` }}
      />
    </>
  );
}
