import { NextRequest, NextResponse } from "next/server"

import { refreshCrawlerIpRanges } from "@/lib/bot-verification/crawler-range-store"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

function isVercelCronInvocation(request: NextRequest): boolean {
  if (request.headers.get("x-vercel-cron-schedule")) return true

  const cronSecret = process.env.CRON_SECRET?.trim()
  if (!cronSecret) return false

  const auth = request.headers.get("authorization")?.trim()
  return auth === `Bearer ${cronSecret}`
}

function isManualTrigger(request: NextRequest): boolean {
  const isLocal =
    process.env.NODE_ENV !== "production" || process.env.VERCEL_ENV === "development"
  if (isLocal) return true

  const secret = process.env.CRON_SECRET?.trim()
  const param = request.nextUrl.searchParams.get("secret")?.trim()
  return !!(secret && param === secret)
}

export async function GET(request: NextRequest) {
  if (!isVercelCronInvocation(request) && !isManualTrigger(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    const counts = await refreshCrawlerIpRanges()
    return NextResponse.json({ ok: true, ...counts })
  } catch (error) {
    console.error("refresh-crawler-ip-ranges error:", error)
    return NextResponse.json({ error: "Failed to refresh ranges" }, { status: 500 })
  }
}
