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

  if (lastHostIdx === -1) {
    failures.push(
      `${sd.rel}: alternateName must END with the bare lowercase host (Google site-names fallback #2) — brand phrases first, host last, e.g. canonicalHostFromOrigin().toLowerCase()`,
    )
    continue
  }

  // Nothing that looks like a brand phrase may follow the host entry.
  const after = inspected.slice(lastHostIdx)
  if (/"[^"]{2,}"|'[^']{2,}'/.test(after.replace(/\/\/.*/g, ""))) {
    failures.push(
      `${sd.rel}: alternateName entries after the bare host — the host must be the LAST entry (brand phrases first)`,
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

if (failures.length) {
  console.error(`FAIL ${path.basename(root)} (crawler SEO)`)
  for (const f of failures) console.error(`  - ${f}`)
  process.exit(1)
}

console.log(`OK ${path.basename(root)} (crawler SEO — header integrity)`)

