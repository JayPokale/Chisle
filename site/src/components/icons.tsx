// Small stroke icons, drawn inline: no icon library. 24×24, stroked with currentColor.
export const ICONS: Record<string, React.ReactNode> = {
  persona: <path d="M4 6h16M4 12h10M4 18h6" />,
  compress: <path d="M4 4h16v4H4zM8 12h8M10 16h4M12 20h0" />,
  diet: <path d="M11 4a7 7 0 1 0 0 14 7 7 0 0 0 0-14zM21 21l-5-5" />,
  status: <path d="M3 12h4l3-8 4 16 3-8h4" />,
  tested: <path d="M12 3l8 4v5c0 5-3.5 8-8 9-4.5-1-8-4-8-9V7zM8.5 12l2.5 2.5 4.5-5" />,
  off: <path d="M12 3v9M6.3 6.3a8 8 0 1 0 11.4 0" />,
  agents: <path d="M4 4h7v7H4zM13 4h7v7h-7zM4 13h7v7H4zM13 13h7v7h-7z" />,
  deps: <path d="M12 3l8 4.5v9L12 21l-8-4.5v-9zM12 12l8-4.5M12 12v9M12 12L4 7.5" />,
  offline: <path d="M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zM5.6 5.6l12.8 12.8" />,
  open: <path d="M7 11V7a5 5 0 0 1 9.9-1M5 11h14v10H5z" />,
  copy: <path d="M9 9h11v11H9zM5 15H4V4h11v1" />,
  check: <path d="M5 12.5l4.5 4.5L19 7.5" />,
};

export function Glyph({ name, size = 18 }: { name: string; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      {ICONS[name]}
    </svg>
  );
}
