import type { Metadata } from "next"

/**
 * Shared robots metadata for indexable pages.
 * - Google/Bing Search: index + follow only.
 * - Do NOT set noarchive / nosnippet / noindex here — Bing Webmaster Tools flags those
 *   as "restrictive robots directives" even when index/follow are true.
 * - AI policy: human AI referrers + AI *reference* crawlers on CrawlerSeoPage;
 *   AI *training* crawlers Disallow:/ + Content-Signal search=yes, ai-train=no, use=reference
 *   in app/robots.txt/route.ts. See lib/ai-referral.ts.
 */
export const INDEXABLE_PAGE_ROBOTS: NonNullable<Metadata["robots"]> = {
  index: true,
  follow: true,
  googleBot: {
    index: true,
    follow: true,
    "max-video-preview": -1,
    "max-image-preview": "large",
    "max-snippet": -1,
  },
}
