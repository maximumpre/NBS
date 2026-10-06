/**
 * Single source for layout metadata and the CrawlerSeoPage twin.
 *
 * `SITE_KEYWORDS` must feed BOTH:
 *  - the layout `<meta name="keywords">`
 *  - the visible CrawlerSeoPage body block (`Related searches: …`)
 *
 * Never ship keywords only in meta — crawlers must see them in the body.
 *
 * Titles, descriptions and JSON-LD `name` stay domain-free (brand first);
 * `alternateName` may carry the bare host only as its last fallback entry.
 * The descriptions below describe the service, not the host.
 */

import { buildSiteKeywords } from "@/lib/seo-keywords";
import { CANONICAL_HOST, SITE_DISPLAY_NAME } from "@/lib/site-url"
import { LAYOUT_DESCRIPTION } from "@/lib/meta-description"

export const SITE_TITLE = `Participant Login | ${SITE_DISPLAY_NAME}`;

export const SITE_DESCRIPTION = LAYOUT_DESCRIPTION;

export { LAYOUT_DESCRIPTION };

export const SITE_KEYWORDS: string[] = buildSiteKeywords();

const VISIBLE_HOST_TOKENS = [
  CANONICAL_HOST.toLowerCase(),
  CANONICAL_HOST.replace(/^www\./, "").toLowerCase(),
]

/**
 * Body-safe keywords for the visible `Related searches: …` crawler body block.
 * Raw domain tokens stay in `<meta name="keywords">` only — Yandex still reads
 * meta keywords; a domain in visible body copy reads as stuffing to Google/Bing.
 */
export function buildVisibleKeywords(): string[] {
  return SITE_KEYWORDS.filter((k) => !VISIBLE_HOST_TOKENS.some((h) => k.toLowerCase().includes(h)))
}

export const SITE_VISIBLE_KEYWORDS = buildVisibleKeywords()
