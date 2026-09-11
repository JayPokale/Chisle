import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geist = Geist({
  subsets: ["latin"],
  variable: "--font-geist",
});

const geistMono = Geist_Mono({
  subsets: ["latin"],
  variable: "--font-geist-mono",
});

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://chisle.jaypokale.me";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: "Chisle: cut your agent's token bill on three axes",
    template: "%s · Chisle",
  },
  description:
    "Chisle cuts your coding agent's token usage three ways: a terse dev persona, a tool-output compression hook, and context-diet rules. Measured against caveman and ponytail: 52% of a bare model's 20-task bill, 1 backfire in 20. Runs on Claude Code, Pi, and seven more agents.",
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
      "The coding-agent plugin that bills 52% of a bare model across 20 live tasks. Terse persona + tool-output compressor + context diet.",
  },
  twitter: {
    card: "summary_large_image",
    title: "Chisle: cut your agent's token bill on three axes",
    description:
      "Terse persona + tool-output compressor + context diet. Measured, not vibes: 52% of a bare model's bill.",
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
  softwareVersion: "1.2.1",
  license: "https://opensource.org/licenses/MIT",
  author: { "@type": "Person", name: "Jay Pokale", url: "https://github.com/JayPokale" },
  offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${geist.variable} ${geistMono.variable}`}>
      <body className="antialiased">
        {/* set theme before paint, so no flash; default light, honors saved choice or OS dark */}
        <script
          dangerouslySetInnerHTML={{
            __html: `try{var t=localStorage.getItem("chisle-theme")||(matchMedia("(prefers-color-scheme: dark)").matches?"dark":"light");document.documentElement.dataset.theme=t}catch(e){}`,
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
