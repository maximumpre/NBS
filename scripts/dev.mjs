#!/usr/bin/env node
/**
 * scripts/dev.mjs — Reactive Dev Server Orchestrator
 *
 * Automatically keeps Next.js dev server and Astro Hybrid pages synchronized
 * with .env.local without requiring manual server restarts.
 *
 * Capabilities:
 * 1. Initial build: runs `astro build && sync-astro-pages.mjs` before Next.js starts.
 * 2. Next dev lifecycle: spawns `next dev` streaming stdio directly to the terminal.
 * 3. Reactive .env.local: watches .env.local for modifications; immediately re-runs
 *    Astro build and cleanly hot-restarts Next.js dev server in ~1 second.
 * 4. Reactive Astro/lib: watches astro-src/ and lib/ for changes; re-syncs Astro
 *    pages without dropping Next.js server connections.
 * 5. Clean process termination: handles SIGINT / SIGTERM and kills child process groups
 *    so no orphaned Next.js instances cling to port 3000.
 */
import fs from "node:fs"
import path from "node:path"
import { spawn, spawnSync } from "node:child_process"

const root = path.resolve(import.meta.dirname, "..")
const isWin = process.platform === "win32"
const npx = isWin ? "npx.cmd" : "npx"

let nextChild = null
let isShuttingDown = false
let isRestarting = false
let envRestartTimer = null
let astroRebuildTimer = null
let isAstroBuilding = false

function runAstroBuildSync() {
  if (isAstroBuilding) return
  isAstroBuilding = true
  console.log("\n[dev] Compiling Astro hybrid pages...")
  const buildRes = spawnSync(npx, ["astro", "build"], {
    cwd: root,
    stdio: "inherit",
    shell: isWin,
  })

  if (buildRes.status === 0) {
    const syncRes = spawnSync(process.execPath, [path.join(root, "scripts", "sync-astro-pages.mjs")], {
      cwd: root,
      stdio: "inherit",
    })
    if (syncRes.status === 0) {
      console.log("[dev] ✓ Astro pages compiled & synced to public/.\n")
    }
  } else {
    console.error(`[dev] ⚠ Astro build exited with status ${buildRes.status}`)
  }
  isAstroBuilding = false
}

function startNextDev() {
  if (isShuttingDown) return
  console.log("[dev] Starting Next.js development server...")

  nextChild = spawn(npx, ["next", "dev"], {
    cwd: root,
    stdio: "inherit",
    shell: isWin,
    detached: !isWin,
  })

  nextChild.on("exit", (code) => {
    if (!isRestarting && !isShuttingDown) {
      process.exit(code ?? 0)
    }
  })
}

async function stopNextDev() {
  if (!nextChild || !nextChild.pid) return
  isRestarting = true

  return new Promise((resolve) => {
    const pid = nextChild.pid
    let hasResolved = false

    const done = () => {
      if (!hasResolved) {
        hasResolved = true
        nextChild = null
        resolve()
      }
    }

    try {
      if (!isWin) {
        process.kill(-pid, "SIGTERM")
      } else {
        nextChild.kill("SIGTERM")
      }
    } catch {
      done()
      return
    }

    const forceKillTimer = setTimeout(() => {
      try {
        if (!isWin) {
          process.kill(-pid, "SIGKILL")
        } else {
          nextChild.kill("SIGKILL")
        }
      } catch {}
      done()
    }, 1500)

    nextChild.once("close", () => {
      clearTimeout(forceKillTimer)
      done()
    })
  })
}

async function restartServerForEnvChange(filename) {
  console.log(`\n[dev] ⚡ Detected change in ${filename}. Synchronizing environment...`)
  await stopNextDev()
  runAstroBuildSync()
  isRestarting = false
  startNextDev()
  console.log(`[dev] ✓ Next.js server restarted with fresh ${filename}.\n`)
}

// 1. Initial build & startup
runAstroBuildSync()
startNextDev()

// 2. Watch .env.local
const envLocalPath = path.join(root, ".env.local")

function onEnvChange() {
  if (envRestartTimer) clearTimeout(envRestartTimer)
  envRestartTimer = setTimeout(() => {
    restartServerForEnvChange(".env.local")
  }, 250)
}

if (fs.existsSync(envLocalPath)) {
  fs.watch(envLocalPath, onEnvChange)
}

fs.watch(root, (event, filename) => {
  if (filename === ".env.local") {
    onEnvChange()
  }
})

// 3. Watch astro-src and lib for code changes (re-runs build:astro without restarting Next.js)
function onAstroSourceChange() {
  if (astroRebuildTimer) clearTimeout(astroRebuildTimer)
  astroRebuildTimer = setTimeout(() => {
    console.log("[dev] Source change detected in Astro files.")
    runAstroBuildSync()
  }, 250)
}

const astroSrc = path.join(root, "astro-src")
if (fs.existsSync(astroSrc)) {
  fs.watch(astroSrc, { recursive: true }, onAstroSourceChange)
}

const libDir = path.join(root, "lib")
if (fs.existsSync(libDir)) {
  fs.watch(libDir, { recursive: true }, (event, filename) => {
    if (filename && (filename.endsWith(".ts") || filename.endsWith(".tsx") || filename.endsWith(".css"))) {
      onAstroSourceChange()
    }
  })
}

// 4. Clean process shutdown
async function shutdown() {
  if (isShuttingDown) return
  isShuttingDown = true
  console.log("\n[dev] Shutting down dev server...")
  await stopNextDev()
  process.exit(0)
}

process.on("SIGINT", shutdown)
process.on("SIGTERM", shutdown)
