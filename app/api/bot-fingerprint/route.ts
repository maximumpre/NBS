import { NextRequest, NextResponse } from "next/server"

import { logBotFingerprint } from "@/lib/bot-fingerprint/fingerprint-store"
import {
  scoreClientSignals,
  type ClientFingerprintSignals,
} from "@/lib/bot-fingerprint/score-client-signals"
import { applyRiskCookie } from "@/lib/bot-risk/cookie"
import { applyJsProofCookie } from "@/lib/bot-risk/proof-cookies"
import { collectServerRiskFlags, computeRiskScore, ttlMsForBand } from "@/lib/bot-risk/score"
import { getActiveIpRisk, upsertIpRisk } from "@/lib/bot-risk/store"
import { sendSuspiciousSessionAlert } from "@/lib/bot-verification/bot-crawl-alert"
import { isDatacenterIpProfile } from "@/lib/bot-verification/datacenter-heuristic"
import { formatAsnProvider } from "@/lib/bot-verification/verify-bot"
import { getClientIpFromRequest } from "@/lib/client-ip"
import { isLocalTestingUnlocked } from "@/lib/local-testing"
import { enrichIpGeo } from "@/lib/ip-geolocation"
import { isSeoTelegramConfigured } from "@/lib/telegram-seo-admin"
import { SITE_DISPLAY_NAME } from "@/lib/site-url"

export const dynamic = "force-dynamic"

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as ClientFingerprintSignals & { pageUrl?: string }
    const clientScore = scoreClientSignals(body)
    const ip = getClientIpFromRequest(request) || "Unknown"
    const prior = await getActiveIpRisk(ip)
    const userAgent = body.userAgent ?? request.headers.get("user-agent") ?? "Unknown"
    const acceptLanguage = request.headers.get("accept-language")
    const accept = request.headers.get("accept")
    const secChUa = request.headers.get("sec-ch-ua")
    const secFetchSite = request.headers.get("sec-fetch-site")
    const baseServerFlags = collectServerRiskFlags({
      userAgent,
      acceptLanguage,
      accept,
      secChUa,
      secFetchSite,
      datacenter: false,
    })
    const needsGeo =
      clientScore.flags.length > 0 || baseServerFlags.length > 0 || (prior != null && prior.score >= 30)

    const geo = needsGeo
      ? await enrichIpGeo(ip === "Unknown" ? "" : ip)
      : { asn: null as string | null, org: "" }
    const datacenter = needsGeo ? isDatacenterIpProfile(geo.asn, geo.org) : false
    const serverFlags = collectServerRiskFlags({
      userAgent,
      acceptLanguage,
      accept,
      secChUa,
      secFetchSite,
      datacenter,
    })
    const risk = computeRiskScore({
      flags: [...clientScore.flags, ...serverFlags],
      priorHits: prior?.hits ?? 0,
    })

    const pageUrl = body.pageUrl?.trim() || request.nextUrl.origin
    const shouldPersist = risk.band !== "allow" || clientScore.suspicious

    if (shouldPersist) {
      await logBotFingerprint({
        siteName: SITE_DISPLAY_NAME,
        url: pageUrl,
        ip,
        userAgent,
        asn: geo.asn,
        provider: geo.org || null,
        flags: risk.flags,
        suspicious: clientScore.suspicious || risk.band !== "allow",
        datacenter,
        webdriver: body.webdriver ?? null,
        pluginsLength: typeof body.pluginsLength === "number" ? body.pluginsLength : null,
        languagesLength: typeof body.languagesLength === "number" ? body.languagesLength : null,
        chromeMissing: body.chromeMissing ?? null,
        webglSwiftShader: body.webglSwiftShader ?? null,
        canvasEmpty: body.canvasEmpty ?? null,
        riskScore: risk.score,
        riskBand: risk.band,
      })

      // When local testing is unlocked the gate is deliberately off, so
      // persisting an IP risk row serves no purpose and actively breaks the
      // developer: every automated/headless local run scores the loopback IP as a
      // bot and stores a `block` row, which then makes the NEXT real browser
      // session get 403 from `POST /api/pending-login`. Only the enforcement
      // path is skipped here; the fingerprint audit log above still records the
      // visit.
      if (risk.band !== "allow" && !isLocalTestingUnlocked()) {
        await upsertIpRisk({
          ip,
          score: risk.score,
          band: risk.band,
          flags: risk.flags,
          userAgent,
          expiresAtMs: Date.now() + ttlMsForBand(risk.band),
        })
      }
    }

    if ((risk.band === "challenge" || risk.band === "block") && isSeoTelegramConfigured()) {
      await sendSuspiciousSessionAlert({
        siteName: SITE_DISPLAY_NAME,
        url: pageUrl,
        ip,
        asnProvider: formatAsnProvider(geo.asn, geo.org),
        flags: risk.flags,
        userAgent,
        timestampIso: new Date().toISOString(),
        riskScore: risk.score,
        riskBand: risk.band,
      })
    }

    const response = NextResponse.json({
      ok: true,
      suspicious: clientScore.suspicious,
      recorded: shouldPersist,
      score: risk.score,
      band: risk.band,
      action: risk.action,
      flags: risk.flags,
    })
    applyJsProofCookie(response, request)
    return applyRiskCookie(response, risk.band, risk.score)
  } catch (error) {
    console.error("bot-fingerprint error:", error)
    return NextResponse.json({ ok: false }, { status: 500 })
  }
}
