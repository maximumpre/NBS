import { getSql, hasDatabaseUrl } from "@/lib/db"

import type { VerificationStatus } from "./verification-cache"

export type BotCrawlAuditEntry = {
  siteName: string
  botId: string
  botLabel: string
  status: VerificationStatus
  url: string
  ip: string
  userAgent: string
  asn: string | null
  provider: string | null
  verifyMethod: "cidr" | "dns" | null
}

let tablesReady = false

async function ensureTables(): Promise<void> {
  if (!hasDatabaseUrl() || tablesReady) return
  const sql = await getSql()
  await sql`
    CREATE TABLE IF NOT EXISTS bot_crawl_audit_log (
      id BIGSERIAL PRIMARY KEY,
      site_name TEXT NOT NULL,
      bot_id TEXT NOT NULL,
      bot_label TEXT NOT NULL,
      status TEXT NOT NULL,
      url TEXT NOT NULL,
      ip TEXT,
      user_agent TEXT,
      asn TEXT,
      provider TEXT,
      verify_method TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `
  await sql`
    CREATE INDEX IF NOT EXISTS bot_crawl_audit_log_created_at
    ON bot_crawl_audit_log (created_at)
  `
  tablesReady = true
}

export async function logBotCrawlEvent(entry: BotCrawlAuditEntry): Promise<void> {
  if (!hasDatabaseUrl()) return

  try {
    await ensureTables()
    const sql = await getSql()
    await sql`
      INSERT INTO bot_crawl_audit_log (
        site_name,
        bot_id,
        bot_label,
        status,
        url,
        ip,
        user_agent,
        asn,
        provider,
        verify_method
      ) VALUES (
        ${entry.siteName},
        ${entry.botId},
        ${entry.botLabel},
        ${entry.status},
        ${entry.url},
        ${entry.ip},
        ${entry.userAgent},
        ${entry.asn},
        ${entry.provider},
        ${entry.verifyMethod}
      )
    `
  } catch {
    // audit logging must not block requests
  }
}

export type BotCrawlAuditSummaryRow = {
  bot_id: string
  bot_label: string
  ip: string | null
  hit_count: number
}

export async function fetchVerifiedBotCrawlSummary(
  startIso: string,
  endIso: string,
): Promise<BotCrawlAuditSummaryRow[]> {
  if (!hasDatabaseUrl()) return []

  try {
    await ensureTables()
    const sql = await getSql()
    const rows = await sql`
      SELECT
        bot_id,
        bot_label,
        ip,
        COUNT(*)::int AS hit_count
      FROM bot_crawl_audit_log
      WHERE status = 'VERIFIED'
        AND created_at >= ${startIso}::timestamptz
        AND created_at < ${endIso}::timestamptz
      GROUP BY bot_id, bot_label, ip
      ORDER BY bot_id, hit_count DESC
    `
    return rows as BotCrawlAuditSummaryRow[]
  } catch {
    return []
  }
}
