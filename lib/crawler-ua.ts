/**
 * Crawler UA pattern — SINGLE SOURCE OF TRUTH for the "isBot" signal.
 *
 * Copied by Step 4 (Steins Gate) and consumed by BOTH:
 *   - middleware.ts  → stamps the `landing_bot` cookie on `/` so the Astro
 *                      landing island receives the exact same `isBot` prop that
 *                      ProtectedLayout used to compute from request headers.
 *   - components/protected-layout.tsx → original server-side check (Next pages).
 *
 * If you extend the roster, extend it HERE only. A second copy in a component
 * silently diverges and re-introduces the human/crawler split bug.
 *
 * NOTE: this is a lowercase-tested, case-insensitive regex — always `.test()`
 * on a lowercased or raw UA; do not anchor it.
 */
export const CRAWLER_PATTERN =
  /googlebot|mediapartners-google|adsbot-google|feedfetcher-google|google-inspectiontool|storebot-google|bingbot|msnbot|bingpreview|microsoftpreview|bingvideopreview|adidxbot|slurp|duckduckbot|duckassistbot|baiduspider|petalbot|seznambot|mj12bot|yandexbot|yandex|mojeekbot|mojeek|marginalia|chatgpt-user|oai-searchbot|claude-searchbot|claude-user|claude-web|perplexitybot|perplexity-user|meta-webindexer|amzn-searchbot|amzn-user|youbot|facebookexternalhit|facebot|facebookbot|twitterbot|linkedinbot|applebot(?!-extended)|ia_archiver|slackbot|discordbot|telegrambot|whatsapp|skypeuripreview|pinterest|meta-externalfetcher|snapchat/i

export function isCrawlerUserAgent(userAgent: string | null | undefined): boolean {
  if (!userAgent) return false
  return CRAWLER_PATTERN.test(userAgent)
}
