#!/usr/bin/env node
/**
 * Copy the built Astro pages (dist-astro/*) into public/ so the Next.js
 * middleware rewrite for `/` can serve them:
 *   public/index.html        ← human landing
 *   public/crawler-seo.html  ← crawler SEO twin
 *   public/_astro/           ← hashed CSS/JS/font/image assets
 *
 * Fails the build if either page is missing. Runs FIRST in `prebuild`, before
 * the audit scripts, so the audits always validate a real build.
 */
import fs from "node:fs"
import path from "node:path"

const root = path.resolve(import.meta.dirname, "..")
const src = path.join(root, "dist-astro")
const dest = path.join(root, "public")

// Step 1 builds index.html. In Step 5, crawler-seo.html is added when crawler-seo.astro exists.
const REQUIRED = ["index.html"]
if (
  fs.existsSync(path.join(root, "astro-src", "pages", "crawler-seo.astro")) ||
  fs.existsSync(path.join(root, "src", "astro-src", "pages", "crawler-seo.astro"))
) {
  REQUIRED.push("crawler-seo.html")
}

if (!fs.existsSync(src)) {
  console.error("FAIL astro sync: dist-astro/ missing — run `astro build` first.")
  process.exit(1)
}

for (const file of REQUIRED) {
  if (!fs.existsSync(path.join(src, file))) {
    console.error(`FAIL astro sync: dist-astro/${file} missing — astro build incomplete.`)
    process.exit(1)
  }
}

// Only build output — never dotfiles (the publicDir .gitkeep placeholder and
// .DS_Store have no business in the Next public/ tree).
let copied = 0
for (const entry of fs.readdirSync(src)) {
  if (entry.startsWith(".")) continue
  fs.cpSync(path.join(src, entry), path.join(dest, entry), { recursive: true })
  copied++
}

console.log(`OK astro sync: ${REQUIRED.join(", ")} + assets → public/ (${copied} entries)`)
