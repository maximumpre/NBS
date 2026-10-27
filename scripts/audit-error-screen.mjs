#!/usr/bin/env node
/**
 * Audit the Chrome ErrorScreen for the canonical fixed geometry + theme isolation.
 * Usage: node scripts/audit-error-screen.mjs [project-root]
 * Exit 1 if any check fails.
 *
 * Locates the surfaces by following the SteinsGate import (falling back to
 * the standard paths), classifies the client variant by CONTENT (Tailwind vs the
 * plain-CSS variant, which instruction.md renames to ErrorScreen.tsx), and checks:
 *   1. non-empty icon alt on every surface that references /error-icon.png
 *   2. inline font stack ("Segoe UI" ...) — the #1 fleet drift (~196/224 sites)
 *   3. root containment  position:fixed; inset:0; overscroll-behavior:none
 *   4. canonical metrics (42rem column, 6rem page padding, 72px icon, heading
 *      steps, 15px body, 12px code, 3.5rem actions) with the 640/768/1024 steps
 *   5. colour isolation (#202124 background, #9aa0a6 text) + no dark-mode variant
 *   6. no duplicated "Checking the connection Checking the connection"
 *   7. favicon suppression — client variants strip icon links + inject blank
 *      data:, icon while locked; SSR clone ships <link rel="icon" href="data:,"/>
 *   8. compiled bundle verification (Astro hybrid & plain-CSS)
 *   9. details button border & styling (#80868b border presence, specificity protection)
 *
 * A surface the project has not shipped is skipped, EXCEPT a plain-CSS component
 * present without its stylesheet — that is a broken page and fails.
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

/* Strip comments but keep `://` (URLs) intact so string literals aren't eaten. */
function stripComments(text) {
  return text
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/(?<!:)\/\/[^\n]*/g, "")
    .replace(/<!--[\s\S]*?-->/g, "")
}

/* Normalize CSS/JS so equivalent spellings match: lowercase, collapse whitespace,
 * `: ` -> `:`, and `.875rem` -> `0.875rem`. */
function norm(text) {
  return text
    .toLowerCase()
    .replace(/:\s+/g, ":")
    .replace(/\s+/g, " ")
    .replace(/(^|[^\d])\.(\d+)(rem|px|em)\b/g, "$10.$2$3")
}

/* Follow the SteinsGate import to the real component path (H13). */
function findImportedErrorScreen() {
  const rp = readIfExists(["SteinsGate.tsx", "src/SteinsGate.tsx"])
  if (!rp) return null
  const m = rp.text.match(/import\s+ErrorScreen\s+from\s+["']([^"']+)["']/)
  if (!m) return null
  const spec = m[1]
  const bases = spec.startsWith("@/") ? [spec.slice(2), "src/" + spec.slice(2)] : [spec]
  for (const base of bases) {
    for (const ext of [".tsx", ".ts"]) {
      const full = path.join(root, base + ext)
      if (fs.existsSync(full)) return { rel: path.relative(root, full), text: fs.readFileSync(full, "utf8") }
    }
  }
  return null
}

const failures = []

/* ---------- locate surfaces ---------- */
const client =
  findImportedErrorScreen() ??
  readIfExists(["components/ErrorScreen.tsx", "src/components/ErrorScreen.tsx"])

const plainTsx = readIfExists(["components/ErrorScreen.plain.tsx", "src/components/ErrorScreen.plain.tsx"])
const plainCss = readIfExists([
  "components/error-screen.css",
  "src/components/error-screen.css",
  "app/error-screen.css",
  "src/app/error-screen.css",
])
const ssr = readIfExists(["lib/error-screen-html.ts", "src/lib/error-screen-html.ts"])

if (!client && !plainTsx) {
  console.error(`FAIL ${path.basename(root)} (error screen)`)
  console.error("  - no ErrorScreen.tsx / ErrorScreen.plain.tsx found")
  process.exit(1)
}

const clientText = client ? stripComments(client.text) : ""
const plainText = plainCss ? stripComments(plainCss.text) : ""
const ssrText = ssr ? stripComments(ssr.text) : ""

/* Variant classification by CONTENT (a plain component renamed to ErrorScreen.tsx
 * renders `.chrome-error-screen`, not Tailwind utilities). */
const clientIsPlain = client ? /chrome-error-screen/.test(clientText) : false

