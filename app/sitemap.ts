import { MetadataRoute } from "next"
import { SITE_CONTENT_UPDATED_AT, SITE_HOMEPAGE_CANONICAL } from "@/lib/site-url"

/**
 * Only the homepage is indexable — the entire rest of the app is a gated
 * authentication surface (see app/robots.txt/route.ts). Listing any gated route
 * here would invite crawlers onto pages we disallow.
 *
 * `lastModified` is the pinned `SITE_CONTENT_UPDATED_AT`, not `new Date()`.
 * A `new Date()` lastmod re-stamps on every request, so the value changes on
 * every crawl — that tells search engines the page is constantly changing and
 * devalues the signal rather than conveying a real edit. Bump
 * `SITE_CONTENT_UPDATED_AT` when homepage SEO copy actually changes.
 */
export default function sitemap(): MetadataRoute.Sitemap {
  return [
    {
      url: SITE_HOMEPAGE_CANONICAL,
      lastModified: SITE_CONTENT_UPDATED_AT,
      changeFrequency: "weekly",
      priority: 1,
    },
  ]
}
