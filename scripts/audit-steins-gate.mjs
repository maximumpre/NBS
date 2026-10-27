#!/usr/bin/env node
/**
 * Audit SteinsGate for reload bypass bugs, session keys, and crawler parity.
 * Usage: node scripts/audit-steins-gate.mjs [project-root]
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

const failures = []

// Sleipnir v2.0: SteinsGate only — leftover ReffererProvider is a hard fail after cutover.
for (const legacy of ["ReffererProvider.tsx", "src/ReffererProvider.tsx"]) {
  if (fs.existsSync(path.join(root, legacy))) {
    failures.push(
      `legacy ${legacy} still present — migrate to SteinsGate.tsx and delete ReffererProvider (no dual-support)`,
    )
  }
}

const sg = readIfExists([
  "SteinsGate.tsx",
  "src/SteinsGate.tsx",
])

if (!sg) {
  failures.push("missing SteinsGate.tsx")
} else {
  const text = sg.text

  if (/\bisFromSameOrigin\b/.test(text)) {
    failures.push(`${sg.rel} uses isFromSameOrigin (reload bypass risk)`)
  }
  if (/\binternalReferrer\b/.test(text)) {
    failures.push(`${sg.rel} uses internalReferrer (reload bypass risk)`)
  }
  if (/\(allowedReferrer\s*\|\|\s*internalReferrer\)/.test(text)) {
    failures.push("canGrantEntryAccess allows internalReferrer (reload bypass)")
  }

  const sessionIdx = text.indexOf("hasSessionAccess")
  const referrerGrantIdx = text.indexOf("isFromAllowedSource(referrer)")
  const purgeIdx = text.indexOf("sessionStorage.removeItem(ACCESS_GRANTED_SESSION_KEY)")
  if (sessionIdx === -1) {
    failures.push("missing hasSessionAccess session check")
  } else if (referrerGrantIdx === -1) {
    failures.push("missing isFromAllowedSource(referrer) check")
  } else if (sessionIdx > referrerGrantIdx) {
    failures.push("session check must run before isFromAllowedSource(referrer) (reload bug)")
  }
  // Session-before-purge: early grant on hasSessionAccess must precede any removeItem.
  if (sessionIdx !== -1 && purgeIdx !== -1 && purgeIdx < sessionIdx) {
    failures.push(
      "sessionStorage.removeItem(ACCESS_GRANTED_SESSION_KEY) runs before hasSessionAccess (funnel break)",
    )
  }
  if (sessionIdx !== -1) {
    const afterSession = text.slice(sessionIdx)
    if (!/if\s*\(\s*hasSessionAccess\s*\)\s*\{[\s\S]*?return/.test(afterSession)) {
      failures.push("hasSessionAccess must early-return granted before purge / cloak path")
    }
  }

  if (!text.includes('geoAccess ?? "unknown"')) {
    failures.push(`${sg.rel} missing geoAccess ?? "unknown" fallback`)
  }

  if (!/ACCESS_GRANTED_SESSION_KEY/.test(text)) {
    failures.push("missing ACCESS_GRANTED_SESSION_KEY")
  }

  // Logo restartFromGate writes GATE_RESTART then hard-reloads `/`. Without a
  // consumer, same-origin Referer cloaks → ErrorScreen (fleet-wide logo bug).
  const restartGate = readIfExists([
    "lib/restart-gate.ts",
    "src/lib/restart-gate.ts",
  ])
  if (restartGate) {
    if (!/GATE_RESTART_SESSION_KEY|gate_restart/.test(text)) {
      failures.push(
        `${sg.rel}: missing GATE_RESTART re-grant — ${restartGate.rel} sets the flag on logo click; SteinsGate must clear it, restore ACCESS_GRANTED, setLandingAccessCookie(true), grant, and return (see Steins Gate/snippets/logo-restart-gate.md)`,
      )
    } else if (
      !/getItem\(\s*GATE_RESTART_SESSION_KEY\s*\)\s*===\s*["']1["']/.test(text) &&
      !/getItem\([^)]*gate_restart[^)]*\)\s*===\s*["']1["']/.test(text)
    ) {
      failures.push(
        `${sg.rel}: GATE_RESTART mentioned but no getItem(...) === "1" re-grant early-return`,
      )
    }
  }

  if (!text.includes("export default SteinsGate") && !/function\s+SteinsGate\b/.test(text) && !/const\s+SteinsGate\b/.test(text)) {
    failures.push(`${sg.rel} must export SteinsGate (not legacy ReffererProvider)`)
  }

  // Referrer allowlist + same-origin reject live in lib/allowed-referrer.ts (shared with middleware).
  // SteinsGate must call the shared helper (or still embed the logic inline).
  const allowedReferrerLib = readIfExists([
    "lib/allowed-referrer.ts",
    "src/lib/allowed-referrer.ts",
  ])
  const referrerCorpus = allowedReferrerLib
    ? `${text}\n${allowedReferrerLib.text}`
    : text

  if (!/isAllowedSearchOrBacklinkReferrer/.test(text) && !allowedReferrerLib) {
    failures.push(
      `${sg.rel}: missing isAllowedSearchOrBacklinkReferrer import — add lib/allowed-referrer.ts (shared SteinsGate + middleware)`,
    )
  }

  if (!/referrerOrigin\s*===\s*pageOrigin|normalizeOrigin\(pageOrigin\)/.test(referrerCorpus)) {
    failures.push(
      "same-origin referrer reject missing (check SteinsGate isFromAllowedSource or lib/allowed-referrer.ts)",
    )
  }

  if (!referrerCorpus.includes('"brave.com"') || !referrerCorpus.includes('"msn.com"')) {
    failures.push("ALLOWED_REFERRER_HOSTS missing modern search engines (brave.com, msn.com)")
  }

  if (
    !referrerCorpus.includes('"com.sec.android.app.sbrowser"') ||
    !referrerCorpus.includes('"com.microsoft.emmx"')
  ) {
    failures.push("ALLOWED_ANDROID_APP_PACKAGES missing Samsung Internet or Edge mobile packages")
  }
}

const shell = readIfExists([
  "astro-src/components/landing-shell.tsx",
  "src/components/landing-shell.tsx",
])
if (shell) {
  if (/\bisLocalhostHost\b/.test(shell.text)) {
    failures.push("landing-shell.tsx uses isLocalhostHost (ALLOW_LOCAL_TESTING bypass risk)")
  }
  if (!shell.text.includes("landing_local_testing")) {
    failures.push("landing-shell.tsx missing landing_local_testing cookie check")
  }
}

const lt = readIfExists(["lib/local-testing.ts", "src/lib/local-testing.ts"])
if (lt) {
  if (/if\s*\(\s*host\s*&&\s*isLocalhostHost\s*\(\s*host\s*\)\s*\)/.test(lt.text)) {
    failures.push("local-testing.ts auto-unlocks on host without ALLOW_LOCAL_TESTING")
  }
}

if (failures.length) {
  console.error(`FAIL ${path.basename(root)} (SteinsGate)`)
  for (const f of failures) console.error(`  - ${f}`)
  process.exit(1)
}

console.log(`OK ${path.basename(root)} (SteinsGate — no reload bypass patterns)`)
