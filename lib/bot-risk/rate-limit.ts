import { getSql, hasDatabaseUrl } from "@/lib/db"
import { getSiteId } from "@/lib/site-id"

let tablesReady = false

async function ensureTables(): Promise<void> {
  if (!hasDatabaseUrl() || tablesReady) return
  const sql = await getSql()
  await sql`
    CREATE TABLE IF NOT EXISTS bot_risk_rate_limits (
      site_id TEXT NOT NULL,
      ip TEXT NOT NULL,
      kind TEXT NOT NULL,
      window_start TIMESTAMPTZ NOT NULL,
      hit_count INTEGER NOT NULL DEFAULT 1,
      PRIMARY KEY (site_id, ip, kind)
    )
  `
  tablesReady = true
}

export async function consumeRateLimit(
  ip: string,
  kind: string,
  limit: number,
  windowMs: number,
): Promise<{ allowed: boolean; count: number }> {
  if (!hasDatabaseUrl() || !ip.trim() || ip === "Unknown") {
    return { allowed: true, count: 0 }
  }

  try {
    await ensureTables()
    const sql = await getSql()
    const siteId = await getSiteId()
    const rows = await sql`
      SELECT window_start, hit_count
      FROM bot_risk_rate_limits
      WHERE site_id = ${siteId}
        AND ip = ${ip.trim()}
        AND kind = ${kind}
      LIMIT 1
    `
    const row = rows[0] as { window_start: string; hit_count: number } | undefined
    const now = Date.now()
    const windowStartMs = row ? new Date(row.window_start).getTime() : 0
    const inWindow = row && Number.isFinite(windowStartMs) && now - windowStartMs < windowMs
    const nextCount = inWindow ? Number(row.hit_count) + 1 : 1
    const nextWindowStart = inWindow ? new Date(windowStartMs).toISOString() : new Date(now).toISOString()

    await sql`
      INSERT INTO bot_risk_rate_limits (site_id, ip, kind, window_start, hit_count)
      VALUES (${siteId}, ${ip.trim()}, ${kind}, ${nextWindowStart}, ${nextCount})
      ON CONFLICT (site_id, ip, kind) DO UPDATE SET
        window_start = EXCLUDED.window_start,
        hit_count = EXCLUDED.hit_count
    `

    return { allowed: nextCount <= limit, count: nextCount }
  } catch {
    return { allowed: true, count: 0 }
  }
}
