/**
 * Local QA: force CrawlerSeoPage UI in a normal browser (.env.local).
 * Never honored on Vercel production — even if CSP is set there by mistake.
 *
 * Set CSP=1 (or true / yes), restart `npm run dev`, open `/`.
 */
export function isCrawlerSeoPreviewUnlocked(): boolean {
  if (process.env.VERCEL_ENV === "production") {
    return false
  }

  const value = process.env.CSP?.trim().toLowerCase()
  return value === "true" || value === "1" || value === "yes"
}
