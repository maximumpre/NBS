import { getNetworkHintLabel } from "@/lib/bot-verification/datacenter-heuristic"

const SEP = "━━━━━━━━━━━━━━━━━"

export interface SeoVisitNotificationData {
  siteName: string
  siteUrl: string
  searchEngineLabel: string
  referrerRaw: string
  pageUrl: string
  location?: string
  localTime?: string
  ip?: string
  isp?: string
  asn?: string | null
  org?: string | null
}

function parseChatIds(): string[] {
  return process.env.TELEGRAM_SEO_ADMIN
    ? process.env.TELEGRAM_SEO_ADMIN.split(",")
        .map((id) => id.trim())
        .filter(Boolean)
    : []
}

export function isSeoTelegramConfigured(): boolean {
  return Boolean(process.env.TELEGRAM_SEO_BOT_TOKEN?.trim() && parseChatIds().length > 0)
}

export async function sendSeoAdminMessage(message: string): Promise<boolean> {
  const token = process.env.TELEGRAM_SEO_BOT_TOKEN?.trim()
  const chatIds = parseChatIds()

  if (!token || chatIds.length === 0) {
    return false
  }

  const results = await Promise.allSettled(
    chatIds.map((chatId) =>
      fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: chatId,
          text: message,
        }),
      }),
    ),
  )

  return results.some((r) => r.status === "fulfilled")
}

export interface IndexNowNotificationData {
  siteName: string
  siteUrl: string
  success: boolean
  httpStatus?: number
  responseSnippet?: string
  urlList: string[]
  keyLocation: string
  errorMessage?: string
}

export function formatIndexNowNotification(data: IndexNowNotificationData): string {
  const statusLine = data.success
    ? `📊 Status: ✅ Submitted — HTTP ${data.httpStatus ?? 200}`
    : data.errorMessage
      ? `📊 Status: ❌ Error — ${data.errorMessage}`
      : `📊 Status: ❌ Failed — HTTP ${data.httpStatus ?? "unknown"}${
          data.responseSnippet ? ` (${data.responseSnippet})` : ""
        }`

  const lines = [
    `📡 IndexNow — ${data.siteName}`,
    data.siteUrl,
    SEP,
    statusLine,
    "🔗 URLs submitted:",
    ...data.urlList.map((url) => `  • ${url}`),
    `🔑 Key location: ${data.keyLocation}`,
    `🕐 Time: ${new Date().toISOString()}`,
    SEP,
  ]

  return lines.join("\n")
}

export async function sendIndexNowNotification(data: IndexNowNotificationData): Promise<boolean> {
  if (!isSeoTelegramConfigured()) return false
  return sendSeoAdminMessage(formatIndexNowNotification(data))
}

export async function sendSeoVisitNotification(data: SeoVisitNotificationData): Promise<boolean> {
  if (!isSeoTelegramConfigured()) return false

  const referrerDisplay =
    data.referrerRaw === "Direct" || !data.referrerRaw ? "(direct)" : data.referrerRaw

  const lines = [
    `🔍 SEO Visit — ${data.siteName}`,
    data.siteUrl,
    SEP,
    `🔎 Search engine: ${data.searchEngineLabel}`,
    `🔗 Referrer: ${referrerDisplay}`,
    `🌐 Page: ${data.pageUrl}`,
  ]

  if (data.location?.trim()) {
    lines.push(`📍 Location: ${data.location.trim()}`)
  }
  if (data.ip?.trim()) {
    lines.push(`🌍 IP: ${data.ip.trim()}`)
  }
  if (data.isp?.trim()) {
    lines.push(`🌐 ISP: ${data.isp.trim()}`)
  }
  const networkHint = getNetworkHintLabel(data.asn, data.org || data.isp)
  if (networkHint) {
    lines.push(`🛡️ Network: ${networkHint}`)
  }
  if (data.localTime?.trim()) {
    lines.push(`🕒 Local time: ${data.localTime.trim()}`)
  }

  return sendSeoAdminMessage(lines.join("\n"))
}

export type SearchCrawlerVerificationStatus = "VERIFIED" | "SPOOFED" | "UNVERIFIED"

export interface SearchCrawlerNotificationData {
  botLabel: string
  /** Human label e.g. "Search engine", "Social preview", "SEO tool" */
  category: string
  status: SearchCrawlerVerificationStatus
  verifyMethod: "cidr" | "dns" | null
  url: string
  ip: string
  asnProvider: string
  userAgent: string
  timestampIso: string
}

function formatSearchCrawlerStatusLine(
  status: SearchCrawlerVerificationStatus,
  verifyMethod: "cidr" | "dns" | null,
): string {
  if (status === "VERIFIED") {
    if (verifyMethod === "cidr") {
      return "📊 Status: ✅ VERIFIED (official CIDR)"
    }
    if (verifyMethod === "dns") {
      return "📊 Status: ✅ VERIFIED (DNS confirmed)"
    }
    return "📊 Status: ✅ VERIFIED (DNS/IP confirmed)"
  }
  if (status === "SPOOFED") {
    return "📊 Status: ⚠️ SPOOFED (failed CIDR + DNS checks)"
  }
  return "📊 Status: ⚠️ UNVERIFIED"
}

export function formatSearchCrawlerNotification(data: SearchCrawlerNotificationData): string {
  const lines = [
    "🕷️ SEO Bot Crawl Detected",
    "",
    `🤖 Bot: ${data.botLabel}`,
    `📂 Category: ${data.category}`,
    formatSearchCrawlerStatusLine(data.status, data.verifyMethod),
    `🔗 URL: ${data.url}`,
    `🌐 IP: ${data.ip || "Unknown"}`,
    `🏢 ASN/Provider: ${data.asnProvider}`,
    `💻 User-Agent: ${data.userAgent}`,
    `🕐 Time: ${data.timestampIso}`,
    SEP,
  ]

  return lines.join("\n")
}

export async function sendSearchCrawlerNotification(
  data: SearchCrawlerNotificationData,
): Promise<boolean> {
  if (!isSeoTelegramConfigured()) return false
  return sendSeoAdminMessage(formatSearchCrawlerNotification(data))
}
