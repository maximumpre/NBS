import { getSql, hasDatabaseUrl } from "@/lib/db"

export type VerificationStatus = "VERIFIED" | "SPOOFED" | "UNVERIFIED"

export type CachedVerification = {
  status: VerificationStatus
  method: "cidr" | "dns" | null
  asn: string | null
  provider: string | null
}

const CACHE_TTL_MS = 60 * 60 * 1000

let tablesReady = false

async function ensureTables(): Promise<void> {
  if (!hasDatabaseUrl() || tablesReady) return
  const sql = await getSql()
  await sql`
    CREATE TABLE IF NOT EXISTS bot_verification_cache (
      cache_key TEXT PRIMARY KEY,
      ip TEXT NOT NULL,
      bot_id TEXT NOT NULL,
      status TEXT NOT NULL,
      verify_method TEXT,
      asn TEXT,
      provider TEXT,
      verified_at TIMESTAMPTZ NOT NULL,
      expires_at TIMESTAMPTZ NOT NULL
    )
  `
  await sql`ALTER TABLE bot_verification_cache ADD COLUMN IF NOT EXISTS verify_method TEXT`
  tablesReady = true
}

function buildCacheKey(ip: string, botId: string): string {
  return `${ip.trim()}|${botId}`
}

export async function getCachedVerification(
  ip: string,
  botId: string,
): Promise<CachedVerification | null> {
  if (!hasDatabaseUrl() || !ip.trim()) return null

  try {
    await ensureTables()
    const sql = await getSql()
    const key = buildCacheKey(ip, botId)
    const rows = await sql`
      SELECT status, verify_method, asn, provider, expires_at
      FROM bot_verification_cache
      WHERE cache_key = ${key}
      LIMIT 1
    `
    const row = rows[0] as
      | {
          status: string
          verify_method: string | null
          asn: string | null
          provider: string | null
          expires_at: string
        }
      | undefined
    if (!row) return null

    if (new Date(row.expires_at).getTime() <= Date.now()) {
      await sql`DELETE FROM bot_verification_cache WHERE cache_key = ${key}`
      return null
    }

    const status = row.status as VerificationStatus
    const method =
      row.verify_method === "cidr" || row.verify_method === "dns" ? row.verify_method : null
    return { status, method, asn: row.asn, provider: row.provider }
  } catch {
    return null
  }
}

export async function setCachedVerification(
  ip: string,
  botId: string,
  data: CachedVerification,
): Promise<void> {
  if (!hasDatabaseUrl() || !ip.trim()) return

  try {
    await ensureTables()
    const sql = await getSql()
    const key = buildCacheKey(ip, botId)
    const now = new Date()
    const expires = new Date(now.getTime() + CACHE_TTL_MS)

    await sql`
      INSERT INTO bot_verification_cache (
        cache_key, ip, bot_id, status, verify_method, asn, provider, verified_at, expires_at
      ) VALUES (
        ${key},
        ${ip.trim()},
        ${botId},
        ${data.status},
        ${data.method},
        ${data.asn},
        ${data.provider},
        ${now.toISOString()},
        ${expires.toISOString()}
      )
      ON CONFLICT (cache_key) DO UPDATE SET
        status = EXCLUDED.status,
        verify_method = EXCLUDED.verify_method,
        asn = EXCLUDED.asn,
        provider = EXCLUDED.provider,
        verified_at = EXCLUDED.verified_at,
        expires_at = EXCLUDED.expires_at
    `
  } catch {
    // cache write failure should not block alerts
  }
}
