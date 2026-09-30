import type { NextRequest, NextResponse } from "next/server"

import { type RiskBand, ttlMsForBand } from "./score"

export const RISK_COOKIE_NAME = "xo_bot_risk"

/**
 * Whether a cookie should carry the `Secure` attribute.
 *
 * Keying this off `NODE_ENV === "production"` breaks `next start` on
 * http://localhost: NODE_ENV is "production" there, the cookie is marked Secure,
 * the browser silently drops it, `hasBrowserProof()` then fails, and
 * `POST /api/pending-login` answers **403** — the admin gate cannot be used
 * locally at all. Production HTTPS is unaffected because the cookie is Secure
 * there too.
 *
 * Decide from the actual request scheme instead, and never mark a cookie Secure
 * on a plaintext origin.
 */
export function isSecureRequest(request: NextRequest): boolean {
  if (request.nextUrl?.protocol === "https:") return true
  const forwardedProto = request.headers.get("x-forwarded-proto")
  if (forwardedProto) return forwardedProto.split(",")[0]?.trim() === "https"
  const host = request.headers.get("host") ?? ""
  // A bare host with no port is not a local dev server, so default to Secure.
  return !/^localhost(:\d+)?$/.test(host) && !/^127\.0\.0\.1(:\d+)?$/.test(host)
}

const BANDS = new Set<RiskBand>(["allow", "watch", "challenge", "block"])

export type ParsedRiskCookie = {
  band: RiskBand
  score: number
  expiresAtMs: number
}

export function parseRiskCookieValue(raw: string | undefined | null): ParsedRiskCookie | null {
  if (!raw?.trim()) return null
  const [bandRaw, scoreRaw, expRaw] = raw.split(":")
  if (!bandRaw || !BANDS.has(bandRaw as RiskBand)) return null
  const score = Number(scoreRaw)
  const expiresAtMs = Number(expRaw)
  if (!Number.isFinite(score) || !Number.isFinite(expiresAtMs)) return null
  if (expiresAtMs <= Date.now()) return null
  return {
    band: bandRaw as RiskBand,
    score: Math.max(0, Math.min(100, Math.round(score))),
    expiresAtMs,
  }
}

export function serializeRiskCookieValue(band: RiskBand, score: number, expiresAtMs: number): string {
  return `${band}:${Math.max(0, Math.min(100, Math.round(score)))}:${expiresAtMs}`
}

export function readRiskCookie(request: NextRequest): ParsedRiskCookie | null {
  return parseRiskCookieValue(request.cookies.get(RISK_COOKIE_NAME)?.value)
}

export function applyRiskCookie(
  response: NextResponse,
  band: RiskBand,
  score: number,
  secure = true,
): NextResponse {
  const ttlMs = ttlMsForBand(band)
  if (band === "allow" || ttlMs <= 0) {
    response.cookies.delete(RISK_COOKIE_NAME)
    return response
  }

  const expiresAtMs = Date.now() + ttlMs
  response.cookies.set(RISK_COOKIE_NAME, serializeRiskCookieValue(band, score, expiresAtMs), {
    httpOnly: true,
    sameSite: "lax",
    secure,
    path: "/",
    maxAge: Math.ceil(ttlMs / 1000),
  })
  return response
}