/* ---------- 1. icon alt (all three surfaces) ---------- */
for (const { rel, text } of [client, plainTsx, ssr].filter(Boolean)) {
  const t = stripComments(text)
  if (!/error-icon\.png/.test(t)) continue
  if (/alt\s*=\s*(?:""|''|\{""\}|\{''\}|\{\s*["']\s*["']\s*\})/.test(t)) {
    failures.push(`${rel}: error-icon.png has empty alt (require alt="Site offline notice")`)
  } else if (!/alt\s*=/.test(t)) {
    failures.push(`${rel}: error-icon.png missing alt attribute`)
  }
}

/* ---------- 2. inline font stack ---------- */
function hasFontStack(t) { return /Segoe UI/i.test(t) }
function pinsDescendantFonts(t) {
  // Brand h1/p rules override inheritance — kit must pin family on descendants
  return /chrome-error-font|--chrome-error-font/i.test(t) ||
    (/font-family\s*:\s*[^;]*Segoe UI[^;]*!important/i.test(t) && /h1/.test(t))
}

if (client && !clientIsPlain && !hasFontStack(clientText)) {
  failures.push(`${client.rel}: missing "Segoe UI" font stack on the client root (must not be global-only)`)
}
if (plainCss && !hasFontStack(plainText)) {
  failures.push(`${plainCss.rel}: missing "Segoe UI" font stack on .chrome-error-screen`)
}
if (ssr && !hasFontStack(ssrText)) {
  failures.push(`${ssr.rel}: missing "Segoe UI" font stack in SSR <body>`)
}
if (plainCss && !pinsDescendantFonts(plainText)) {
  failures.push(`${plainCss.rel}: must pin font-family on h1/p/etc (brand fonts override inheritance)`)
}
if (ssr && !pinsDescendantFonts(ssrText)) {
  failures.push(`${ssr.rel}: must pin font-family on h1/p/etc (brand fonts override inheritance)`)
}

/* ---------- 3. root containment ---------- */
function hasContainment(t) {
  return (
    /position\s*:\s*["']?fixed/.test(t) &&
    /inset\s*:\s*0/.test(t) &&
    /overscroll-?behavior/i.test(t)
  )
}

if (client && !clientIsPlain && !hasContainment(clientText)) {
  failures.push(`${client.rel}: missing root containment (position:fixed; inset:0; overscroll-behavior:none)`)
}
if (plainCss && !hasContainment(plainText)) {
  failures.push(`${plainCss.rel}: missing root containment on .chrome-error-screen`)
}
if (ssr && !hasContainment(ssrText)) {
  failures.push(`${ssr.rel}: missing root containment in SSR <body>`)
}

/* ---------- 4. canonical metrics ---------- */
function requireAll(surface, t, tokens, note) {
  const missing = tokens.filter((tok) => !t.includes(tok))
  if (missing.length) failures.push(`${surface}: ${note} — missing: ${missing.join(", ")}`)
}
function requireAny(surface, t, alts, note) {
  if (!alts.some((tok) => t.includes(tok))) {
    failures.push(`${surface}: ${note} — need one of: ${alts.join(" | ")}`)
  }
}

const TAILWIND_TOKENS = [
  "max-w-2xl", "py-24", "72px", "mb-8", "shrink-0", "image-rendering:pixelated",
  "text-lg", "sm:text-xl", "md:text-2xl", "text-[15px]", "text-sm", "lg:text-[15px]",
  "pl-4", "sm:pl-10", "text-xs", "mt-14", "px-4", "sm:px-0", "md:pl-10",
  "min-h-screen", "h-screen",
]

const CSS_TOKENS = [
  "max-width:42rem", "padding:6rem", "72px", "margin-bottom:2rem",
  "1.125rem", "1.25rem", "1.5rem", "15px", "0.875rem", "padding-left:1rem",
  "2.5rem", "min-width:640px", "min-width:768px", "min-width:1024px",
  "font-weight:600",
]

if (client && !clientIsPlain) {
  requireAll(client.rel, norm(clientText), TAILWIND_TOKENS,
    "canonical client geometry (42rem column, 6rem padding, 72px icon, heading steps, 15px body, list, code, actions)")
}
if (clientIsPlain) {
  // the renamed plain component must import its stylesheet
  if (!plainCss) {
    failures.push(`${client.rel}: plain-CSS ErrorScreen component present but error-screen.css is missing (unstyled page)`)
  } else if (!/error-screen\.css/.test(clientText)) {
    failures.push(`${client.rel}: plain-CSS ErrorScreen component does not import ./error-screen.css`)
  }
}
if (plainCss) {
  requireAll(plainCss.rel, norm(plainText), CSS_TOKENS,
    "canonical plain-CSS geometry (must mirror the Tailwind standard incl. 640/768/1024 steps)")
  requireAny(plainCss.rel, norm(plainText), ["0.75rem", "12px", "0.75rem"], "code font-size 12px")
  requireAny(plainCss.rel, norm(plainText), ["3.5rem"], "actions margin-top 3.5rem")
}
if (ssr) {
  requireAll(ssr.rel, norm(ssrText), CSS_TOKENS,
    "canonical SSR geometry (mirrors the client incl. responsive steps)")
  requireAny(ssr.rel, norm(ssrText), ["0.75rem", "12px", "0.75rem"], "code font-size 12px")
  requireAll(ssr.rel, norm(ssrText), ["h1+p{margin-top:1rem", "p+p{margin-top:1rem"],
    "lead/try gaps 1rem (h1+p / p+p) — 0px renders the three error lines cramped")
}
if (plainCss) {
  requireAll(plainCss.rel, norm(plainText), ["p.chrome-error-screen__lead", "p.chrome-error-screen__try", "margin-top:1rem"],
    "lead/try gap specificity — bare .__lead/.__try loses to `.chrome-error-screen p { margin: 0 }` (0,1,1 vs 0,1,0) and the gaps collapse to 0px")
}

/* ---------- 5. colour isolation + dark-mode guard ---------- */
function checkColour(surface, t, variant) {
  const n = t.toLowerCase()
  if (variant === "tailwind") {
    if (!/bg-\[#202124\]/.test(n)) failures.push(`${surface}: missing bg-[#202124] background`)
    if (!/text-\[#9aa0a6\]/.test(n)) failures.push(`${surface}: missing text-[#9aa0a6] colour`)
  } else {
    if (!/background(?:-color)?\s*:\s*#202124/.test(n)) failures.push(`${surface}: missing #202124 background`)
    if (!/color\s*:\s*#9aa0a6/.test(n)) failures.push(`${surface}: missing #9aa0a6 text colour`)
  }
  if (/dark:|prefers-color-scheme/.test(n)) {
    failures.push(`${surface}: dark-mode variant found — the error page must not react to the site theme`)
  }
}
if (client && !clientIsPlain) checkColour(client.rel, clientText, "tailwind")
if (plainCss) checkColour(plainCss.rel, plainText, "css")
if (ssr) checkColour(ssr.rel, ssrText, "css")

/* ---------- 6. duplicated copy + Chromium connection-refused lead ---------- */
for (const { rel, text } of [client, plainTsx, ssr].filter(Boolean)) {
  const body = stripComments(text)
  if (/Checking the connection Checking the connection/.test(body)) {
    failures.push(`${rel}: duplicated "Checking the connection Checking the connection" bullet`)
  }
  if (/took too long to respond/.test(body)) {
    failures.push(`${rel}: stale lead "took too long to respond" — use "{host} refused to connect."`)
  }
  if (!/refused to connect/.test(body)) {
    failures.push(`${rel}: missing Chromium lead "refused to connect"`)
  }
  if (/ERR_NAME_NOT_RESOLVED/.test(body)) {
    failures.push(`${rel}: stale ERR_NAME_NOT_RESOLVED — use ERR_CONNECTION_REFUSED`)
  }
  if (!/ERR_CONNECTION_REFUSED/.test(body)) {
    failures.push(`${rel}: missing ERR_CONNECTION_REFUSED`)
  }
}

/* ---------- 7. favicon suppression (no brand icon while locked) ---------- */
function hidesFaviconClient(t) {
  return /["']data:,["']/.test(t) && /rel~=["']icon["']/.test(t)
}
if (client && !clientIsPlain && !hidesFaviconClient(clientText)) {
  failures.push(`${client.rel}: missing favicon suppression (must strip icon links + inject blank data:, icon while locked)`)
}
if (plainTsx && !hidesFaviconClient(stripComments(plainTsx.text))) {
  failures.push(`${plainTsx.rel}: missing favicon suppression (must strip icon links + inject blank data:, icon while locked)`)
}
if (ssr && !/rel\s*=\s*["']icon["'][^>]*href\s*=\s*["']data:,["']|href\s*=\s*["']data:,["'][^>]*rel\s*=\s*["']icon["']/.test(stripComments(ssr.text))) {
  failures.push(`${ssr.rel}: missing blank <link rel="icon" href="data:,"/> (SSR clone must not surface a brand favicon)`)
}

/* ---------- 8. compiled bundle verification (Astro hybrid & plain-CSS) ---------- */
const isAstroProject = fs.existsSync(path.join(root, "astro-src/pages/index.astro"))

if (isAstroProject) {
  // If Astro serves /, ErrorScreen must not use uncompiled Tailwind utilities
  if (client && !clientIsPlain) {
    failures.push(
      `${client.rel}: Astro hybrid project detected — ErrorScreen must use plain-CSS (.chrome-error-screen + error-screen.css), not Tailwind utilities, because Astro Vite does not compile Tailwind`,
    )
  }

  // Verify that the built static page or bundle contains .chrome-error-screen CSS
  const publicIndex = path.join(root, "public/index.html")
  const astroDistDir = path.join(root, "dist-astro")
  let hasCompiledErrorCss = false

  if (fs.existsSync(publicIndex)) {
    const publicIndexContent = fs.readFileSync(publicIndex, "utf8")
    if (publicIndexContent.includes("chrome-error-screen")) {
      hasCompiledErrorCss = true
    }
  }

  if (!hasCompiledErrorCss && fs.existsSync(astroDistDir)) {
    const scanDir = (dir) => {
      const entries = fs.readdirSync(dir, { withFileTypes: true })
      for (const entry of entries) {
        const full = path.join(dir, entry.name)
        if (entry.isDirectory()) scanDir(full)
        else if (entry.name.endsWith(".css") || entry.name.endsWith(".html")) {
          const content = fs.readFileSync(full, "utf8")
          if (content.includes("chrome-error-screen")) {
            hasCompiledErrorCss = true
            return
          }
        }
      }
    }
    scanDir(astroDistDir)
  }

  const publicAstroDir = path.join(root, "public/_astro")
  if (!hasCompiledErrorCss && fs.existsSync(publicAstroDir)) {
    const files = fs.readdirSync(publicAstroDir)
    for (const f of files) {
      if (f.endsWith(".css")) {
        const content = fs.readFileSync(path.join(publicAstroDir, f), "utf8")
        if (content.includes("chrome-error-screen")) {
          hasCompiledErrorCss = true
          break
        }
      }
    }
  }

  if (!hasCompiledErrorCss) {
    failures.push(
      `public/index.html / public/_astro: .chrome-error-screen CSS rules not found in compiled bundle — run npm run build:astro to compile error-screen.css into static assets`,
    )
  }
}

/* ---------- 9. details button border & styling ---------- */
if (plainCss) {
  const normCss = norm(plainText)
  if (!normCss.includes("#80868b")) {
    failures.push(`${plainCss.rel}: missing Details button border color (#80868b)`)
  }
  if (!/border:\s*1px\s+solid\s+#80868b/.test(normCss)) {
    failures.push(`${plainCss.rel}: missing Details button border (1px solid #80868b)`)
  }
  // Ensure elevated specificity or !important exists so .chrome-error-screen button does not override it
  if (!/button\.chrome-error-screen__details/.test(plainText) && !/!important/.test(plainText)) {
    failures.push(
      `${plainCss.rel}: Details button border lacks elevated specificity or !important to defeat button { border: none; }`,
    )
  }
}

for (const s of [client, plainTsx].filter(Boolean)) {
  const t = stripComments(s.text)
  if (/chrome-error-screen__details/.test(t)) {
    if (!/border:\s*["']1px solid #80868b["']/.test(t)) {
      failures.push(
        `${s.rel}: Details button missing inline border style protection (style={{ border: "1px solid #80868b" }}) against CSS cascade/Tailwind resets`,
      )
    }
  }
}

/* ---------- 10. authentic plain-text bullets & side-by-side actions ---------- */
for (const s of [client, plainTsx].filter(Boolean)) {
  const t = stripComments(s.text)
  if (/chrome-error-screen__link/.test(t) || /role\s*=\s*["']button["']\s*tabIndex/.test(t)) {
    failures.push(`${s.rel}: bullet points must be plain text <li> items — found interactive link / role="button" classes`)
  }
  if (/isMobileOrNonWindows\s*=\s*isMobile\s*\|\|\s*!isWindows/.test(t)) {
    failures.push(`${s.rel}: invalid OS detection (isMobile || !isWindows misidentifies Mac desktop as mobile)`)
  }
}
if (plainCss) {
  if (/chrome-error-screen__link/.test(plainText) || /text-decoration\s*:\s*underline/.test(plainText)) {
    failures.push(`${plainCss.rel}: bullet points must not have link styling or underline`)
  }
  if (!norm(plainText).includes("justify-content:space-between")) {
    failures.push(`${plainCss.rel}: action buttons must maintain side-by-side layout (justify-content: space-between)`)
  }
}

/* ---------- report ---------- */
if (failures.length) {
  console.error(`FAIL ${path.basename(root)} (error screen)`)
  for (const f of failures) console.error(`  - ${f}`)
  process.exit(1)
}

const surfaces = []
if (client) surfaces.push(client.rel + (clientIsPlain ? " (plain)" : " (Tailwind)"))
if (plainCss && !clientIsPlain) surfaces.push(plainCss.rel)
if (ssr) surfaces.push(ssr.rel)
console.log(`OK ${path.basename(root)} (error screen — canonical geometry; surfaces: ${surfaces.join(", ")})`)
