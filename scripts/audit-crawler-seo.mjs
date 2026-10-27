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

function readAllExisting(relPaths) {
  const found = []
  for (const rel of relPaths) {
    const full = path.join(root, rel)
    if (fs.existsSync(full)) found.push({ rel, text: fs.readFileSync(full, "utf8") })
  }
  return found
}

// Global project apex host resolution for Project Domain Zero-Exposure assertions
const globalSiteUrlFile = readIfExists([
  "lib/site-url.ts",
  "src/lib/site-url.ts",
  "lib/brand-config.ts",
  "src/lib/brand-config.ts",
])
let projectCanonicalHost = ""
if (globalSiteUrlFile) {
  const m = globalSiteUrlFile.text.match(/SITE_ORIGIN\s*=\s*["']https?:\/\/([^"'/]+)/i)
  if (m) projectCanonicalHost = m[1].toLowerCase().trim()
}
const projectApexHost = projectCanonicalHost ? projectCanonicalHost.replace(/^www\./, "") : ""

/**
 * Resolve SITE_DISPLAY_NAME for Google site-name / PROBE G.7g asserts.
 * Follows common kit aliases: literal string, PROJECT_DISPLAY_NAME, BRAND_FULL_SITE_NAME.
 */
function resolveSiteDisplayName() {
  const siteUrl = readIfExists(["lib/site-url.ts", "src/lib/site-url.ts"])
  const projectConfig = readIfExists([
    "lib/project-config.ts",
    "src/lib/project-config.ts",
  ])
  const brandConfig = readIfExists(["lib/brand-config.ts", "src/lib/brand-config.ts"])

  const literalFrom = (text, constName) => {
    if (!text) return null
    const m = text.match(
      new RegExp(
        `(?:export\\s+)?const\\s+${constName}\\s*=\\s*(?:["'\`]([^"'\`]+)["'\`]|([A-Za-z_][A-Za-z0-9_]*))`,
      ),
    )
    if (!m) return null
    if (m[1]) return m[1].trim()
    return m[2] ? { alias: m[2] } : null
  }

  /** Expand simple `${CONST}` / `${A} ${B}` templates via known brand/project aliases. */
  const expandTemplate = (raw, depth = 0) => {
    if (!raw || depth > 6) return null
    if (!/\$\{[A-Za-z_][A-Za-z0-9_]*\}/.test(raw)) return raw
    let out = raw
    const tokens = [...raw.matchAll(/\$\{([A-Za-z_][A-Za-z0-9_]*)\}/g)]
    for (const t of tokens) {
      const via = resolveAlias(t[1], depth + 1)
      if (typeof via !== "string") return null
      out = out.split(t[0]).join(via)
    }
    return expandTemplate(out, depth + 1)
  }

  const resolveAlias = (alias, depth = 0) => {
    if (depth > 6) return null
    for (const file of [projectConfig, brandConfig, siteUrl]) {
      if (!file) continue
      const lit = literalFrom(file.text, alias)
      if (typeof lit === "string") {
        if (/\$\{[A-Za-z_][A-Za-z0-9_]*\}/.test(lit)) {
          const expanded = expandTemplate(lit, depth + 1)
          if (expanded) return expanded
          continue
        }
        return lit
      }
      if (lit?.alias) return resolveAlias(lit.alias, depth + 1)
    }
    return null
  }

  if (siteUrl) {
    const raw = literalFrom(siteUrl.text, "SITE_DISPLAY_NAME")
    if (typeof raw === "string") return raw
    if (raw?.alias) {
      const via = resolveAlias(raw.alias)
      if (via) return via
    }
  }
  for (const name of ["PROJECT_DISPLAY_NAME", "BRAND_FULL_SITE_NAME", "BRAND_SITE_NAME"]) {
    const via = resolveAlias(name)
    if (via) return via
  }
  return null
}

const SITE_DISPLAY_NAME_RESOLVED = resolveSiteDisplayName()

const walk = (dir) => {
  if (!fs.existsSync(dir)) return []
  const out = []
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) out.push(...walk(full))
    else out.push(full)
  }
  return out
}

/** Strip block + line comments so prose cannot satisfy a code check. */
function code(text) {
  return text
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/(^|[^:])\/\/[^\n]*/g, "$1")
}

const failures = []

// SITE_ORIGIN www lock (parity with check-canonical-domain.mjs / Bing empty-index class).
// Apex SITE_ORIGIN while Vercel primary is www → sitemap/canonical point at a 308 host;
// Bing may store the empty redirect body as "indexed". Opt out: SITE_ORIGIN_ALLOW_APEX=1.
if (
  projectCanonicalHost &&
  projectCanonicalHost !== "localhost" &&
  !projectCanonicalHost.startsWith("www.") &&
  process.env.SITE_ORIGIN_ALLOW_APEX !== "1"
) {
  failures.push(
    `${globalSiteUrlFile?.rel ?? "lib/site-url.ts"}: SITE_ORIGIN hostname must start with www. (got ${projectCanonicalHost}). ` +
      `Paste the Vercel Domains Primary Host (HTTP 200), usually https://www.<domain>. ` +
      `If apex is intentionally primary, set SITE_ORIGIN_ALLOW_APEX=1 for this build.`,
  )
}

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

// Astro Hybrid detection — `/` and the crawler twin are pre-built static files
// rewritten by the middleware, so several Next-only invariants (the layout
// crawler branch, `CrawlerSeoPage`) are DELETED BY DESIGN and must not be
// required. The Astro chain carries the equivalent checks instead.
const astroLanding = readIfExists([
  "Astro Hybrid/astro-src/pages/index.astro",
  "astro-src/pages/index.astro",
])
const astroTwin = readIfExists([
  "Astro Hybrid/astro-src/pages/crawler-seo.astro",
  "astro-src/pages/crawler-seo.astro",
])
const astroSeoHead = readIfExists([
  "Astro Hybrid/astro-src/components/seo-head.astro",
  "astro-src/components/seo-head.astro",
])
const isAstro = Boolean(astroLanding || astroTwin)

const layout = readIfExists([
  "app/layout.tsx",
  "src/app/layout.tsx",
  "app/layout.jsx",
  "src/app/layout.jsx",
])

if (!layout) {
  failures.push("missing app/layout.tsx")
} else if (!isAstro) {
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
    // Google site-name point 2 / PROBE G.7g: platform-only welcome H1 omits employer brand
    const inner = h1.replace(/<\/?h1\b[^>]*>/gi, "")
    if (
      /\{WELCOME_TITLE\}/.test(inner) &&
      !/PAGE_H1_HEADING|SITE_DISPLAY_NAME/.test(inner)
    ) {
      failures.push(
        `${crawlerPage.rel}: <h1> uses {WELCOME_TITLE} alone — must use {PAGE_H1_HEADING} or include {SITE_DISPLAY_NAME} (Google site-name point 2 / Testing 3 PROBE G.7g; "Welcome to Alight"-class H1 fails brand consensus)`,
      )
    }
  }
}

// Anti-degradation: WebSite JSON-LD alternateName shape.
// Google site names doc (fallback #2) RECOMMENDS the bare lowercase domain as the
// LAST alternateName. Enforce that shape instead of merely banning the host:
//   - brand phrases first
//   - bare lowercase host LAST (never a raw URL)
// Both JSON-LD component filenames ship in the wild — check whichever exist, so a
// project using `seo-json-ld.tsx` is not silently skipped.
const structuredDataFiles = [
  "components/structured-data.tsx",
  "src/components/structured-data.tsx",
  "components/seo-json-ld.tsx",
  "src/components/seo-json-ld.tsx",
]
  .map((rel) => ({ rel, full: path.join(root, rel) }))
  .filter((f) => fs.existsSync(f.full))
  .map((f) => ({ rel: f.rel, text: fs.readFileSync(f.full, "utf8") }))

// Accept the three shapes projects use to build the bare-lowercase host:
//   A) inline        canonicalHostFromOrigin().toLowerCase()
//   B) via variable  const host = canonicalHostFromOrigin() … host.toLowerCase()
//   C) precomputed  const HOST_FALLBACK = new URL(SITE_ORIGIN).hostname.toLowerCase()
//                    … alternateName: [..., HOST_FALLBACK]
const HOST_SOURCE = String.raw`(?:canonicalHostFromOrigin\s*\(\s*\)|CANONICAL_HOST[A-Z_]*|new URL\([^)]*\)\.hostname|\bhostname\b)`
const inlineHostRe = new RegExp(`${HOST_SOURCE}\\s*\\.toLowerCase\\(\\)`, "g")
const hostVarDeclRe = new RegExp(
  String.raw`const\s+([A-Za-z_$][\w$]*)\s*=\s*[^;\n]*${HOST_SOURCE}`,
  "g",
)
const varHostRe = new RegExp(
  String.raw`\b([A-Za-z_$][\w$]*)\s*\.\s*toLowerCase\s*\(\s*\)`,
  "g",
)
const bareHostVarRe = new RegExp(String.raw`\b([A-Za-z_$][\w$]*)\b`, "g")

