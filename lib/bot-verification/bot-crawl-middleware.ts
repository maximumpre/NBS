import type { NextFetchEvent, NextRequest } from "next/server"

import { getClientIpFromRequest } from "@/lib/client-ip"
import { isLocalTestingUnlocked } from "@/lib/local-testing"
import { SITE_DISPLAY_NAME } from "@/lib/site-url"

import { logBotCrawlEvent } from "./bot-crawl-audit-store"
import { sendBotCrawlAlert } from "./bot-crawl-alert"
import { formatBotCategoryLabel, matchBotForAlert, shouldAlertForStatus } from "./bot-registry"
import { formatAsnProvider, verifyBotRequest } from "./verify-bot"

function shouldSkipPath(pathname: string): boolean {
  return (
    pathname.startsWith("/_next/static") ||
    pathname.startsWith("/_next/image") ||
    pathname.startsWith("/api/internal/")
  )
}

async function verifyAndAlertBot(request: NextRequest, userAgent: string): Promise<void> {
  const match = matchBotForAlert(userAgent)
  if (!match) return

  const ip = getClientIpFromRequest(request)
  const verification = await verifyBotRequest(ip, match.entry)

  await logBotCrawlEvent({
    siteName: SITE_DISPLAY_NAME,
    botId: match.entry.id,
    botLabel: match.entry.label,
    status: verification.status,
    url: request.nextUrl.href,
    ip: ip || "Unknown",
    userAgent,
    asn: verification.asn,
    provider: verification.provider,
    verifyMethod: verification.method,
  })

  if (!shouldAlertForStatus(match.entry.id, match.entry.tier, verification.status)) {
    return
  }

  await sendBotCrawlAlert({
    siteName: SITE_DISPLAY_NAME,
    botLabel: match.entry.label,
    category: formatBotCategoryLabel(match.entry.category),
    status: verification.status,
    verifyMethod: verification.method,
    url: request.nextUrl.href,
    ip: ip || "Unknown",
    asnProvider: formatAsnProvider(verification.asn, verification.provider),
    userAgent,
    timestampIso: new Date().toISOString(),
  })
}

export function notifyBotCrawlIfNeeded(request: NextRequest, event: NextFetchEvent): void {
  if (isLocalTestingUnlocked()) return

  const { pathname } = request.nextUrl
  if (shouldSkipPath(pathname)) return

  const userAgent = request.headers.get("user-agent") ?? ""
  const match = matchBotForAlert(userAgent)
  if (!match) return

  event.waitUntil(verifyAndAlertBot(request, userAgent).catch(() => {}))
}
