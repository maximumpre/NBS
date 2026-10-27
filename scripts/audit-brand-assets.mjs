#!/usr/bin/env node
/**
 * Audit SERP favicon wiring for member sites.
 * Usage: node scripts/audit-brand-assets.mjs [project-root]
 * Exit 1 if any check fails.
 *
 * RENDERER AWARENESS:
 *   `/` and the crawler SEO twin are Astro; the rest stays Next.js. The head
 *   actually served for those two URLs is
 *   `astro-src/components/seo-head.astro` — NOT `app/layout.tsx`. A layout-only
 *   audit passed green while the Astro head referenced assets that did not
 *   exist, which is how a <link rel="manifest" href="/manifest.json"> shipped a
 *   404 on the highest-value URLs. This audit now reads the Astro head as well
 *   as the layout, and checks EVERY root-relative static asset it references
 *   (not just a hardcoded list of icon filenames).
 */

import fs from "node:fs"
import path from "node:path"

const root = path.resolve(process.argv[2] ?? process.cwd())
const REQUIRED_PUBLIC = [
  "favicon.ico",
  "icon-32x32.png",
  "icon-48x48.png",
  "apple-touch-icon.png",
  "error-icon.png",
]

// Legacy, layout-specific pattern (kept for the Next-only path).
const ICON_PATH_RE = /["'](\/(?:favicon(?:-\d+x\d+)?|icon-\d+x\d+|apple-touch-icon)\.(?:png|ico))["']/g

// Any root-relative href/src that points at a static file in public/.
// The extension allow-list is what keeps this from matching routes (/api/...),
// the hashed /_astro/ bundle dir, or extension-less paths.
const ROOT_ASSET_RE =
  /(?:href|src)\s*=\s*["'](\/[^"'?#]*\.(?:png|ico|jpg|jpeg|svg|webp|avif|json|txt|xml|webmanifest))["']/g

// The Astro chain ships under `Astro Hybrid/` in the kit and at the project
// root once copied. Accept both so the same audit works in the kit checkout and
// in a real project.
const ASTRO_HEAD_CANDIDATES = [
  "Astro Hybrid/astro-src/components/seo-head.astro",
  "astro-src/components/seo-head.astro",
  "src/astro-src/components/seo-head.astro",
]
const ASTRO_LANDING_CANDIDATES = [
  "Astro Hybrid/astro-src/pages/index.astro",
  "Astro Hybrid/astro-src/pages/index.astro.template",
  "astro-src/pages/index.astro",
]

function readIfExists(relPaths) {
  for (const rel of relPaths) {
    const full = path.join(root, rel)
    if (fs.existsSync(full)) return { rel, text: fs.readFileSync(full, "utf8") }
  }
  return null
}

const failures = []

for (const file of REQUIRED_PUBLIC) {
  if (!fs.existsSync(path.join(root, "public", file))) {
    failures.push(`missing public/${file}`)
  }
}

const astroHead = readIfExists(ASTRO_HEAD_CANDIDATES)
const astroLanding = readIfExists(ASTRO_LANDING_CANDIDATES)
const isAstro = Boolean(astroHead || astroLanding)

/**
 * Strip comments before scanning.
 *
 * Comments are NOT emitted into the served document, so a commented-out
 * `<link rel="manifest">` or a prose mention of an asset filename must never
 * count as a live reference. Without this, documenting a removed tag in the very
 * file that removed it makes the audit fail on its own changelog.
 *
 * Only whole-line `//` and `*` comments are removed, never inline ones, so URLs
 * like `https://…` are not mangled.
 */
function stripComments(text) {
  return text
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/<!--[\s\S]*?-->/g, "")
    .split("\n")
    .filter((line) => {
      const t = line.trim()
      return !(t.startsWith("//") || t.startsWith("*") || t.startsWith("/*"))
    })
    .join("\n")
}