for (const sd of structuredDataFiles) {
  const dataCode = sd.text.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*/g, "")
  if (!/alternateName/.test(dataCode)) continue

  const hostVars = new Set(
    [...code(sd.text).matchAll(hostVarDeclRe)].map((m) => m[1]),
  )

  if (/alternateName[\s\S]{0,400}https?:\/\//i.test(dataCode)) {
    failures.push(
      `${sd.rel}: alternateName must not contain a raw URL — use the bare lowercase host as the last entry only`,
    )
    continue
  }

  // Host must be PRESENT as the last entry. Locate the array/builder feeding
  // alternateName and require a host expression after the last brand phrase.
  const altIdx = dataCode.indexOf("alternateName")
  const tail = dataCode.slice(altIdx, altIdx + 500)
  // alternateName is one of: a builder CALL `buildAlternateNames()`, a spread of
  // one `[...buildAlternateNames()]`, or an inline array (possibly spreading a
  // named const). The call form REQUIRES the paren — an optional `(` would also
  // match a bare `[...SOME_CONST]` and then read the rest of the file.
  const builderCall = /alternateName\s*:\s*\[?\s*(?:\.\.\.\s*)?([A-Za-z_$][\w$]*)\s*\(/.exec(tail)
  let inspected = tail
  if (builderCall) {
    const builderRe = new RegExp(
      String.raw`(?:function|const)\s+${builderCall[1]}[\s\S]{0,2000}?\n\}`,
    )
    const body = builderRe.exec(dataCode)
    if (body) inspected = body[0]
  } else {
    const altArray = /alternateName\s*:\s*\[([\s\S]*?)\]/.exec(tail)
    if (altArray) {
      inspected = altArray[1]
      // `alternateName: [...SCHEMA_ALTERNATE_NAMES, host…]` — resolve the named
      // const and PREPEND it so both the spread list and the inline remainder
      // (which may itself carry the trailing host) are inspected in order.
      const spread = /\.\.\.\s*([A-Za-z_$][\w$]*)/.exec(inspected)
      if (spread) {
        const constRe = new RegExp(
          String.raw`(?:export\s+)?const\s+${spread[1]}\s*(?::[^=\n]+)?=\s*\[([\s\S]*?)\]\s*(?:as\s+const)?`,
        )
        const constBody = constRe.exec(dataCode)
        if (constBody) {
          const inlineRest = inspected.replace(/\.\.\.\s*[A-Za-z_$][\w$]*/, "").replace(/^\s*,/, "")
          inspected = constBody[1] + "\n" + inlineRest
        }
      }
    }
  }

  // Last host-ish reference inside the inspected region.
  let lastHostIdx = -1
  for (const m of inspected.matchAll(inlineHostRe)) lastHostIdx = Math.max(lastHostIdx, m.index)
  for (const m of inspected.matchAll(varHostRe)) {
    if (hostVars.has(m[1])) lastHostIdx = Math.max(lastHostIdx, m.index)
  }
  for (const m of inspected.matchAll(bareHostVarRe)) {
    // Precomputed lowercase const referenced as the final array entry.
    if (hostVars.has(m[1]) && /FALLBACK|HOST/i.test(m[1])) {
      const decl = new RegExp(
        String.raw`const\s+${m[1]}\s*=\s*[^;\n]*${HOST_SOURCE}[^;\n]*\.toLowerCase\(\)`,
      ).test(dataCode)
      if (decl) lastHostIdx = Math.max(lastHostIdx, m.index)
    }
  }

  // If host fallback is included, it must be the last entry (brand phrases first).
  // Projects may also choose clean brand-only alternateName arrays to prevent Google
  // from falling back to displaying the domain name as the sitename.
  if (lastHostIdx !== -1) {
    const after = inspected.slice(lastHostIdx)
    if (/"[^"]{2,}"|'[^']{2,}'/.test(after.replace(/\/\/.*/g, ""))) {
      failures.push(
        `${sd.rel}: alternateName entries after the bare host — the host must be the LAST entry (brand phrases first)`,
      )
    }
  }
}

// Anti-degradation: descriptions must not contain raw URLs or "sign in at <domain>"
const descCheckSources = readAllExisting([
  "lib/meta-description.ts",
  "src/lib/meta-description.ts",
  "lib/brand-config.ts",
  "src/lib/brand-config.ts",
  "lib/seo-metadata.ts",
  "src/lib/seo-metadata.ts",
])

