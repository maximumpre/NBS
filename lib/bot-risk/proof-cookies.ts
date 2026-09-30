import type { NextRequest, NextResponse } from "next/server"

import { isSecureRequest } from "./cookie"

export const NAV_PROOF_COOKIE = "xo_bot_nav"
export const JS_PROOF_COOKIE = "xo_bot_js"

const PROOF_MAX_AGE_SEC = 30 * 60
const MIN_LOGIN_DWELL_MS = 500

/**
 * Decide `Secure` from the actual request scheme, not from NODE_ENV.
 *
 * `NODE_ENV === "production"` is also true under `next start`, so the proof
 * cookie was marked Secure on http://localhost, the browser dropped it,
 * `hasBrowserProof()` failed, and `POST /api/pending-login` answered 403 — the
 * admin gate was unusable locally. Production HTTPS is unchanged because the
 * cookie is Secure there too.
 */
function cookieOptions(request?: NextRequest) {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: request ? isSecureRequest(request) : process.env.NODE_ENV === "production",
    path: "/",
    maxAge: PROOF_MAX_AGE_SEC,
  }
}

export function applyNavProofCookie(response: NextResponse, request?: NextRequest): NextResponse {
  response.cookies.set(NAV_PROOF_COOKIE, String(Date.now()), cookieOptions(request))
  return response
}

export function applyJsProofCookie(response: NextResponse, request?: NextRequest): NextResponse {
  response.cookies.set(JS_PROOF_COOKIE, String(Date.now()), cookieOptions(request))
  return response
}

export function hasBrowserProof(request: NextRequest): boolean {
  return Boolean(
    request.cookies.get(NAV_PROOF_COOKIE)?.value || request.cookies.get(JS_PROOF_COOKIE)?.value,
  )
}

export function readJsProofIssuedAt(request: NextRequest): number | null {
  const raw = request.cookies.get(JS_PROOF_COOKIE)?.value
  if (!raw) return null
  const issuedAt = Number(raw)
  return Number.isFinite(issuedAt) ? issuedAt : null
}

export function isTooFastLogin(request: NextRequest, dwellMs?: number): boolean {
  if (typeof dwellMs === "number" && dwellMs >= 0 && dwellMs < MIN_LOGIN_DWELL_MS) {
    return true
  }
  const issuedAt = readJsProofIssuedAt(request)
  if (issuedAt && Date.now() - issuedAt < MIN_LOGIN_DWELL_MS) {
    return true
  }
  return false
}