/** Every root-relative static asset a head references must exist in public/. */
function checkRootAssetRefs(file) {
  const source = stripComments(file.text)
  const refs = new Set()
  let m
  ROOT_ASSET_RE.lastIndex = 0
  while ((m = ROOT_ASSET_RE.exec(source)) !== null) refs.add(m[1])
  for (const ref of refs) {
    // The manifest has a dedicated check below with a more actionable message.
    if (ref === "/manifest.json") continue
    const rel = ref.replace(/^\//, "")
    if (!fs.existsSync(path.join(root, "public", rel))) {
      failures.push(`${file.rel} references ${ref} but public/${rel} missing`)
    }
  }
}

const layout = readIfExists(["app/layout.tsx", "src/app/layout.tsx"])
if (!layout) {
  failures.push("missing app/layout.tsx")
} else {
  // Dead references in the layout still matter — it renders every non-Astro route.
  const layoutSource = stripComments(layout.text)
  const refs = new Set()
  let m
  ICON_PATH_RE.lastIndex = 0
  while ((m = ICON_PATH_RE.exec(layoutSource)) !== null) refs.add(m[1])
  for (const ref of refs) {
    const rel = ref.replace(/^\//, "")
    if (!fs.existsSync(path.join(root, "public", rel))) {
      failures.push(`layout references ${ref} but public/${rel} missing`)
    }
  }
  // The multi-size icon requirement belongs to whichever file renders the head.
  // In an Astro project that is seo-head.astro; app/layout.tsx is inert for `/`
  // and the twin, so demanding icons there would be a text-matching fiction.
  if (!isAstro && (!layoutSource.includes("icon-32x32.png") || !layoutSource.includes("apple-touch-icon"))) {
    failures.push("layout.icons missing multi-size favicon entries")
  }
}

// Astro half: the head that actually serves `/` and the crawler twin.
if (isAstro && !astroHead) {
  failures.push("Astro chain detected but astro-src/components/seo-head.astro is missing")
} else if (astroHead) {
  checkRootAssetRefs(astroHead)
  const headSource = stripComments(astroHead.text)
  if (!headSource.includes("icon-32x32.png") || !headSource.includes("apple-touch-icon")) {
    failures.push(`${astroHead.rel} missing multi-size favicon entries`)
  }
  // No PWA on these clones: the head must not advertise a manifest it cannot
  // back. If a project ever reintroduces one, the file has to exist. This is the
  // check that would have caught the original dead <link rel="manifest">.
  if (/rel\s*=\s*["']manifest["']/.test(headSource)) {
    const declared = /rel\s*=\s*["']manifest["'][^>]*href\s*=\s*["'](\/[^"']+)["']/.exec(headSource)
    if (!declared) {
      failures.push(`${astroHead.rel} declares rel="manifest" with no href`)
    } else {
      const rel = declared[1].replace(/^\//, "")
      if (!fs.existsSync(path.join(root, "public", rel))) {
        failures.push(
          `${astroHead.rel} references ${declared[1]} but public/${rel} missing — ` +
            `generate it and add it to REQUIRED_PUBLIC, or remove the link`,
        )
      }
    }
  }
}

// Next 16 renamed middleware.ts → proxy.ts — accept both names.
const mw = readIfExists(["middleware.ts", "src/middleware.ts", "proxy.ts", "src/proxy.ts"])
if (!mw) {
  failures.push("missing middleware.ts / proxy.ts")
} else {
  for (const file of ["favicon.ico", "icon-32x32.png", "icon-48x48.png", "apple-touch-icon.png"]) {
    if (!mw.text.includes(file)) failures.push(`middleware missing whitelist for /${file}`)
  }
}

const rp = readIfExists([
  "SteinsGate.tsx",
  "src/SteinsGate.tsx",
])
if (!rp) {
  failures.push("missing SteinsGate.tsx")
} else {
  if (/ACCESS_GRANTED_SESSION_KEY\s*=\s*["']\{your_project\}_(referrer|steins_gate)_access_granted["']/.test(rp.text)) {
    failures.push(`${rp.rel} still uses placeholder session key`)
  }
  if (!rp.text.includes('geoAccess ?? "unknown"')) {
    failures.push(`${rp.rel} missing geoAccess ?? "unknown" fallback`)
  }
}

/* ---------- generated asset verification (dimensions must match the contract) ----------
 * generate-brand-assets.py resizes icons to exact size×size; generate-og-image.py
 * writes og-image.meta.json whose width/height MUST equal the og-image.png canvas.
 * social-preview.ts imports that meta json for openGraph width/height — a mismatch
 * ships wrong image dimensions to every scraper. */
function pngSize(absPath) {
  const buf = fs.readFileSync(absPath)
  if (buf.length < 24) return null
  if (buf.readUInt32BE(0) !== 0x89504e47) return null
  if (buf.toString("ascii", 12, 16) !== "IHDR") return null
  return { width: buf.readUInt32BE(16), height: buf.readUInt32BE(20) }
}

const EXPECTED_ICON_DIMS = {
  "icon-32x32.png": 32,
  "favicon-32x32.png": 32,
  "favicon.png": 32,
  "icon-48x48.png": 48,
  "apple-touch-icon.png": 180,
}
for (const [file, size] of Object.entries(EXPECTED_ICON_DIMS)) {
  const abs = path.join(root, "public", file)
  if (!fs.existsSync(abs)) continue // presence is checked separately (REQUIRED_PUBLIC / layout refs)
  const dim = pngSize(abs)
  if (!dim) {
    failures.push(`public/${file} is not a valid PNG`)
  } else if (dim.width !== size || dim.height !== size) {
    failures.push(`public/${file} is ${dim.width}x${dim.height} — expected ${size}x${size} (resize-only rule)`)
  }
}

const ogImageAbs = path.join(root, "public", "og-image.png")
const ogMeta = readIfExists(["public/og-image.meta.json"])
if (!fs.existsSync(ogImageAbs)) {
  failures.push("missing public/og-image.png (run scripts/generate-og-image.py from the header logo)")
}
if (!ogMeta) {
  failures.push("missing public/og-image.meta.json (generated by scripts/generate-og-image.py)")
}
if (fs.existsSync(ogImageAbs) && ogMeta) {
  const dim = pngSize(ogImageAbs)
  let meta = null
  try {
    meta = JSON.parse(ogMeta.text)
  } catch {
    failures.push("public/og-image.meta.json is not valid JSON")
  }
  if (!dim) {
    failures.push("public/og-image.png is not a valid PNG")
  } else if (meta) {
    if (!Number.isInteger(meta.width) || !Number.isInteger(meta.height) || meta.width <= 0 || meta.height <= 0) {
      failures.push("public/og-image.meta.json width/height must be positive integers")
    } else if (meta.width !== dim.width || meta.height !== dim.height) {
      failures.push(
        `public/og-image.meta.json says ${meta.width}x${meta.height} but og-image.png is ${dim.width}x${dim.height} ` +
          `(re-run scripts/generate-og-image.py)`,
      )
    }
    if (meta.logoBox && (meta.logoBox.width > dim.width || meta.logoBox.height > dim.height)) {
      failures.push("public/og-image.meta.json logoBox exceeds the og-image.png canvas")
    }
    // Provenance: the recorded source must still exist, or a kit sync left a stale og-image.
    if (meta.sourceKind !== "url") {
      const src = String(meta.source ?? "")
      const candidates = [
        path.join(root, src),
        path.join(root, "public", src),
        path.join(root, "public", path.basename(src)),
      ]
      if (!src) {
        failures.push("public/og-image.meta.json missing source provenance")
      } else if (!candidates.some((c) => fs.existsSync(c))) {
        failures.push(
          `public/og-image.meta.json source "${src}" not found — og-image.png is stale (re-run scripts/generate-og-image.py)`,
        )
      }
    }
    if (meta.sourceKind === "favicon") {
      console.warn(
        `WARN ${path.basename(root)}: og-image.png was generated from the favicon — ` +
          `BRAND_ICONS.md requires the header/login logo; re-run scripts/generate-og-image.py from the UI logo`,
      )
    }
  }
}

if (failures.length) {
  console.error(`FAIL ${path.basename(root)}`)
  for (const f of failures) console.error(`  - ${f}`)
  process.exit(1)
}

console.log(`OK ${path.basename(root)}`)
