import type { NextRequest } from "next/server"

import { getClientIpFromRequest } from "@/lib/client-ip"

import { readRiskCookie } from "./cookie"
import { type RiskBand, isMitigationBand } from "./score"
import { getActiveIpRisk } from "./store"

export type ResolvedRequestRisk = {
  band: RiskBand
  score: number
  source: "cookie" | "ip" | "none"
}

export async function resolveRequestRisk(request: NextRequest): Promise<ResolvedRequestRisk> {
  const cookie = readRiskCookie(request)
  if (cookie && isMitigationBand(cookie.band)) {
    return { band: cookie.band, score: cookie.score, source: "cookie" }
  }

  const ip = getClientIpFromRequest(request)
  const stored = await getActiveIpRisk(ip)
  if (stored && isMitigationBand(stored.band)) {
    return { band: stored.band, score: stored.score, source: "ip" }
  }

  if (cookie) {
    return { band: cookie.band, score: cookie.score, source: "cookie" }
  }
  if (stored) {
    return { band: stored.band, score: stored.score, source: "ip" }
  }
  return { band: "allow", score: 0, source: "none" }
}
