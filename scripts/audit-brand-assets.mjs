#!/usr/bin/env node
/**
 * Audit SERP favicon wiring for Referral-Provider member sites.
 * Usage: node scripts/audit-brand-assets.mjs [project-root]
 * Exit 1 if any check fails.
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

const ICON_PATH_RE = /["'](\/(?:favicon(?:-\d+x\d+)?|icon-\d+x\d+|apple-touch-icon)\.(?:png|ico))["']/g

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

const layout = readIfExists(["app/layout.tsx", "src/app/layout.tsx"])
if (!layout) {
  failures.push("missing app/layout.tsx")
} else {
  const refs = new Set()
  let m
  while ((m = ICON_PATH_RE.exec(layout.text)) !== null) refs.add(m[1])
  for (const ref of refs) {
    const rel = ref.replace(/^\//, "")
    if (!fs.existsSync(path.join(root, "public", rel))) {
      failures.push(`layout references ${ref} but public/${rel} missing`)
    }
  }
  if (!layout.text.includes("icon-32x32.png") || !layout.text.includes("apple-touch-icon")) {
    failures.push("layout.icons missing multi-size favicon entries")
  }
}

const mw = readIfExists(["middleware.ts", "src/middleware.ts"])
if (!mw) {
  failures.push("missing middleware.ts")
} else {
  for (const file of ["favicon.ico", "icon-32x32.png", "icon-48x48.png", "apple-touch-icon.png"]) {
    if (!mw.text.includes(file)) failures.push(`middleware missing whitelist for /${file}`)
  }
}

const rp = readIfExists(["ReffererProvider.tsx", "src/ReffererProvider.tsx"])
if (!rp) {
  failures.push("missing ReffererProvider.tsx")
} else {
  if (/ACCESS_GRANTED_SESSION_KEY\s*=\s*["']\{your_project\}_referrer_access_granted["']/.test(rp.text)) {
    failures.push("ReffererProvider still uses placeholder session key")
  }
  if (!rp.text.includes('geoAccess ?? "unknown"')) {
    failures.push("ReffererProvider missing geoAccess ?? \"unknown\" fallback")
  }
}

if (failures.length) {
  console.error(`FAIL ${path.basename(root)}`)
  for (const f of failures) console.error(`  - ${f}`)
  process.exit(1)
}

console.log(`OK ${path.basename(root)}`)