for (const sourceFile of descCheckSources) {
  const metaCode = sourceFile.text.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*/g, "")
  if (
    /(?:sign\s+in\s+at|access\s+at|visit\s+at|portal\s+at)\s+[a-z0-9.-]+/i.test(metaCode) ||
    /(?:LAYOUT_DESCRIPTION|METADATA_DESCRIPTION|SITE_DESCRIPTION)\s*=\s*["'][^"']*(?:https?:\/\/|www\.|\b[a-z0-9-]+\.(?:com|org|net|edu|gov|io|co|app|xyz|biz|info)\b)/i.test(
      metaCode,
    )
  ) {
    failures.push(
      `${sourceFile.rel}: description must NOT contain raw domain URLs or "sign in at <domain>" — triggers Google site name degradation`,
    )
  }
  if (projectApexHost) {
    const escapedApex = projectApexHost.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
    const apexRe = new RegExp(
      `(?:LAYOUT_DESCRIPTION|METADATA_DESCRIPTION|SITE_DESCRIPTION)\\s*=\\s*["'][^"']*${escapedApex}`,
      "i",
    )
    if (apexRe.test(metaCode)) {
      failures.push(
        `${sourceFile.rel}: description contains project domain ("${projectApexHost}") — Project Domain Zero-Exposure requires domains to stay out of descriptions`,
      )
    }
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
  // Prefer action + delimiter + brand (Step 5 A13). Allow template literals /
  // concatenation forms that include SITE_DISPLAY_NAME and a delimiter.
  const titleAssign = t.match(/SITE_TITLE\s*=\s*([^;\n]+)/)
  if (titleAssign) {
    const expr = titleAssign[1]
    const hasDelim = /[`'"][^`'"]*[|:\-][^`'"]*[`'"]|\|\s*\$\{|\$\{[^}]+\}\s*[|\-:]/.test(
      expr,
    )
    if (!hasDelim && /SITE_DISPLAY_NAME\s*$/.test(expr.trim())) {
      failures.push(
        `${seoMetaCheck.rel}: SITE_TITLE must be <action> <delimiter> {SITE_DISPLAY_NAME} (30–60 chars) — brand-only titles get stripped by Google (A13 / Title-Link Failure)`,
      )
    }
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
  if (/`Host:\s*https?:\/\//i.test(robotsRoute.text) || /`Host:\s*\$\{SITE_ORIGIN\}`/.test(robotsRoute.text)) {
    failures.push(
      `${robotsRoute.rel}: Host directive must specify bare hostname without protocol scheme (e.g. Host: \${SITE_ORIGIN.replace(/^https?:\\/\\//, "")})`,
    )
  }
}

// origin-request-gate.ts ASN, feeds, and bot-verification checks
const originGate = readIfExists([
  "lib/bot-verification/origin-request-gate.ts",
  "src/lib/bot-verification/origin-request-gate.ts",
])

// If the middleware wires origin request gate, or lib/bot-verification exists,
// all bot-verification files, feeds, and code invariants MUST be present in the project.
const hasBotVerification = Boolean(
  originGate ||
  (mw && /origin-request-gate|evaluateOriginRequestGate|handleOriginGateIfNeeded/.test(mw.text)) ||
  fs.existsSync(path.join(root, "lib", "bot-verification")) ||
  fs.existsSync(path.join(root, "src", "lib", "bot-verification")),
)

if (hasBotVerification) {
  if (!originGate) {
    failures.push("missing lib/bot-verification/origin-request-gate.ts")
  } else {
    const t = code(originGate.text)
    if (!/AS8075/.test(t) || !/AS8068/.test(t) || !/AS8069/.test(t)) {
      failures.push(
        `${originGate.rel}: missing Microsoft Bing ASN fast-pass (AS8075, AS8068, AS8069)`,
      )
    }
    if (!/AS15169/.test(t) || !/AS396982/.test(t) || !/AS19527/.test(t)) {
      failures.push(
        `${originGate.rel}: missing Google ASN fast-pass (AS15169, AS396982, AS19527)`,
      )
    }
    if (!/verifyDnsBot/.test(t)) {
      failures.push(
        `${originGate.rel}: missing verifyDnsBot FCrDNS fallback for crawler verification`,
      )
    }
    if (!/pathname\s*===\s*["']\/["'][\s\S]*?return\s*\{\s*action:\s*["']allow["']\s*\}/.test(t)) {
      failures.push(
        `${originGate.rel}: missing search crawler fail-open on '/' (Googlebot zero-noindex invariant) — search crawlers on '/' must fail-open to CrawlerSeoPage instead of serving noindex`,
      )
    }
    if (
      /headers\.get\(\s*["']x-asn["']\s*\)/i.test(t) ||
      /headers\.get\(\s*["']cf-ipasnum["']\s*\)/i.test(t)
    ) {
      failures.push(
        `${originGate.rel}: must not read client-spoofable ASN headers (x-asn or cf-ipasnum) — only platform-verified headers like x-vercel-ip-as-number on Vercel`,
      )
    }
  }

  // Check multi-feed Googlebot IP ranges (must have >= 1000 prefixes to avoid GSC live inspection cloaking)
  const googlebotFeed = readIfExists([
    "lib/bot-verification/data/googlebot-ip-ranges.json",
    "src/lib/bot-verification/data/googlebot-ip-ranges.json",
  ])
  if (!googlebotFeed) {
    failures.push(
      "missing lib/bot-verification/data/googlebot-ip-ranges.json (required for crawler CIDR matching)",
    )
  } else {
    try {
      const parsed = JSON.parse(googlebotFeed.text)
      const count = Array.isArray(parsed?.prefixes) ? parsed.prefixes.length : 0
      if (count < 1000) {
        failures.push(
          `${googlebotFeed.rel}: has only ${count} prefixes — must contain >= 1000 prefixes unifying Googlebot, user-triggered-fetchers, special-crawlers, and common-crawlers to prevent Google Search Console live test cloaking`,
        )
      }
    } catch {
      failures.push(`${googlebotFeed.rel}: invalid JSON`)
    }
  }

  // Check DNS verify and IPv6 expansion
  const dnsVerify = readIfExists([
    "lib/bot-verification/dns-verify.ts",
    "src/lib/bot-verification/dns-verify.ts",
  ])
  if (!dnsVerify) {
    failures.push("missing lib/bot-verification/dns-verify.ts")
  } else {
    const t = code(dnsVerify.text)
    if (!/\.ip6\.arpa/.test(t)) {
      failures.push(
        `${dnsVerify.rel}: missing .ip6.arpa IPv6 reverse-DNS expansion for FCrDNS`,
      )
    }
  }

  // Check bot registry and SeznamBot
  const botRegistry = readIfExists([
    "lib/bot-verification/bot-registry.ts",
    "src/lib/bot-verification/bot-registry.ts",
  ])
  if (!botRegistry) {
    failures.push("missing lib/bot-verification/bot-registry.ts")
  } else {
    const t = code(botRegistry.text)
    if (!/seznambot/.test(t)) {
      failures.push(`${botRegistry.rel}: missing seznambot registry entry`)
    }
  }

  // client-ip.ts platform header verification
  const clientIpFile = readIfExists([
    "lib/client-ip.ts",
    "src/lib/client-ip.ts",
  ])
  if (!clientIpFile) {
    failures.push("missing lib/client-ip.ts")
  } else {
    const t = code(clientIpFile.text)
    if (!/isBehindCloudflare/.test(t)) {
      failures.push(
        `${clientIpFile.rel}: missing isBehindCloudflare check before trusting cf-connecting-ip`,
      )
    }
    if (!/13335/.test(t) || !/cf-ray/.test(t)) {
      failures.push(
        `${clientIpFile.rel}: isBehindCloudflare missing Vercel peer ASN (13335/209242) + cf-ray detection — required to uncloak Cloudflare-proxied search crawlers`,
      )
    }
  }

  // ErrorScreen icon alt attribute compliance (Bing Webmaster Tools requirement)
  const errorScreenFiles = [
    readIfExists(["components/ErrorScreen.tsx", "src/components/ErrorScreen.tsx"]),
    readIfExists(["lib/error-screen-html.ts", "src/lib/error-screen-html.ts"]),
  ].filter(Boolean)
  for (const ef of errorScreenFiles) {
    const t = ef.text
    if ((/alt=""/.test(t) || /alt=''/.test(t)) && /error-icon\.png/.test(t)) {
      failures.push(
        `${ef.rel}: error-icon.png has empty alt="" attribute — Bing Webmaster Tools requires descriptive alt (e.g. alt="Site offline notice")`,
      )
    }
  }
}

// React 19 Document Metadata & SVG Title Guard:
// Any <title> inside JSX gets hoisted to document.head > title on client hydration,
// clobbering the page/SERP title. SVG icons must use aria-label, not <title>.
const jsxFiles = [
  ...walk(path.join(root, "app")),
  ...walk(path.join(root, "src", "app")),
  ...walk(path.join(root, "components")),
  ...walk(path.join(root, "src", "components")),
  ...walk(path.join(root, "views")),
  ...walk(path.join(root, "src", "views")),
].filter((f) => /\.(jsx|tsx)$/.test(f) && !f.includes("node_modules"))

for (const file of jsxFiles) {
  try {
    const rawContent = fs.readFileSync(file, "utf8")
    const cleanContent = code(rawContent)
    if (/<title(\s+[^>]*)?>/i.test(cleanContent)) {
      const rel = path.relative(root, file)
      failures.push(
        `${rel}: JSX <title> tag found — React 19 hoists this to document head, clobbering page title. Replace with aria-label or <desc>`,
      )
    }
  } catch {}
}

// ---------------------------------------------------------------------------
// Code-level crawler allowlist leak sweep
// ---------------------------------------------------------------------------
// robots.txt (Part E row 6) is only half the surface: the SSR twin is served by
// code allowlists, so a training crawler leaking into one of these gets the full
// CrawlerSeoPage document. Deny-lists, labels and comments are legal — only the
// crawler-SERVING allowlists are checked.
const AI_TRAINING_TOKENS = [
  "ccbot",
  "commoncrawl",
  "meta-externalagent",
  "gptbot",
  "claudebot",
  "amazonbot",
  "cohere-training-data-crawler",
  "coherebot",
]

const allowlistSurfaces = [
  "lib/bot-detection.ts",
  "src/lib/bot-detection.ts",
  "utils/botDetection.ts",
  "src/utils/botDetection.ts",
  "lib/botDetection.ts",
  "src/lib/botDetection.ts",
  "middleware.ts",
  "src/middleware.ts",
  "proxy.ts",
  "src/proxy.ts",
  "components/protected-layout.tsx",
  "src/components/protected-layout.tsx",
]

for (const rel of allowlistSurfaces) {
  const full = path.join(root, rel)
  if (!fs.existsSync(full)) continue
  const src = code(fs.readFileSync(full, "utf8"))

  // Crawler-serving allowlist shapes: exported UA/pattern consts, BOT_PATTERNS
  // buckets, middleware local allow lists, and the protected-layout CRAWLER_PATTERN.
  const blocks = [
    ...src.matchAll(/export const \w*(?:UA|PATTERNS?)\s*=\s*(?:new RegExp\()?\/(?:[^\n]*?)\/[a-z]*/g),
    ...src.matchAll(/(?:const|let)\s+\w*(?:UA|PATTERNS?)\s*=\s*\/(?:[^\n]*?)\/[a-z]*/g),
    ...src.matchAll(/CRAWLER_PATTERN\s*=\s*(?:new RegExp\()?\/(?:[^\n]*?)\/[a-z]*/g),
  ].map((m) => m[0])

  if (!blocks.length) continue

  for (const token of AI_TRAINING_TOKENS) {
    const hit = blocks.find((b) => b.toLowerCase().includes(token))
    if (hit) {
      failures.push(
        `${rel}: AI training token "${token}" leaked into a crawler-serving allowlist (${hit.slice(0, 60).replace(/\s+/g, " ")}…) — training crawlers must never receive the SSR CrawlerSeoPage twin`,
      )
      break
    }
  }
}

// ---------------------------------------------------------------------------
// Visible/meta keyword split: body filtered, meta COMPLETE
// ---------------------------------------------------------------------------
// Robots.txt is not the only consumer of the keyword list. The full set must keep
// reaching `<meta name="keywords">` (Yandex still reads it) while the visible
// crawler body renders the host-filtered `SITE_VISIBLE_KEYWORDS` subset.
if (seoMetaCheck) {
  const metaT = code(seoMetaCheck.text)
  if (!/export const SITE_VISIBLE_KEYWORDS\s*(?::[^=\n]+)?=/.test(metaT)) {
    failures.push(
      `${seoMetaCheck.rel}: missing SITE_VISIBLE_KEYWORDS (body-safe subset — raw host tokens stay in <meta name="keywords"> only)`,
    )
  }
}

const keywordMetaSites = [
  layout,
  readIfExists(["components/seo-head.tsx", "src/components/seo-head.tsx"]),
].filter(Boolean)

if (keywordMetaSites.length && !keywordMetaSites.some((f) => /keywords\s*:\s*SITE_KEYWORDS/.test(code(f.text)))) {
  failures.push(
    `${keywordMetaSites[0].rel}: <meta name="keywords"> must carry the FULL SITE_KEYWORDS (host tokens meta-only in the crawler body — never deleted from the meta list)`,
  )
}

// ---------------------------------------------------------------------------
// Dependency resolution guard (npm ERESOLVE trap)
// ---------------------------------------------------------------------------
// react@19 + a dependency whose react peer range stops at 18 (e.g. vaul@0.9.9)
// makes `npm install` abort with ERESOLVE on Vercel before the build starts.
// pnpm only warns, so the guard applies to npm projects (no pnpm-lock.yaml).
const pkgPath = path.join(root, "package.json")
if (fs.existsSync(pkgPath)) {
  let pkg = null
  try {
    pkg = JSON.parse(fs.readFileSync(pkgPath, "utf8"))
  } catch {
    failures.push("package.json: unreadable — cannot verify dependency resolution")
  }

  if (pkg) {
    const usesPnpm =
      fs.existsSync(path.join(root, "pnpm-lock.yaml")) ||
      /pnpm/.test(String(pkg.packageManager ?? ""))
    const deps = { ...(pkg.dependencies ?? {}), ...(pkg.devDependencies ?? {}) }
    const reactRange = String(deps.react ?? "")
    const onReact19 = /(?:^|[^0-9])19/.test(reactRange)

    // Dependencies whose react peer range excludes 19. The installed package is
    // authoritative when present; otherwise fall back to known react<=18 lines.
    const suspectNames = []
    if (onReact19 && !usesPnpm) {
      for (const name of Object.keys(deps)) {
        const installed = path.join(root, "node_modules", name, "package.json")
        let peer = null
        if (fs.existsSync(installed)) {
          try {
            peer = JSON.parse(fs.readFileSync(installed, "utf8")).peerDependencies?.react ?? null
          } catch {
            peer = null
          }
        } else if (/^(vaul|react-day-picker)$/.test(name)) {
          peer = "^16.8.0 || ^17.0.0 || ^18.0.0"
        }
        // A peer range caps out below 19 only when it states an upper bound:
        // `^18`, `16 || 17 || 18`, `<19`. Open ranges (`>=16.8.0`, `*`) and
        // anything already mentioning 19 are satisfied by react 19.
        const capsBelow19 =
          /(?:^|\|)\s*[\^~]?1[0-8](?:\.[\dx*]+)?\s*(?:\|\||$)/.test(peer) ||
          /<\s*19/.test(peer)
        const mentions19 = /19/.test(peer)
        if (mentions19 || !capsBelow19) continue
        suspectNames.push(`${name}@${deps[name]}`)
      }
    }

    if (suspectNames.length) {
      const npmrcPath = path.join(root, ".npmrc")
      const hasLegacy =
        fs.existsSync(npmrcPath) &&
        /legacy-peer-deps\s*=\s*true/.test(fs.readFileSync(npmrcPath, "utf8"))
      if (!hasLegacy && !pkg.overrides) {
        failures.push(
          `package.json: react@${reactRange} with react<=18 peer dep(s) ${suspectNames.join(", ")} — CI "npm install" fails with ERESOLVE; add .npmrc "legacy-peer-deps=true" or a package.json "overrides" block`,
        )
      }
    }
  }
}

// ---------------------------------------------------------------------------
// Astro Hybrid chain — the head crawlers ACTUALLY receive.
// ---------------------------------------------------------------------------
// The Astro head is the production `<head>` for `/` and the crawler twin, so it
// is the one surface that was previously ungated: this script only ever read
// `app/layout.tsx` / `components/CrawlerSeoPage.tsx`, so a hardcoded brand or a
// divergent canonical here passed CI silently. These are the Step 5 A8 checks.
if (astroSeoHead) {
  const t = code(astroSeoHead.text)

  // 1. No foreign brand literal. This file IS the production head — a literal
  //    brand here ships to every crawler on every project cloned from the kit.
  const foreignBrands = [
    "Alight Solutions",
    "Alight Worklife",
    "State Farm",
    "Transamerica",
    "UPoint",
    "aptia365",
  ]
  for (const brand of foreignBrands) {
    if (t.includes(brand)) {
      failures.push(
        `${astroSeoHead.rel}: hardcoded brand "${brand}" — read SITE_DISPLAY_NAME instead (this head ships to crawlers)`,
      )
    }
  }

  // 2. Every name-bearing meta must derive from the one constant.
  for (const field of ["author", "creator", "publisher", "applicationName"]) {
    const re = new RegExp(`<meta\\s+name="${field}"\\s+content=\\{SITE_DISPLAY_NAME\\}`)
    if (new RegExp(`<meta\\s+name="${field}"`).test(t) && !re.test(t)) {
      failures.push(
        `${astroSeoHead.rel}: <meta name="${field}"> must use content={SITE_DISPLAY_NAME}`,
      )
    }
  }

  // 3. og:site_name must match the JSON-LD WebSite name (Google: one display string).
  if (!/og:site_name"\s+content=\{SITE_DISPLAY_NAME\}/.test(t)) {
    failures.push(
      `${astroSeoHead.rel}: og:site_name must use content={SITE_DISPLAY_NAME} (must match JSON-LD WebSite name)`,
    )
  }

  // 4. Canonical must equal the Next root-layout canonical constant. `SITE_ORIGIN`
  //    (no trailing slash) shipped a SECOND canonical for the same page.
  //    Accept either the constant inline or a local binding of it — what matters
  //    is which constant the binding resolves to.
  const canonical = /<link\s+rel="canonical"\s+href=\{(\w+)\}/.exec(t)
  if (!canonical) {
    failures.push(`${astroSeoHead.rel}: missing <link rel="canonical">`)
  } else if (canonical[1] !== "SITE_HOMEPAGE_CANONICAL") {
    const binding = new RegExp(
      `const\\s+${canonical[1]}\\s*=\\s*(SITE_HOMEPAGE_CANONICAL|SITE_ORIGIN)\\b`,
    ).exec(t)
    if (!binding) {
      failures.push(
        `${astroSeoHead.rel}: canonical binding "${canonical[1]}" must resolve to SITE_HOMEPAGE_CANONICAL — must match app/layout.tsx alternates.canonical`,
      )
    } else if (binding[1] !== "SITE_HOMEPAGE_CANONICAL") {
      failures.push(
        `${astroSeoHead.rel}: canonical must be SITE_HOMEPAGE_CANONICAL (got ${binding[1]}) — SITE_ORIGIN ships a second, conflicting canonical for the same page`,
      )
    }
  }

  // 5. og:url must not drift from the canonical either.
  if (!/og:url"\s+content=\{canonicalUrl\}/.test(t)) {
    failures.push(`${astroSeoHead.rel}: og:url must reuse the same canonicalUrl binding`)
  }

  // 6. Page must not smuggle a Next.js-only runtime global into static HTML.
  if (/next-size-adjust/.test(t)) {
    failures.push(
      `${astroSeoHead.rel}: drop <meta name="next-size-adjust"> — a Next runtime internal with no meaning in static Astro HTML`,
    )
  }

  // 7. No unstripped HTML developer comments in Astro head.
  if (/<!--\s*NO WEB APP MANIFEST/.test(astroSeoHead.text)) {
    failures.push(
      `${astroSeoHead.rel}: developer notes in head must use Astro comments {/* ... */} instead of HTML <!-- ... --> to prevent leaking internal documentation to public HTML`,
    )
  }
}

if (isAstro && !astroTwin) {
  failures.push("Astro landing present but missing astro-src/pages/crawler-seo.astro (crawler twin)")
}

// Astro twin source: H1 must not be platform-only WELCOME_TITLE (MARSH regression class).
if (astroTwin) {
  const twinCode = code(astroTwin.text)
  const h1Matches = twinCode.match(/<h1\b[^>]*>([\s\S]*?)<\/h1>/gi) ?? []
  for (const h1 of h1Matches) {
    const inner = h1.replace(/<\/?h1\b[^>]*>/gi, "")
    if (
      /\{WELCOME_TITLE\}/.test(inner) &&
      !/PAGE_H1_HEADING|SITE_DISPLAY_NAME/.test(inner)
    ) {
      failures.push(
        `${astroTwin.rel}: <h1> uses {WELCOME_TITLE} alone — must use {PAGE_H1_HEADING} or include {SITE_DISPLAY_NAME} (Google site-name point 2 / Testing 3 PROBE G.7g; platform-only H1 like "Welcome to Alight" fails brand consensus on the crawler twin bots read)`,
      )
    }
    if (/(?:https?:\/\/|[a-z0-9-]+\.(?:com|net|org|io|gov|edu|co))\b/i.test(h1)) {
      failures.push(
        `${astroTwin.rel}: <h1> must NOT contain raw domain URL — causes Google site name degradation to domain`,
      )
    }
  }
  if (
    h1Matches.length > 0 &&
    SITE_DISPLAY_NAME_RESOLVED &&
    !/PAGE_H1_HEADING|SITE_DISPLAY_NAME/.test(twinCode.match(/<h1\b[^>]*>([\s\S]*?)<\/h1>/i)?.[0] ?? "")
  ) {
    // Literal H1 text in source (no expression) must still contain the brand when present.
    const lit = (twinCode.match(/<h1\b[^>]*>([\s\S]*?)<\/h1>/i)?.[1] ?? "")
      .replace(/\{[^}]+\}/g, "")
      .replace(/<[^>]+>/g, "")
      .trim()
    if (lit && !lit.includes(SITE_DISPLAY_NAME_RESOLVED)) {
      failures.push(
        `${astroTwin.rel}: <h1> literal text must contain SITE_DISPLAY_NAME ("${SITE_DISPLAY_NAME_RESOLVED}") — Google site-name point 2 / Testing 3 PROBE G.7g (got "${lit.slice(0, 80)}")`,
      )
    }
  }
}

// Deleted-by-design: after the Astro conversion neither file may come back.
if (isAstro) {
  for (const rel of ["app/page.tsx", "components/CrawlerSeoPage.tsx"]) {
    for (const candidate of [rel, `src/${rel}`]) {
      if (fs.existsSync(path.join(root, candidate))) {
        failures.push(
          `${candidate}: must not exist in an Astro project — the landing + twin are Astro pages`,
        )
      }
    }
  }
}

// ---------------------------------------------------------------------------
// The NEXT half of the renderer split.
// Astro taking over `/` is not permission for the Next half to rot: middleware,
// `/api/*`, robots and sitemap must all still be Next and still reachable. These
// checks are the machine counterpart of the RENDERER OWNERSHIP block.
// ---------------------------------------------------------------------------
if (isAstro) {
  // app/layout.tsx must survive — it renders every non-Astro route.
  if (!layout) {
    failures.push(
      "app/layout.tsx missing in an Astro project — the remaining Next routes still render through it",
    )
  }

  // The rewrite must live in the middleware, after the gates.
  const middleware = readIfExists(["middleware.ts", "src/middleware.ts"])
  if (!middleware) {
    failures.push("missing middleware.ts — the Astro rewrite lives inside it")
  } else {
    if (!middleware.text.includes("index.html")) {
      failures.push("middleware missing the Astro landing rewrite (/index.html)")
    }
    if (!middleware.text.includes("crawler-seo.html")) {
      failures.push("middleware missing the Astro crawler-twin rewrite (/crawler-seo.html)")
    }
  }

  // At least one API route handler must still exist.
  const apiRoutes = [
    ...walk(path.join(root, "app", "api")),
    ...walk(path.join(root, "src", "app", "api")),
  ].filter((f) => /route\.(ts|tsx|js|jsx)$/.test(path.basename(f)))
  if (apiRoutes.length === 0) {
    failures.push("no app/api/**/route.* handlers — Next still owns every /api/* route")
  }

  // robots + sitemap may be a route OR a static file; either is valid.
  const anyExists = (...cands) => cands.some((c) => fs.existsSync(path.join(root, c)))
  if (
    !anyExists(
      "app/robots.txt/route.ts",
      "app/robots.ts",
      "app/robots.txt/route.js",
      "public/robots.txt",
      "src/app/robots.txt/route.ts",
    )
  ) {
    failures.push("robots.txt missing — Next owns it (route or public/robots.txt)")
  }
  if (
    !anyExists(
      "app/sitemap.ts",
      "app/sitemap.xml/route.ts",
      "app/sitemap.xml/route.js",
      "public/sitemap.xml",
      "src/app/sitemap.ts",
    )
  ) {
    failures.push("sitemap.xml missing — Next owns it (route or public/sitemap.xml)")
  }
}

// Built twin, when present, must carry the site name and the keyword block.
const builtTwin = readIfExists(["public/crawler-seo.html"])
if (builtTwin) {
  const t = builtTwin.text

  // Resolve project canonical host for Project Domain Zero-Exposure assertion
  const siteUrlFile = readIfExists([
    "lib/site-url.ts",
    "src/lib/site-url.ts",
    "lib/brand-config.ts",
    "src/lib/brand-config.ts",
  ])
  let canonicalHost = ""
  if (siteUrlFile) {
    const m = siteUrlFile.text.match(/SITE_ORIGIN\s*=\s*["']https?:\/\/([^"'/]+)/i)
    if (m) canonicalHost = m[1].toLowerCase().trim()
  }
  const apexHost = canonicalHost ? canonicalHost.replace(/^www\./, "") : ""

  if (!/<h1\b/i.test(t)) {
    failures.push(`${builtTwin.rel}: missing <h1> (crawler twin must SSR an H1)`)
  }

  // A13 Site Title Tag — parse built HTML (not source grep). Ignore SVG <title>.
  {
    const headMatch = t.match(/<head\b[^>]*>([\s\S]*?)<\/head>/i)
    if (!headMatch) {
      failures.push(
        `${builtTwin.rel}: missing <head> — cannot verify site title placement (A13)`,
      )
    } else {
      const headHtml = headMatch[1].replace(/<svg\b[\s\S]*?<\/svg>/gi, "")
      const titlesInHead = [...headHtml.matchAll(/<title\b[^>]*>([\s\S]*?)<\/title>/gi)]
      const bodyHtml = t.replace(/<head\b[^>]*>[\s\S]*?<\/head>/i, "")
      const titlesInBody = [
        ...bodyHtml
          .replace(/<svg\b[\s\S]*?<\/svg>/gi, "")
          .matchAll(/<title\b[^>]*>([\s\S]*?)<\/title>/gi),
      ]
      if (titlesInBody.length > 0) {
        failures.push(
          `${builtTwin.rel}: <title> found outside <head> — Bing/Google ignore body titles (A13 / Title-Link Failure)`,
        )
      }
      if (titlesInHead.length === 0) {
        failures.push(
          `${builtTwin.rel}: missing <title> inside <head> — SERP falls back to URL/anchors (A13)`,
        )
      } else if (titlesInHead.length > 1) {
        failures.push(
          `${builtTwin.rel}: ${titlesInHead.length} <title> tags in <head> — must be exactly one (A13)`,
        )
      } else {
        const titleText = titlesInHead[0][1].replace(/\s+/g, " ").trim()
        const len = titleText.length
        if (!titleText) {
          failures.push(`${builtTwin.rel}: empty <title> in <head> (A13)`)
        } else if (len < 30 || len > 60) {
          failures.push(
            `${builtTwin.rel}: <title> length ${len} chars (must be 30–60) — got "${titleText.slice(0, 70)}" (A13)`,
          )
        } else if (
          /MemberPortal_Site|Member login \| Example|Your Site Name|Example Benefits Portal/i.test(
            titleText,
          )
        ) {
          failures.push(
            `${builtTwin.rel}: placeholder <title> "${titleText}" must not ship (A13)`,
          )
        } else if (SITE_DISPLAY_NAME_RESOLVED) {
          const brand = SITE_DISPLAY_NAME_RESOLVED
          if (!titleText.includes(brand)) {
            failures.push(
              `${builtTwin.rel}: <title> must contain SITE_DISPLAY_NAME ("${brand}") — got "${titleText}" (A13)`,
            )
          } else if (titleText === brand || titleText === `${brand}.` || titleText === `${brand} `) {
            failures.push(
              `${builtTwin.rel}: brand-only <title> "${titleText}" — Google strips site-name duplicates; use <action> | {SITE_DISPLAY_NAME} (A13 / Title-Link Failure)`,
            )
          } else {
            const withoutBrand = titleText
              .replace(brand, "")
              .replace(/\s*[|:\-]\s*/g, " ")
              .trim()
            if (!withoutBrand || withoutBrand.length < 3) {
              failures.push(
                `${builtTwin.rel}: <title> needs a non-brand action/descriptive segment before/after delimiter — got "${titleText}" (A13)`,
              )
            }
            if (!/[|:\-]/.test(titleText)) {
              failures.push(
                `${builtTwin.rel}: <title> must use a pipe, hyphen, or colon delimiter between action and brand — got "${titleText}" (A13)`,
              )
            }
          }
        }
      }
    }
  }

  // Google site-name 1:1 brand harmonization on the HTML bots actually fetch (PROBE G.7g).
  if (SITE_DISPLAY_NAME_RESOLVED) {
    const brand = SITE_DISPLAY_NAME_RESOLVED
    const h1Raw = t.match(/<h1\b[^>]*>([\s\S]*?)<\/h1>/i)?.[1] ?? ""
    const h1Text = h1Raw.replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim()
    if (h1Text && !h1Text.includes(brand)) {
      failures.push(
        `${builtTwin.rel}: <h1> must contain SITE_DISPLAY_NAME ("${brand}") — Google site-name point 2 / Testing 3 PROBE G.7g (got "${h1Text.slice(0, 80)}"; platform-only titles like "Welcome to Alight" FAIL)`,
      )
    }
    const ogSite =
      t.match(
        /<meta\s+property=["']og:site_name["']\s+content=["']([^"']*)["']/i,
      ) ||
      t.match(
        /<meta\s+content=["']([^"']*)["']\s+property=["']og:site_name["']/i,
      )
    if (!ogSite) {
      failures.push(
        `${builtTwin.rel}: missing og:site_name meta (must equal SITE_DISPLAY_NAME "${brand}")`,
      )
    } else if (ogSite[1] !== brand) {
      failures.push(
        `${builtTwin.rel}: og:site_name must equal SITE_DISPLAY_NAME ("${brand}") — Google site-name point 2 (got "${ogSite[1]}")`,
      )
    }
    const ldBlocks = [...t.matchAll(/<script\s+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)]
    let webSiteName = null
    for (const block of ldBlocks) {
      try {
        const json = JSON.parse(block[1])
        const nodes = Array.isArray(json)
          ? json
          : json["@graph"]
            ? json["@graph"]
            : [json]
        for (const node of nodes) {
          if (node?.["@type"] === "WebSite" && typeof node.name === "string") {
            webSiteName = node.name
            break
          }
        }
      } catch {
        /* ignore malformed ld+json in twin */
      }
      if (webSiteName) break
    }
    if (webSiteName == null) {
      failures.push(
        `${builtTwin.rel}: missing JSON-LD WebSite.name (must equal SITE_DISPLAY_NAME "${brand}")`,
      )
    } else if (webSiteName !== brand) {
      failures.push(
        `${builtTwin.rel}: JSON-LD WebSite.name must equal SITE_DISPLAY_NAME ("${brand}") — Google site-name point 1/2 (got "${webSiteName}")`,
      )
    }
  } else if (/<h1\b/i.test(t)) {
    failures.push(
      `${builtTwin.rel}: could not resolve SITE_DISPLAY_NAME from lib/site-url.ts / project-config / brand-config — required for Google site-name H1 consensus check`,
    )
  }

  const metaDescTagMatch =
    t.match(/<meta\s+name=["']description["']\s+content=["']([^"']*)["']/i) ||
    t.match(/<meta\s+content=["']([^"']*)["']\s+name=["']description["']/i)
  if (!metaDescTagMatch) {
    failures.push(`${builtTwin.rel}: missing <meta name="description"> in crawler twin head`)
  } else {
    const renderedDesc = metaDescTagMatch[1].trim()
    if (renderedDesc.length < 120 || renderedDesc.length > 165) {
      failures.push(
        `${builtTwin.rel}: <meta name="description"> length is ${renderedDesc.length} chars (must be 120–165 to prevent Bing/Google short/truncated description warnings)`,
      )
    }
    if (
      /(?:https?:\/\/|www\.|\b[a-z0-9-]+\.(?:com|org|net|edu|gov|io|co|app|xyz|biz|info)\b)/i.test(
        renderedDesc,
      )
    ) {
      failures.push(
        `${builtTwin.rel}: <meta name="description"> contains a raw URL or domain — meta descriptions must be domain-agnostic to prevent duplicate domain display in search results`,
      )
    }
    if (apexHost && renderedDesc.toLowerCase().includes(apexHost.toLowerCase())) {
      failures.push(
        `${builtTwin.rel}: <meta name="description"> contains project domain ("${apexHost}") — Project Domain Zero-Exposure requires domains to stay out of descriptions`,
      )
    }
  }
  if (!/Related searches:/i.test(t)) {
    failures.push(`${builtTwin.rel}: missing visible "Related searches:" body block`)
  }
  if (/NO WEB APP MANIFEST/.test(t)) {
    failures.push(`${builtTwin.rel}: unstripped developer comment found in public HTML head`)
  }
  // All images on crawler twin must have descriptive non-empty alt attributes (Bing requirement)
  const emptyAltImg = t.match(/<img\b[^>]*\balt=["']\s*["'][^>]*>/gi)
  if (emptyAltImg) {
    failures.push(
      `${builtTwin.rel}: found <img> with empty alt="" attribute (${emptyAltImg[0].slice(0, 50)}) — Bing requires descriptive alt text on all images`,
    )
  }
  // Zero-JS: only application/ld+json may be executable.
  const scripts = t.match(/<script\b[^>]*>/gi) ?? []
  for (const tag of scripts) {
    if (!/application\/ld\+json/i.test(tag) && !/^\s*<\/script>/i.test(tag)) {
      if (!/type=["']?module["']?/i.test(tag)) {
        failures.push(
          `${builtTwin.rel}: crawler twin must ship ZERO JavaScript (only application/ld+json) — found ${tag.slice(0, 60)}`,
        )
      }
    }
  }

  // SSR Body richness check: crawler twin body must contain ≥ 300 words of indexable copy to prevent Google thin-content deindexing
  const bodyMatch = t.match(/<body\b[^>]*>([\s\S]*?)<\/body>/i)
  if (bodyMatch) {
    const bodyInner = bodyMatch[1]
    const textOnly = bodyInner
      .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, "")
      .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, "")
      .replace(/<[^>]+>/g, " ")
      .replace(/&[a-z0-9#]+;/gi, " ")
      .replace(/\s+/g, " ")
      .trim()
    const wordCount = textOnly ? textOnly.split(/\s+/).filter(Boolean).length : 0
    if (wordCount < 300) {
      failures.push(
        `${builtTwin.rel}: crawler twin body contains only ${wordCount} words (minimum quota: ≥ 300 words required to prevent Google thin content de-indexing)`,
      )
    }

    // Project Domain Zero-Exposure & SERP Hygiene Assertions:
    // Google & Bing display the domain in Layer 2 above the title snippet.
    // The project's own domain or URL must NEVER appear in the visible text of <body>.
    if (apexHost) {
      const escapedApex = apexHost.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
      const hostRegex = new RegExp(`(?:https?:\\/\\/)?(?:www\\.)?${escapedApex}\\b`, "i")
      if (hostRegex.test(textOnly)) {
        failures.push(
          `${builtTwin.rel}: visible body text contains project's own domain ("${apexHost}") — Project Domain Zero-Exposure requires domains to stay out of visible copy, H1, and breadcrumbs to prevent SERP duplication and automated Google/Bing rewrites`,
        )
      }
    }

    if (/\b[a-z0-9-]+\.vercel\.app\b/i.test(textOnly)) {
      failures.push(
        `${builtTwin.rel}: visible body text contains a temporary staging/Vercel domain (*.vercel.app) — remove staging domains from public copy`,
      )
    }

    // Image alt attribute domain hygiene:
    const imgMatches = [...bodyInner.matchAll(/<img\b[^>]*\balt=["']([^"']*)["'][^>]*>/gi)]
    for (const [, altText] of imgMatches) {
      if (apexHost && altText.toLowerCase().includes(apexHost)) {
        failures.push(
          `${builtTwin.rel}: <img> alt attribute ("${altText}") contains project domain ("${apexHost}") — use descriptive entity text without raw URLs`,
        )
      }
      if (/\b[a-z0-9-]+\.vercel\.app\b/i.test(altText)) {
        failures.push(
          `${builtTwin.rel}: <img> alt attribute ("${altText}") contains temporary staging domain (*.vercel.app)`,
        )
      }
    }

    // Root-relative asset paths check:
    const assetSrcMatches = [...bodyInner.matchAll(/<(?:img|source|link)\b[^>]*\b(?:src|href)=["']([^"']*)["'][^>]*>/gi)]
    for (const [, srcUrl] of assetSrcMatches) {
      if (apexHost && (srcUrl.toLowerCase().includes(`://${apexHost}`) || srcUrl.toLowerCase().includes(`://www.${apexHost}`))) {
        failures.push(
          `${builtTwin.rel}: internal asset/media uses absolute project URL ("${srcUrl.slice(0, 80)}") — must use root-relative paths (e.g. /logo.svg) to prevent mixed-content and domain lock-in`,
        )
      }
    }
  }

  // Visible keywords density check: "Related searches:" must contain substantial keywords (minimum ≥ 25 terms)
  const relSearchesMatch = t.match(/Related searches:\s*([^<]+)/i)
  if (relSearchesMatch) {
    const kwList = relSearchesMatch[1].split(",").map((k) => k.trim()).filter(Boolean)
    if (kwList.length < 25) {
      failures.push(
        `${builtTwin.rel}: "Related searches:" contains only ${kwList.length} keywords (minimum quota: ≥ 25 visible terms required, target 50–100+)`,
      )
    }
  }

  // Zero-JS FAQ Accordion check: crawler twin must contain ≥ 5 <details> and <summary> blocks with FAQPage schema
  const detailsCount = (t.match(/<details\b/gi) || []).length
  const summaryCount = (t.match(/<summary\b/gi) || []).length
  if (detailsCount < 5 || summaryCount < 5) {
    failures.push(
      `${builtTwin.rel}: crawler twin contains only ${detailsCount} <details> accordions (minimum quota: ≥ 5 native zero-JS FAQ accordions required for SERP rich snippet dominance)`,
    )
  }
  if (!t.includes('"@type":"FAQPage"') && !t.includes('"@type": "FAQPage"')) {
    failures.push(
      `${builtTwin.rel}: missing Schema.org "FAQPage" JSON-LD structured data (required for Google rich snippet accordion cards)`,
    )
  }

  // Mandatory 5-block DOM architecture: Overview heading
  const hasOverviewHeading = /<h[2-4]\b[^>]*>[\s\S]*?(?:overview|about|portal\s+summary|portal\s+information)[\s\S]*?<\/h[2-4]>/i.test(t)
  if (!hasOverviewHeading) {
    failures.push(
      `${builtTwin.rel}: missing semantic Overview heading (<h2>...Overview...</h2> required in 5-block architecture for all archetypes)`,
    )
  }

  // Mandatory 5-block DOM architecture: Domain services bulleted list (≥ 3 <li> items)
  const hasServicesHeading = /<h[2-4]\b[^>]*>[\s\S]*?(?:services|programs|offerings|features|benefits|coverage|solutions)[\s\S]*?<\/h[2-4]>/i.test(t)
  if (!hasServicesHeading) {
    failures.push(
      `${builtTwin.rel}: missing semantic Domain Services heading (<h2>...Services/Programs/Benefits...</h2> required in 5-block architecture)`,
    )
  }
  const ulLists = t.match(/<ul\b[^>]*>([\s\S]*?)<\/ul>/gi) ?? []
  let maxLiCount = 0
  for (const ul of ulLists) {
    const lis = (ul.match(/<li\b/gi) || []).length
    if (lis > maxLiCount) maxLiCount = lis
  }
  if (maxLiCount < 3) {
    failures.push(
      `${builtTwin.rel}: domain services section must include a bulleted <ul> with ≥ 3 <li> items (found max list depth: ${maxLiCount})`,
    )
  }

  // Mandatory 5-block DOM architecture: Support section heading
  const hasSupportHeading = /<h[2-4]\b[^>]*>[\s\S]*?(?:support|help|assistance|customer\s+service|contact)[\s\S]*?<\/h[2-4]>/i.test(t)
  if (!hasSupportHeading) {
    failures.push(
      `${builtTwin.rel}: missing Member Support heading (<h2>...Support/Help...</h2> required in 5-block architecture)`,
    )
  }

  // FAQ 1:1 Schema Parity: Accordion questions must match FAQPage JSON-LD schema questions
  if (detailsCount >= 5 && (t.includes('"FAQPage"') || t.includes("FAQPage"))) {
    const summaryTexts = [...t.matchAll(/<summary\b[^>]*>([\s\S]*?)<\/summary>/gi)].map((m) => {
      return m[1].replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim().toLowerCase()
    })

    const jsonLdBlocks = [...t.matchAll(/<script\b[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)]
    let schemaQuestions = []
    for (const block of jsonLdBlocks) {
      try {
        const data = JSON.parse(block[1])
        const checkFaq = (obj) => {
          if (!obj) return
          if (obj["@type"] === "FAQPage" && Array.isArray(obj.mainEntity)) {
            for (const item of obj.mainEntity) {
              if (item.name) schemaQuestions.push(item.name.toLowerCase().trim())
            }
          }
          if (Array.isArray(obj["@graph"])) {
            for (const entity of obj["@graph"]) checkFaq(entity)
          }
        }
        checkFaq(data)
      } catch {}
    }

    if (schemaQuestions.length > 0) {
      let matchedCount = 0
      for (const sq of schemaQuestions) {
        const sqNorm = sq.replace(/[^a-z0-9]/g, "")
        if (
          summaryTexts.some((st) => {
            const stNorm = st.replace(/[^a-z0-9]/g, "")
            return stNorm.includes(sqNorm) || sqNorm.includes(stNorm)
          })
        ) {
          matchedCount++
        }
      }
      if (matchedCount < 4) {
        failures.push(
          `${builtTwin.rel}: FAQ accordions do not match FAQPage JSON-LD questions (found ${matchedCount} matches out of ${schemaQuestions.length}; 1:1 parity required to prevent schema drift)`,
        )
      }
    }
  }

  // Foolproof Dynamic Link Discovery & Reconciliation Assertion:
  // Asserts same-window navigation, zero dead hashes (#), zero javascript:,
  // zero unhandled local 404 paths, and accessible anchor text across ALL links in crawler twin.
  const fullLinkRegex = /<a\b([^>]*)>([\s\S]*?)<\/a>/gi
  const linkMatches = [...t.matchAll(fullLinkRegex)]

  for (const [, attributes, linkContent] of linkMatches) {
    // 1. Same-Window Navigation Invariant: NEVER allow target="_blank"
    if (/\btarget\s*=\s*["']_blank["']/i.test(attributes)) {
      failures.push(
        `${builtTwin.rel}: link contains target="_blank" — all links on crawler twin must open in the same window (target="_self" or default) to preserve in-window crawler and user navigation`,
      )
    }

    // Extract href
    const hrefMatch = attributes.match(/\bhref\s*=\s*["']([^"']*)["']/i)
    if (!hrefMatch) {
      failures.push(`${builtTwin.rel}: <a> tag missing href attribute`)
      continue
    }

    const trimmedHref = hrefMatch[1].trim()
    const textLabel = linkContent.replace(/<[^>]+>/g, "").trim()
    const ariaLabelMatch = attributes.match(/\baria-label\s*=\s*["']([^"']*)["']/i)
    const ariaLabel = ariaLabelMatch ? ariaLabelMatch[1].trim() : ""

    // 2. Accessible Anchor Invariant: must have text content or aria-label
    if (!textLabel && !ariaLabel) {
      failures.push(
        `${builtTwin.rel}: link (${trimmedHref}) has no discernible text or aria-label — Lighthouse and search engines flag empty links`,
      )
    }

    // 3. Zero Dead Stubs Invariant: no bare '#' or 'javascript:'
    if (trimmedHref === "#" || trimmedHref === "" || trimmedHref.startsWith("javascript:")) {
      failures.push(
        `${builtTwin.rel}: link "${textLabel || ariaLabel || trimmedHref}" uses dead href="${trimmedHref}" — must route to authentic URL, root '/', in-page '#id', or /api/login-out`,
      )
      continue
    }

    // 4. In-Page Anchor ID Integrity: e.g. '#section-faq' must exist as id="section-faq"
    if (trimmedHref.startsWith("#")) {
      const anchorId = trimmedHref.slice(1)
      if (anchorId) {
        const idRegex = new RegExp(`\\bid=["']${anchorId}["']`, "i")
        if (!idRegex.test(t)) {
          failures.push(
            `${builtTwin.rel}: in-page anchor href="${trimmedHref}" has no matching element with id="${anchorId}" in document`,
          )
        }
      }
      continue
    }

    // 5. Permitted External & Root Destinations:
    // - Root navigation: '/'
    // - Managed redirect fallback: '/api/login-out' or any '/api/*'
    // - Secure External URLs: 'https://...', 'http://...', 'mailto:...', 'tel:...'
    if (
      trimmedHref === "/" ||
      trimmedHref.startsWith("/api/login-out") ||
      trimmedHref.startsWith("/api/")
    ) {
      continue
    }

    if (
      trimmedHref.startsWith("https://") ||
      trimmedHref.startsWith("http://") ||
      trimmedHref.startsWith("mailto:") ||
      trimmedHref.startsWith("tel:")
    ) {
      // Security & Dev Leak Check: never link to localhost or staging ports
      if (/https?:\/\/(?:localhost|127\.0\.0\.1)(?::\d+)?/i.test(trimmedHref)) {
        failures.push(
          `${builtTwin.rel}: external link "${trimmedHref}" references localhost/dev environment — authentic target or production URLs required`,
        )
      }
      if (
        apexHost &&
        (trimmedHref.toLowerCase().includes(`://${apexHost}`) ||
         trimmedHref.toLowerCase().includes(`://www.${apexHost}`))
      ) {
        failures.push(
          `${builtTwin.rel}: link uses absolute project URL "${trimmedHref}" — must use root-relative paths ("/" or "/api/login-out") to maintain domain portability and prevent staging leakage`,
        )
      }
      if (/\b[a-z0-9-]+\.vercel\.app\b/i.test(trimmedHref)) {
        failures.push(
          `${builtTwin.rel}: link "${trimmedHref}" references a temporary staging/Vercel domain (*.vercel.app)`,
        )
      }
      continue
    }

    // 6. Relative Internal Paths: Check if file exists on disk
    // If someone links to '/privacy', check if app/privacy/page.tsx or public/privacy.html exists
    const cleanPath = trimmedHref.replace(/^\//, "").split("?")[0].split("#")[0]
    const existsOnDisk =
      fs.existsSync(path.join(root, "app", cleanPath, "page.tsx")) ||
      fs.existsSync(path.join(root, "app", cleanPath, "page.jsx")) ||
      fs.existsSync(path.join(root, "pages", cleanPath + ".tsx")) ||
      fs.existsSync(path.join(root, "pages", cleanPath + ".jsx")) ||
      fs.existsSync(path.join(root, "public", cleanPath)) ||
      fs.existsSync(path.join(root, "public", cleanPath + ".html"))

    if (!existsOnDisk) {
      failures.push(
        `${builtTwin.rel}: link "${textLabel || ariaLabel}" uses unresolved relative path "${trimmedHref}" that does not exist in the project — must route via /api/login-out or resolve to authentic destination to prevent 404 crawl errors`,
      )
    }
  }
}

// Domain-agnostic meta description: no raw URLs or duplicate domains in LAYOUT_DESCRIPTION
const metaDescFiles = readAllExisting([
  "lib/meta-description.ts",
  "src/lib/meta-description.ts",
  "lib/brand-config.ts",
  "src/lib/brand-config.ts",
])
for (const metaDescFile of metaDescFiles) {
  const descText = metaDescFile.text.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*/g, "")
  if (
    /(?:LAYOUT_DESCRIPTION|METADATA_DESCRIPTION)\s*=\s*["'][^"']*(?:https?:\/\/|www\.|\b[a-z0-9-]+\.(?:com|org|net|edu|gov|io|co|app|xyz|biz|info)\b)/i.test(
      descText,
    )
  ) {
    failures.push(
      `${metaDescFile.rel}: description contains a raw URL or domain — meta descriptions must be domain-agnostic to prevent duplicate domain display in search results`,
    )
  }
  if (projectApexHost) {
    const escapedApex = projectApexHost.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
    const apexRe = new RegExp(
      `(?:LAYOUT_DESCRIPTION|METADATA_DESCRIPTION)\\s*=\\s*["'][^"']*${escapedApex}`,
      "i",
    )
    if (apexRe.test(descText)) {
      failures.push(
        `${metaDescFile.rel}: description contains project domain ("${projectApexHost}") — Project Domain Zero-Exposure requires domains to stay out of descriptions`,
      )
    }
  }
}

// Silent twin / no crawl-only signifiers — comments must never announce that the
// page is inert, non-functional, crawl-only, a clone, or "never served to humans".
// Form controls may still be disabled/readonly; only the announcing prose is banned.
// README mock-up framing is required only when this project ships a twin surface.
{
  const SIGNIFIER_RE =
    /inert\s+form|INERT\s+FORM|inert\s+login|inert\s+sign-?in|inert\s+replica|nothing can submit|nothing runs|every control disabled|all (?:inputs|controls) disabled|disabled\/readonly|no action,\s*no (?:method|submit)|no implicit submit|cloned from|clone of|server-rendered clone|login clone|static twin|visual twin|crawler twin|CRAWLER SEO TWIN|Crawler SEO twin|AUTHENTIC SHELL|zero-?JS twin|Zero-JS twin|SSR replica|static replica|SSR lookalike|truthful static twin|NEVER served to humans|for allowlisted crawlers|meant for crawling|for crawlers only|crawler only|non-functional|mirrors UserIdStep|WHAT THIS PAGE IS|fails the zero-JS audit/i

  const twinTargets = [
    ...readAllExisting([
      "astro-src/pages/crawler-seo.astro",
      "src/astro-src/pages/crawler-seo.astro",
      "public/crawler-seo.html",
      "components/CrawlerSeoPage.tsx",
      "src/components/CrawlerSeoPage.tsx",
    ]),
  ]

  for (const file of twinTargets) {
    const lines = file.text.split(/\r?\n/)
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i]
      // Ban in comments / JSDoc / HTML comments — also ban if leftover in visible source text
      if (SIGNIFIER_RE.test(line)) {
        failures.push(
          `${file.rel}:${i + 1}: silent-twin rule — remove crawl-only/inert/clone signifier prose from the twin (keep disabled form attrs only; never announce non-functional/crawl-only/clone). Hit: ${line.trim().slice(0, 120)}`,
        )
        break
      }
    }
  }

  if (twinTargets.length > 0) {
    const readme = readIfExists(["README.md"])
    if (readme) {
      if (/(?:login\s+clone|this is a clone|clone of |cloned from|pixel-perfect clone)/i.test(readme.text)) {
        failures.push(
          `${readme.rel}: silent-twin / README rule — forbid "clone of" / "login clone" language; describe the app as a mock-up exercise of {brand}`,
        )
      }
      // Require mock-up exercise framing near the top (first ~40 lines)
      const head = readme.text.split(/\r?\n/).slice(0, 40).join("\n")
      if (!/mock-?up\s+exercise\s+of/i.test(head)) {
        failures.push(
          `${readme.rel}: README must state near the top that this is a mock-up exercise of {brand} (e.g. "This is a mock-up exercise of …")`,
        )
      }
    }
  }
}

if (failures.length) {
  console.error(`FAIL ${path.basename(root)} (crawler SEO)`)
  for (const f of failures) console.error(`  - ${f}`)
  process.exit(1)
}

console.log(`OK ${path.basename(root)} (crawler SEO — header integrity)`)

