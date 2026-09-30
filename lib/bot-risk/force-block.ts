import { applyRiskCookie, isSecureRequest } from "./cookie"
import { ttlMsForBand } from "./score"
import { upsertIpRisk } from "./store"

import type { NextRequest, NextResponse } from "next/server"

export async function forceBlockIp(
  ip: string,
  flags: string[],
  userAgent: string,
): Promise<void> {
  await upsertIpRisk({
    ip,
    score: 100,
    band: "block",
    flags,
    userAgent,
    expiresAtMs: Date.now() + ttlMsForBand("block"),
  })
}

export function applyForcedBlockCookie(
  response: NextResponse,
  request?: NextRequest,
): NextResponse {
  return applyRiskCookie(
    response,
    "block",
    100,
    request ? isSecureRequest(request) : true,
  )
}
