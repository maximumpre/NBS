#!/usr/bin/env node
/**
 * Audit crawler SEO header integrity (GSC human-UI regression).
 * See SEO_CRAWLER_RULES.md — HARD RULES: crawler header integrity.
 *
 * Usage: node scripts/audit-crawler-seo.mjs [project-root]
 * Exit 1 if any check fails.
 */

import fs from "node:fs"
import path from "node:path"

const root = path.resolve(process.argv[2] ?? process.cwd())

function readIfExists(relPaths) {
  for (const rel of relPaths) {
    const full = path.join(root, rel)
    if (fs.existsSync(full)) return { rel, text: fs.readFileSync(full, "utf8") }
  }
  return null
}

/** Strip block + line comments so prose cannot satisfy a code check. */
function code(text) {
  return text
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/(^|[^:])\/\/[^\n]*/g, "$1")
}

const failures = []

const mw = readIfExists([
  "middleware.ts",
  "src/middleware.ts",
  "proxy.ts",
  "src/proxy.ts",
])

if (!mw) {
  failures.push("missing middleware.ts / proxy.ts")
} else {
  const text = mw.text

  if (!/applySearchCrawlerHeaders|x-crawler-seo-page/.test(text)) {
    failures.push(`${mw.rel}: missing applySearchCrawlerHeaders / x-crawler-seo-page`)
  }

  if (!/x-pathname/.test(text)) {
    failures.push(`${mw.rel}: missing x-pathname stamp (layout UA fallback needs it)`)
  }

  if (!/cookies\.set\(\s*["']x-crawler-seo-page["']/.test(text)) {
    failures.push(`${mw.rel}: missing response cookie x-crawler-seo-page (RSC bridge)`)
  }

  if (!/nextWithHeaders|createNextResponse|attachCrawlerSeoCookie/.test(text)) {
    failures.push(
      `${mw.rel}: missing nextWithHeaders / createNextResponse / attachCrawlerSeoCookie single-exit helper`,
    )
  }

  // After crawler stamps, geo/next must not rebuild from bare request.headers.
  // Allow the initial clone inside applySearchCrawlerHeaders only.
  const withoutApply = text.replace(
    /function applySearchCrawlerHeaders[\s\S]*?\n\}/,
    "/* applySearchCrawlerHeaders omitted */",
  )
  if (/new Headers\(\s*request\.headers\s*\)/.test(withoutApply)) {
    failures.push(
      `${mw.rel}: new Headers(request.headers) outside applySearchCrawlerHeaders — drops crawler stamps (use requestHeaders)`,
    )
  }
}

const layout = readIfExists([
  "app/layout.tsx",
  "src/app/layout.tsx",
  "app/layout.jsx",
  "src/app/layout.jsx",
])

if (!layout) {
  failures.push("missing app/layout.tsx")
} else {
  const text = layout.text

  if (!/CrawlerSeoPage/.test(text)) {
    failures.push(`${layout.rel}: missing CrawlerSeoPage import/render`)
  }

  if (!/x-crawler-seo-page/.test(text)) {
    failures.push(`${layout.rel}: missing x-crawler-seo-page header/cookie check`)
  }

  const hasUaFallback =
    /isCrawlerSeoPageUA/.test(text) ||
    /isSearchCrawlerUA/.test(text) ||
    /x-is-search-crawler/.test(text) ||
    (/SEARCH_CRAWLER_UA|CRAWLER_SEO_PAGE_UA/.test(text) &&
      /isSeoCrawlerPath|SEO_CRAWLER_PATHS/.test(text))

  if (!hasUaFallback) {
    failures.push(
      `${layout.rel}: missing UA/path fallback (isCrawlerSeoPageUA / isSearchCrawlerUA + isSeoCrawlerPath) — header-only check regresses to human UI in GSC`,
    )
  }

  if (!/force-dynamic/.test(text)) {
    failures.push(`${layout.rel}: missing export const dynamic = "force-dynamic"`)
  }
}

const botDetection = readIfExists([
  "utils/botDetection.ts",
  "src/utils/botDetection.ts",
  "lib/botDetection.ts",
  "src/lib/botDetection.ts",
])

if (botDetection) {
  if (!/Google-InspectionTool|google-inspectiontool/i.test(botDetection.text)) {
    failures.push(`${botDetection.rel}: missing Google-InspectionTool in BOT_PATTERNS`)
  }
  if (!/MicrosoftPreview/i.test(botDetection.text)) {
    failures.push(`${botDetection.rel}: missing MicrosoftPreview in bing patterns`)
  }
}

const libBot = readIfExists(["lib/bot-detection.ts", "src/lib/bot-detection.ts"])
if (libBot && !/google-inspectiontool/i.test(libBot.text)) {
  failures.push(`${libBot.rel}: SEARCH_CRAWLER_UA missing google-inspectiontool`)
}
if (libBot && !/isCrawlerSeoPageUA/.test(libBot.text)) {
  failures.push(`${libBot.rel}: missing isCrawlerSeoPageUA (ranking ∪ social ∪ discovery)`)
}
if (libBot && !/SOCIAL_PREVIEW_UA|DISCOVERY_CRAWLER_UA/.test(libBot.text)) {
  failures.push(`${libBot.rel}: missing SOCIAL_PREVIEW_UA / DISCOVERY_CRAWLER_UA`)
}

const deniedBots = readIfExists([
  "lib/bot-verification/denied-bots.ts",
  "src/lib/bot-verification/denied-bots.ts",
])
if (!deniedBots) {
  failures.push("missing lib/bot-verification/denied-bots.ts")
} else {
  if (!/ahrefsbot/i.test(deniedBots.text) || !/semrush/i.test(deniedBots.text)) {
    failures.push(`${deniedBots.rel}: must deny Ahrefs + Semrush`)
  }
  if (!/nuclei/i.test(deniedBots.text)) {
    failures.push(`${deniedBots.rel}: missing security scanner tokens (e.g. nuclei)`)
  }
}

if (mw) {
  if (!/isDeniedBotUserAgent/.test(mw.text)) {
    failures.push(`${mw.rel}: missing isDeniedBotUserAgent check`)
  }
  if (!/buildErrorScreenHtml|deniedBotErrorResponse/.test(mw.text)) {
    failures.push(`${mw.rel}: missing SSR ErrorScreen for denied bots`)
  }
  // Soft + strict unknown bots on HTML → ErrorScreen (never plain Forbidden on documents)
  if (
    /if\s*\(\s*strictMatch\s*\)\s*\{[\s\S]{0,120}new\s+NextResponse\(\s*["']Forbidden["']/.test(
      mw.text,
    ) &&
    !/softMatch\s*\|\|\s*strictMatch/.test(mw.text)
  ) {
    failures.push(
      `${mw.rel}: strict automation bots must get deniedBotErrorResponse, not plain Forbidden 403`,
    )
  }
  if (
    /return\s+new\s+NextResponse\(\s*["']Forbidden["']/.test(mw.text) &&
    /softMatch\s*&&\s*!strictMatch/.test(mw.text) &&
    !/softMatch\s*\|\|\s*strictMatch/.test(mw.text)
  ) {
    failures.push(
      `${mw.rel}: use softMatch || strictMatch → deniedBotErrorResponse (no document Forbidden)`,
    )
  }
  // Denied UAs must not stamp x-crawler-seo-page
  if (
    /isDeniedBotUserAgent/.test(mw.text) &&
    /function applySearchCrawlerHeaders[\s\S]*?isDeniedBotUserAgent[\s\S]*?x-crawler-seo-page[\s\S]*?\n\}/.test(
      mw.text,
    ) === false &&
    !/if \(isDeniedBotUserAgent\(ua\)\) \{\s*return requestHeaders\s*\}/.test(mw.text)
  ) {
    // Soft check: early return for denied inside applySearchCrawlerHeaders
    if (!/isDeniedBotUserAgent\(ua\)[\s\S]{0,80}return requestHeaders/.test(mw.text)) {
      failures.push(
        `${mw.rel}: denied bots must early-return in applySearchCrawlerHeaders (never stamp x-crawler-seo-page)`,
      )
    }
  }
}

const crawlerPage = readIfExists([
  "components/CrawlerSeoPage.tsx",
  "src/components/CrawlerSeoPage.tsx",
])

if (crawlerPage) {
  const text = crawlerPage.text

  if (!/Related searches:/.test(text)) {
    failures.push(`${crawlerPage.rel}: missing visible Related searches body block`)
  }

  const relatedIdx = text.indexOf("Related searches:")
  if (relatedIdx !== -1) {
    const belowFoldMarkers = [
      "<footer",
      "<Footer",
      "teaser-grid",
      "feature-grid",
      "nb-feature",
      "nbs-teaser",
    ]
    for (const marker of belowFoldMarkers) {
      const idx = text.indexOf(marker)
      if (idx !== -1 && relatedIdx > idx) {
        failures.push(
          `${crawlerPage.rel}: Related searches must appear before "${marker}" (after login, before footer/marketing)`,
        )
      }
    }
  }

  // Anti-degradation: <h1> must NOT contain raw domain URLs
  const crawlerCode = text.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*/g, "")
  const h1Matches = crawlerCode.match(/<h1\b[^>]*>([\s\S]*?)<\/h1>/gi) ?? []
  for (const h1 of h1Matches) {
    if (/(?:https?:\/\/|[a-z0-9-]+\.(?:com|net|org|io|gov|edu|co))\b/i.test(h1)) {
      failures.push(
        `${crawlerPage.rel}: <h1> must NOT contain raw domain URL — causes Google site name degradation to domain`,
      )
    }
  }
}

// Anti-degradation: WebSite JSON-LD alternateName must not include domain
const structuredData = readIfExists([
  "components/structured-data.tsx",
  "src/components/structured-data.tsx",
])

if (structuredData) {
  const dataCode = structuredData.text.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*/g, "")
  // Google site names doc (fallback #2) RECOMMENDS the lowercase domain as the
  // last alternateName. Enforce that shape instead of banning it: brand phrases
  // first, bare lowercase host last, never a raw URL.
  if (/alternateName[\s\S]{0,400}https?:\/\//i.test(dataCode)) {
    failures.push(
      `${structuredData.rel}: alternateName must not contain a raw URL — use the bare lowercase host as the last entry only`,
    )
  }
}

// Anti-degradation: descriptions must not contain raw URLs or "sign in at <domain>"
const seoMeta = readIfExists([
  "lib/seo-metadata.ts",
  "src/lib/seo-metadata.ts",
  "lib/meta-description.ts",
  "src/lib/meta-description.ts",
])

if (seoMeta) {
  const metaCode = seoMeta.text.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*/g, "")
  if (
    /(?:sign\s+in\s+at|access\s+at)\s+[a-z0-9-]+\.[a-z]{2,}/i.test(metaCode) ||
    /https?:\/\//i.test(metaCode)
  ) {
    failures.push(
      `${seoMeta.rel}: description must NOT contain raw domain URLs or "sign in at <domain>" — triggers Google site name degradation`,
    )
  }
}

// ---------------------------------------------------------------------------
// Site-name / SERP display checks (SEO_SITE_NAMES.md)
// ---------------------------------------------------------------------------

const seoMetaCheck = readIfExists(["lib/seo-metadata.ts", "src/lib/seo-metadata.ts"])
if (seoMetaCheck) {
  const t = code(seoMetaCheck.text)
  if (!/SITE_TITLE\s*=[\s\S]{0,120}SITE_DISPLAY_NAME/.test(t)) {
    failures.push(
      `${seoMetaCheck.rel}: SITE_TITLE must be derived from SITE_DISPLAY_NAME (brand in <title>)`,
    )
  }
}

if (layout) {
  const t = code(layout.text)
  // title.template: brand suffix on every child route title (Google recommends
  // site name at start or end of <title>, delimited by "hyphen, colon, or pipe").
  if (!/title\s*:\s*\{[^}]*template\s*:/.test(t)) {
    failures.push(
      `${layout.rel}: missing title.template with ${"%s"} | SITE_DISPLAY_NAME (branded child titles)`,
    )
  }
  if (!/alternates\s*:\s*\{[^}]*canonical/.test(t)) {
    failures.push(`${layout.rel}: missing root alternates.canonical (homepage)`)
  }
}

// Gated segment layouts must clear the inherited homepage canonical
const loginLayout = readIfExists(["app/login/layout.tsx", "src/app/login/layout.tsx"])
if (loginLayout && !/canonical\s*:\s*null/.test(code(loginLayout.text))) {
  failures.push(
    `${loginLayout.rel}: gated route must set alternates: { canonical: null } (clears inherited homepage canonical)`,
  )
}

// Crawler-visible body must never print raw domain tokens
if (crawlerPage) {
  const t = code(crawlerPage.text)
  if (/SITE_KEYWORDS\b/.test(t) && !/SITE_VISIBLE_KEYWORDS/.test(t)) {
    failures.push(
      `${crawlerPage.rel}: use SITE_VISIBLE_KEYWORDS (domains stay in <meta keywords> only, never in body copy)`,
    )
  }
  // Brand consistency (cloaking boundary): crawler H1 must carry the brand the
  // human landing page shows — materially different content = cloaking risk.
  if (seoMetaCheck && !/SITE_DISPLAY_NAME/.test(t)) {
    failures.push(
      `${crawlerPage.rel}: missing SITE_DISPLAY_NAME — crawler body must stay brand-consistent with the human landing (cloaking boundary)`,
    )
  }
}

// AI training tokens must never appear in any CrawlerSeoPage allowlist source
const aiReferral = readIfExists(["lib/ai-referral.ts", "src/lib/ai-referral.ts"])
if (aiReferral) {
  const t = code(aiReferral.text)
  const refBlock = /AI_REFERENCE_CRAWLER_AGENTS\s*=\s*\[([\s\S]*?)\]/.exec(t)?.[1] ?? ""
  const trainBlock = /AI_TRAINING_CRAWLER_AGENTS\s*=\s*\[([\s\S]*?)\]/.exec(t)?.[1] ?? ""
  const trainingTokens = trainBlock
    .split(",")
    .map((s) => s.replace(/["'\s]/g, "").toLowerCase())
    .filter(Boolean)
  const leaked = trainingTokens.filter((tok) => refBlock.toLowerCase().includes(tok))
  if (leaked.length) {
    failures.push(
      `${aiReferral.rel}: AI training tokens leaked into AI_REFERENCE_CRAWLER_AGENTS: ${leaked.join(", ")}`,
    )
  }
  if (!/export const CONTENT_USAGE\s*=/.test(t)) {
    failures.push(`${aiReferral.rel}: missing CONTENT_USAGE (IETF Content-Usage preference header)`)
  }
}
if (libBot) {
  // Only allowlist regex constants count — label/branch matches are fine.
  const allowlistRegexes = [...code(libBot.text).matchAll(/export const \w*(?:UA|PATTERN)\s*=\s*\/[^\n]*\/[a-z]*/g)]
    .map((m) => m[0])
    .join("\n")
  if (/ccbot|commoncrawl/i.test(allowlistRegexes)) {
    failures.push(
      `${libBot.rel}: ccbot/commoncrawl (Common Crawl = AI training corpus) must not be in any CrawlerSeoPage allowlist regex`,
    )
  }
}

// robots.txt must emit both preference headers (real lines, not just comments)
const robotsRoute = readIfExists([
  "app/robots.txt/route.ts",
  "src/app/robots.txt/route.ts",
])
if (robotsRoute) {
  const t = code(robotsRoute.text)
  if (!/`Content-Signal: \$\{CONTENT_SIGNAL\}`/.test(t)) {
    failures.push(`${robotsRoute.rel}: missing Content-Signal header emission`)
  }
  if (!/`Content-Usage: \$\{CONTENT_USAGE\}`/.test(t)) {
    failures.push(
      `${robotsRoute.rel}: missing Content-Usage header emission (IETF standard-track)`,
    )
  }
  if (!/AI_TRAINING_CRAWLER_AGENTS/.test(t)) {
    failures.push(`${robotsRoute.rel}: missing AI training Disallow group`)
  }
}

if (failures.length) {
  console.error(`FAIL ${path.basename(root)} (crawler SEO)`)
  for (const f of failures) console.error(`  - ${f}`)
  process.exit(1)
}

console.log(`OK ${path.basename(root)} (crawler SEO — header integrity)`)

