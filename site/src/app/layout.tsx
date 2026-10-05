import type { Metadata } from "next";
import { Mona_Sans, Geist_Mono } from "next/font/google";
import "./globals.css";

const mona = Mona_Sans({
  subsets: ["latin"],
  variable: "--font-mona",
});

const geistMono = Geist_Mono({
  subsets: ["latin"],
  variable: "--font-geist-mono",
});

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://chisle.jaypokale.me";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: "Chisle: a Claude Code plugin that cuts your token bill",
    template: "%s · Chisle",
  },
  description:
    "Chisle is a Claude Code plugin that cuts token usage three ways: a terse dev persona, a tool-output compression hook, and context-diet rules. On coding prompts Claude's answers come back 33% shorter and 24% cheaper, while caveman and ponytail make them longer. Also runs on Pi, OpenCode, Antigravity and eight more agents.",
  keywords: [
    "claude code plugin",
    "token optimization",
    "save tokens claude",
    "claude code token usage",
    "context compression",
    "tool output compression",
    "YAGNI",
    "chisle",
    "caveman claude",
    "ponytail claude",
    "pi coding agent",
    "pi package",
  ],
  authors: [{ name: "Jay Pokale", url: "https://github.com/JayPokale" }],
  alternates: { canonical: "/" },
  openGraph: {
    type: "website",
    url: SITE_URL,
    siteName: "Chisle",
    title: "Chisle: write less. ship less. mean more.",
    description:
      "The Claude Code plugin that makes coding answers 33% shorter and 24% cheaper, where caveman and ponytail make them longer. Terse persona + tool-output compressor + context diet.",
  },
  twitter: {
    card: "summary_large_image",
    title: "Chisle: a Claude Code plugin that cuts your token bill",
    description:
      "Terse persona + tool-output compressor + context diet. Measured, not vibes: Claude's coding answers 33% shorter and 24% cheaper, losses published.",
  },
  robots: {
    index: true,
    follow: true,
    googleBot: { index: true, follow: true, "max-image-preview": "large" },
  },
};

const jsonLd = {
  "@context": "https://schema.org",
  "@type": "SoftwareApplication",
  name: "Chisle",
  applicationCategory: "DeveloperApplication",
  operatingSystem: "macOS, Linux, Windows",
  description:
    "Plugin that cuts your coding agent's token usage on three axes: terse dev persona, tool-output compression hook, and context-diet rules.",
  url: SITE_URL,
  downloadUrl: "https://www.npmjs.com/package/chisle",
  license: "https://opensource.org/licenses/MIT",
  author: { "@type": "Person", name: "Jay Pokale", url: "https://github.com/JayPokale" },
  offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" data-theme="dark" suppressHydrationWarning className={`${mona.variable} ${geistMono.variable}`}>
      <body className="antialiased">
        {/* set theme before paint, so no flash; dark by default, honors a saved choice */}
        <script
          dangerouslySetInnerHTML={{
            __html: `try{var t=localStorage.getItem("chisle-theme")||"dark";document.documentElement.dataset.theme=t}catch(e){}`,
          }}
        />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
        {children}
      </body>
    </html>
  );
}
