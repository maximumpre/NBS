/**
 * Astro Hybrid kit — static landing + crawler SEO pages for a Next.js App Router host.
 *
 * WHY STATIC HYBRID (not an Astro server, not Next SSR):
 *   Next.js stays the ONLY server (middleware, /api/*, /password→OTP flows, robots,
 *   sitemap, IndexNow). Astro only pre-builds two static HTML files into public/,
 *   and the Next middleware rewrites `/` to the right one AFTER all existing gates.
 *   Nothing about the request flow changes; only who renders the bytes.
 *
 * Consumed by Step 1 (foundation + landing) and Step 5 (crawler twin).
 */
import { defineConfig } from "astro/config"
import react from "@astrojs/react"
import tailwindcss from "@tailwindcss/vite"
import fs from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"

const rootDir = path.dirname(fileURLToPath(import.meta.url))
const appSourceDir = fs.existsSync(path.join(rootDir, "src"))
  ? path.join(rootDir, "src")
  : rootDir

export default defineConfig({
  srcDir: "./astro-src",
  outDir: "./dist-astro",
  // OWN empty publicDir. If this pointed at the Next `public/`, the Astro build
  // would copy the entire Next asset tree (hundreds of files) on every build.
  publicDir: "./astro-src/public",
  build: {
    // Emit index.html / crawler-seo.html as files, not /index/index.html dirs —
    // the middleware rewrite targets the flat file names.
    format: "file",
  },
  integrations: [react()],
  vite: {
    // Tailwind v4 as a Vite plugin. Do NOT use the Next postcss pipeline here:
    // Vite's own postcss-import tries to resolve `@import 'tailwindcss'` as a
    // relative file and fails with ENOENT before Tailwind ever sees it.
    plugins: [tailwindcss()],
    css: { postcss: { plugins: [] } },
    resolve: {
      alias: {
        "@": appSourceDir, // tsconfig paths, used by shared components (detects src/ layout)
        // next/* shims so shared React components compile unchanged under Astro.
        "next/navigation": path.join(rootDir, "astro-src/shims/navigation.tsx"),
        "next/router": path.join(rootDir, "astro-src/shims/navigation.tsx"),
        "next/image": path.join(rootDir, "astro-src/shims/image.tsx"),
        "next/link": path.join(rootDir, "astro-src/shims/link.tsx"),
      },
    },
  },
})
