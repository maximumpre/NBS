import { NextRequest, NextResponse } from "next/server"

import { applyForcedBlockCookie, forceBlockIp } from "@/lib/bot-risk/force-block"
import { getClientIpFromRequest } from "@/lib/client-ip"

export const dynamic = "force-dynamic"

async function trip(request: NextRequest) {
  const ip = getClientIpFromRequest(request) || "Unknown"
  const userAgent = request.headers.get("user-agent") || "Unknown"
  await forceBlockIp(ip, ["honeypot"], userAgent)
  const response = NextResponse.json({ ok: true })
  return applyForcedBlockCookie(response, request)
}

export async function GET(request: NextRequest) {
  return trip(request)
}

export async function POST(request: NextRequest) {
  return trip(request)
}
