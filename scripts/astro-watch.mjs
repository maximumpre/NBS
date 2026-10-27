#!/usr/bin/env node
/**
 * `npm run astro:watch` — watches astro-src/, lib/, and root .env* files
 * for changes, re-runs `astro build` and mirrors dist-astro/* into public/,
 * and signals the dev live-reload bridge.
 *
 * EXACTLY ONE watcher. Do not also run another watcher in parallel.
 */
import fs from "node:fs"
import path from "node:path"
import { spawn } from "node:child_process"

const root = path.resolve(import.meta.dirname, "..")

let isBuilding = false
let pendingRebuild = false
let currentChild = null

function runBuild() {
  if (isBuilding) {
    pendingRebuild = true
    return
  }
  isBuilding = true
  console.log("\n[astro:watch] Change detected. Rebuilding Astro pages...")

  const npx = process.platform === "win32" ? "npx.cmd" : "npx"
  currentChild = spawn(npx, ["astro", "build"], {
    cwd: root,
    stdio: "inherit",
    shell: process.platform === "win32",
  })

  currentChild.on("close", (code) => {
    isBuilding = false
    currentChild = null
    if (code === 0) {
      // Sync dist-astro/* into public/
      const syncChild = spawn(process.execPath, [path.join(root, "scripts", "sync-astro-pages.mjs")], {
        cwd: root,
        stdio: "inherit",
      })
      syncChild.on("close", (syncCode) => {
        if (syncCode === 0) {
          console.log("[astro:watch] ✓ Astro rebuild and sync complete.\n")
        }
      })
    } else {
      console.error(`[astro:watch] Astro build exited with code ${code}`)
    }

    if (pendingRebuild) {
      pendingRebuild = false
      runBuild()
    }
  })
}

let timer = null
function trigger(source, filename) {
  if (filename && (filename.startsWith(".") && !filename.startsWith(".env"))) return
  if (filename && (filename.endsWith("~") || filename.includes(".astro-dev-reload") || filename.includes("dist-astro"))) return
  
  if (timer) clearTimeout(timer)
  timer = setTimeout(runBuild, 250)
}

// 1. Watch astro-src recursively
const astroSrc = path.join(root, "astro-src")
if (fs.existsSync(astroSrc)) {
  fs.watch(astroSrc, { recursive: true }, (event, filename) => trigger("astro-src", filename))
}

// 2. Watch lib recursively
const libDir = path.join(root, "lib")
if (fs.existsSync(libDir)) {
  fs.watch(libDir, { recursive: true }, (event, filename) => trigger("lib", filename))
}

// 3. Watch root non-recursively for .env, .env.local, and astro.config.mjs
fs.watch(root, (event, filename) => {
  if (filename && (filename.startsWith(".env") || filename === "astro.config.mjs")) {
    trigger("root-env", filename)
  }
})

console.log("[astro:watch] Watching astro-src, lib, and .env files for changes...")

const shutdown = () => {
  if (currentChild) {
    try {
      currentChild.kill()
    } catch {}
  }
  process.exit(0)
}
process.on("SIGINT", shutdown)
process.on("SIGTERM", shutdown)
