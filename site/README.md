# Chisle site

Marketing site: Next.js 16 + Tailwind 4 + motion. Lives in the repo but ships
nowhere else: `site/` is not in `package.json` `files` (npm never packs it) and
not in the plugin manifest (plugin installs never copy it).

## Dev

```bash
cd site
npm install
npm run dev
```

## Deploy (Vercel)

1. vercel.com → New Project → import `JayPokale/Chisle`.
2. **Root Directory: `site`** (the one setting that matters).
3. Framework auto-detects as Next.js. Deploy.
4. Custom domain: Project → Settings → Domains → add yours, point DNS
   (A `76.76.21.21` or CNAME `cname.vercel-dns.com`).
5. After the domain is live, set env `NEXT_PUBLIC_SITE_URL=https://yourdomain`
   (Project → Settings → Environment Variables) and redeploy. Canonical URL,
   sitemap, robots, and OG tags all read it.

GitHub stars/contributors are fetched server-side with 1-hour ISR, so live
numbers, no client rate limits, visible to crawlers.

SEO/LLM: `robots.ts` explicitly allows GPTBot, ClaudeBot, PerplexityBot & co;
`public/llms.txt` is the llmstxt.org summary; JSON-LD SoftwareApplication
schema in the layout; OG image generated at `/opengraph-image`.
