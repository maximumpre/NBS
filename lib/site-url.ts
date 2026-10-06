/**
 * Production site-url — Step 6 (Domain Origin & IndexNow).
 *
 * `SITE_ORIGIN` and `INDEXNOW_KEY` are the operator-pasted production values,
 * used exactly as pasted. `SITE_ORIGIN` is a hardcoded `https://` literal on
 * purpose: `check-canonical-domain.mjs` fails the build on an env-driven origin,
 * because a split between canonical and advertised hosts is what makes
 * robots/sitemap/OG disagree (and produces a blank social card on a 308).
 */

export const SITE_DISPLAY_NAME = "National Benefit Services" as const

/**
 * Canonical origin — no trailing slash.
 * Operator-pasted production domain. Do NOT swap apex <-> www and do NOT let a
 * Vercel "primary" host override it.
 */
export const SITE_ORIGIN = "https://www.nbs-wealthcareportalauth.com" as const

/** @deprecated Use SITE_ORIGIN — kept for middleware host redirect imports. */
export const SITE_URL = SITE_ORIGIN

/** Homepage canonical + sitemap entry (trailing slash). */
export const SITE_HOMEPAGE_CANONICAL = `${SITE_ORIGIN}/` as const

/** Absolute sitemap URL — must match the `Sitemap:` field in robots.txt. */
export const SITE_SITEMAP_URL = `${SITE_ORIGIN}/sitemap.xml` as const

/** Hostname only, for host comparisons. */
export const CANONICAL_HOST = new URL(SITE_ORIGIN).hostname

/**
 * IndexNow key. Must match `public/{INDEXNOW_KEY}.txt` byte for byte —
 * `check-indexnow-key.mjs` fails the build otherwise. The env override exists
 * for rotation only; the literal is the default.
 */
export const INDEXNOW_KEY =
  process.env.INDEXNOW_KEY?.trim() ?? "ca3ae6345de747bf9ba25a143b562e57"

/**
 * Bump when homepage SEO copy changes materially (title, description, keywords, CrawlerSeoPage twin).
 * Used as sitemap `lastmod` — stale dates weaken re-crawl signals.
 * Format: ISO-8601 UTC. Example: bump to today's date on SEO deploys.
 */
export const SITE_CONTENT_UPDATED_AT = "2026-08-03T00:00:00.000Z" as const

export function canonicalHostFromOrigin(): string {
  try {
    return new URL(SITE_ORIGIN).hostname
  } catch {
    return "localhost"
  }
}

export function canonicalUrlForPath(pathname: string): string {
  const path = pathname.startsWith("/") ? pathname : `/${pathname}`
  if (path === "/") return SITE_HOMEPAGE_CANONICAL
  return `${SITE_ORIGIN}${path}`
}

export type SitePlatform = "alight" | "wealthcare" | "other"

/** Override when auto-detect is wrong. */
export const SITE_PLATFORM: SitePlatform | undefined = undefined

export function detectSitePlatform(): SitePlatform {
  if (SITE_PLATFORM) return SITE_PLATFORM
  const host = new URL(SITE_ORIGIN).hostname.toLowerCase()
  const label = SITE_DISPLAY_NAME.toLowerCase()
  if (/wealthcare|aptia365|flores247|flores/i.test(host + label)) return "wealthcare"
  if (/alight|worklife|work-life|workife/i.test(host + label)) return "alight"
  return "other"
}

/** Site name for 🌐 New Visitor (…) — suffix Alight/Wealthcare when applicable. */
export function getTelegramVisitorSiteName(): string {
  const base = SITE_DISPLAY_NAME.trim()
  const platform = detectSitePlatform()
  if (platform === "alight") {
    return /alight|worklife|work-life/i.test(base) ? base : `${base} Alight`
  }
  if (platform === "wealthcare") {
    return /wealthcare/i.test(base) ? base : `${base} Wealthcare`
  }
  return base
}
