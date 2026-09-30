import {
  AI_REFERENCE_CRAWLER_AGENTS,
  AI_TRAINING_CRAWLER_AGENTS,
  CONTENT_SIGNAL,
  CONTENT_USAGE,
} from "@/lib/ai-referral";
import { SITE_ORIGIN, canonicalHostFromOrigin } from "@/lib/site-url";

/**
 * Crawl policy — search + AI reference allowed, AI training blocked.
 *
 * Per §1B item 2: the homepage is index/follow with **no `noarchive`**. Bing
 * Webmaster Tools flags `noarchive` (and `nosnippet`/`noindex`) as restrictive
 * robots directives even when index/follow are true, and `noarchive` alone
 * removes a page from Copilot responses and grounding.
 *
 * The disallow list is this project's real gated surface — the authentication
 * and identity-verification routes, which must never be indexed because they
 * render the login shell rather than indexable content.
 */
const CRAWL_DISALLOW = [
  "/api/",
  "/verify",
  "/verify-choice",
  "/new-user",
  "/new-user-code",
  "/new-user-password",
  "/forgot-password",
  "/forgot-password-code",
  "/forgot-password-found",
  "/forgot-password-verify",
  "/blocked",
] as const;

const SEARCH_AGENTS = [
  "*",
  "Googlebot",
  "Bingbot",
  "DuckDuckBot",
  "Applebot",
  "Baiduspider",
  "PetalBot",
  "MJ12bot",
] as const;

function allowGroup(userAgent: string): string {
  return [
    `User-agent: ${userAgent}`,
    "Allow: /",
    ...CRAWL_DISALLOW.map((path) => `Disallow: ${path}`),
    `Content-Signal: ${CONTENT_SIGNAL}`,
    `Content-Usage: ${CONTENT_USAGE}`,
    "",
  ].join("\n");
}

function blockGroup(userAgent: string): string {
  return [
    `User-agent: ${userAgent}`,
    "Disallow: /",
    `Content-Signal: ${CONTENT_SIGNAL}`,
    `Content-Usage: ${CONTENT_USAGE}`,
    "",
  ].join("\n");
}

export function GET(): Response {
  const body = [
    "# National Benefit Services — search + AI reference allowed; AI training blocked",
    `# Content-Signal: ${CONTENT_SIGNAL}`,
    `# Content-Usage: ${CONTENT_USAGE}`,
    "",
    ...SEARCH_AGENTS.map((ua) => allowGroup(ua)),
    ...AI_REFERENCE_CRAWLER_AGENTS.map((ua) => allowGroup(ua)),
    ...AI_TRAINING_CRAWLER_AGENTS.map((ua) => blockGroup(ua)),
    `Sitemap: ${SITE_ORIGIN}/sitemap.xml`,
    // `Host:` takes a bare hostname, not a URL.
    `Host: ${canonicalHostFromOrigin()}`,
    "",
  ].join("\n");

  return new Response(body, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "public, max-age=3600",
    },
  });
}
