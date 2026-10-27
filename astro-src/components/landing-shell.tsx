/**
 * The human landing island (React), mounted by `astro-src/pages/index.astro`
 * with `client:only="react"`.
 *
 * WHY AN ISLAND AND NOT A FULL REACT RENDER:
 *   Everything below the head is interactive login UI that already exists as
 *   React components. Re-implementing it in Astro would fork the login flow.
 *   So Astro owns the document (head, CSS, fonts, static shell) and exactly ONE
 *   React island owns the interactive tree. Crawlers requesting the twin get
 *   zero JS; humans get the real components, unchanged.
 *
 * PARITY OBLIGATION — this is the whole risk of the conversion:
 *   `ProtectedLayout` computed `isBot` and `geoAccess` from request headers on
 *   the server. A client island cannot read headers, so the middleware now
 *   mirrors both into short-lived cookies. This file reads those cookies and
 *   must pass the SAME values down, or the SteinsGate will behave
 *   differently for humans than it did before.
 *
 * RENDER TREE — the exact chain this island reproduces:
 *   SteinsGate → FlowGateProvider → BotFingerprintCollector + BotHoneypotTrap
 *   `FlowGateProvider` ships with this kit (`./flow-gate-provider`) and carries
 *   `allowLocalTesting`. It is deliberately generic plumbing, not a project
 *   module — a project must never have to author it. If you need extra gate
 *   state, extend the context there rather than reintroducing a per-project
 *   provider import here.
 */
"use client"

import type { ReactNode } from "react"
import SteinsGate from "@/SteinsGate"
// Relative, NOT the `@/` alias: the alias points at the PROJECT root, while this
// provider ships inside astro-src/. Using `@/` here would resolve to a project
// file that does not exist.
import { FlowGateProvider } from "./flow-gate-provider"
import BotFingerprintCollector from "@/components/BotFingerprintCollector"
import BotHoneypotTrap from "@/components/BotHoneypotTrap"
import { CRAWLER_PATTERN } from "@/lib/crawler-ua"
import type { GeoUsOnlyHeaderValue } from "@/lib/geo-us-header"
import { HumanLandingFaq } from "./human-landing-faq"

/**
 * Reads a middleware-stamped gate cookie. Returns undefined when the cookie is
 * genuinely absent — callers must NOT conflate "absent" with an explicit "0",
 * otherwise a stripped/blocked cookie silently reads as a clean pass.
 *
 * These cookies are intentionally httpOnly:false (see snippets/middleware-astro-rewrite.md).
 * If they ever go missing the fallbacks below re-derive the same signals rather
 * than defaulting to allowed.
 */
function readCookie(name: string): string | undefined {
  if (typeof document === "undefined") return undefined
  const match = document.cookie.match(new RegExp(`(?:^|; )${name}=([^;]*)`))
  return match ? decodeURIComponent(match[1]) : undefined
}

export default function LandingShell({
  children,
  allowLocalTestingEnv = false,
}: {
  children: ReactNode
  /** Injected at build time from ALLOW_LOCAL_TESTING so the island matches the server. */
  allowLocalTestingEnv?: boolean
}) {
  // Mirrors of the server-computed signals (see PARITY OBLIGATION above).
  // Fail closed: an absent cookie must never read as an explicit allow/deny.
  const botCookie = readCookie("landing_bot")
  const isBot =
    botCookie === "1"
      ? true
      : botCookie === "0"
        ? false
        : // Cookie absent (blocked cookies, older cached HTML, direct file load).
          // Re-derive with the same pattern the server used, not `false`.
          typeof navigator !== "undefined" && CRAWLER_PATTERN.test(navigator.userAgent)

  const geoRaw = readCookie("landing_geo")
  // Absent cookie → "unknown", never "allow". "unknown" still forces the
  // /api/visitor-geo confirmation in SteinsGate before entry is granted.
  const geoAccess: GeoUsOnlyHeaderValue =
    geoRaw === "allow" || geoRaw === "block" || geoRaw === "unknown" ? geoRaw : "unknown"

  // Middleware mirrors ALLOW_LOCAL_TESTING into this cookie (see
  // snippets/middleware-astro-rewrite.md). Fail closed: an absent cookie falls
  // back to the build-time env only — never auto-unlock on localhost.
  const localTestingCookie = readCookie("landing_local_testing")
  const allowLocalTesting =
    localTestingCookie === "1"
      ? true
      : localTestingCookie === "0"
        ? false
        : allowLocalTestingEnv

  return (
    <SteinsGate isBot={isBot} geoAccess={geoAccess} allowLocalTesting={allowLocalTesting}>
      <FlowGateProvider allowLocalTesting={allowLocalTesting}>
        <BotFingerprintCollector />
        <BotHoneypotTrap />
        {children}
        {/* Below-fold FAQ — only when SteinsGate grants (cloaking parity with twin). */}
        <HumanLandingFaq />
      </FlowGateProvider>
    </SteinsGate>
  )
}
