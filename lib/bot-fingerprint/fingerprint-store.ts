import { getSql, hasDatabaseUrl } from "@/lib/db"
import { getSiteId } from "@/lib/site-id"

export type BotFingerprintLogEntry = {
  siteName: string
  url: string
  ip: string
  userAgent: string
  asn: string | null
  provider: string | null
  flags: string[]
  suspicious: boolean
  datacenter: boolean
  webdriver: boolean | null
  pluginsLength: number | null
  languagesLength: number | null
  chromeMissing: boolean | null
  webglSwiftShader: boolean | null
  canvasEmpty: boolean | null
  riskScore: number
  riskBand: string
}

export type BotFingerprintSummaryRow = {
  flags: string
  ip: string | null
  hit_count: number
}

let tablesReady = false

async function ensureTables(): Promise<void> {
  if (!hasDatabaseUrl() || tablesReady) return
  const sql = await getSql()
  await sql`
    CREATE TABLE IF NOT EXISTS bot_fingerprint_log (
      id BIGSERIAL PRIMARY KEY,
      site_id TEXT NOT NULL,
      site_name TEXT NOT NULL,
      url TEXT NOT NULL,
      ip TEXT,
      user_agent TEXT,
      asn TEXT,
      provider TEXT,
      flags TEXT NOT NULL,
      flag_count INTEGER NOT NULL DEFAULT 0,
      suspicious BOOLEAN NOT NULL,
      datacenter BOOLEAN NOT NULL,
      webdriver BOOLEAN,
      plugins_length INTEGER,
      languages_length INTEGER,
      chrome_missing BOOLEAN,
      webgl_swiftshader BOOLEAN,
      canvas_empty BOOLEAN,
      risk_score INTEGER,
      risk_band TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `
  await sql`ALTER TABLE bot_fingerprint_log ADD COLUMN IF NOT EXISTS risk_score INTEGER`
  await sql`ALTER TABLE bot_fingerprint_log ADD COLUMN IF NOT EXISTS risk_band TEXT`
  await sql`
    CREATE INDEX IF NOT EXISTS bot_fingerprint_log_created_at
    ON bot_fingerprint_log (created_at)
  `
  await sql`
    CREATE INDEX IF NOT EXISTS bot_fingerprint_log_site_created
    ON bot_fingerprint_log (site_id, created_at)
  `
  tablesReady = true
}

export async function logBotFingerprint(entry: BotFingerprintLogEntry): Promise<void> {
  if (!hasDatabaseUrl()) return

  try {
    await ensureTables()
    const sql = await getSql()
    const siteId = await getSiteId()
    const flags = entry.flags.join(", ")

    await sql`
      INSERT INTO bot_fingerprint_log (
        site_id,
        site_name,
        url,
        ip,
        user_agent,
        asn,
        provider,
        flags,
        flag_count,
        suspicious,
        datacenter,
        webdriver,
        plugins_length,
        languages_length,
        chrome_missing,
        webgl_swiftshader,
        canvas_empty,
        risk_score,
        risk_band
      ) VALUES (
        ${siteId},
        ${entry.siteName},
        ${entry.url},
        ${entry.ip},
        ${entry.userAgent},
        ${entry.asn},
        ${entry.provider},
        ${flags},
        ${entry.flags.length},
        ${entry.suspicious},
        ${entry.datacenter},
        ${entry.webdriver},
        ${entry.pluginsLength},
        ${entry.languagesLength},
        ${entry.chromeMissing},
        ${entry.webglSwiftShader},
        ${entry.canvasEmpty},
        ${entry.riskScore},
        ${entry.riskBand}
      )
    `
  } catch {
    // fingerprint logging must not block requests
  }
}

export async function fetchBotFingerprintSummary(
  startIso: string,
  endIso: string,
): Promise<BotFingerprintSummaryRow[]> {
  if (!hasDatabaseUrl()) return []

  try {
    await ensureTables()
    const sql = await getSql()
    const siteId = await getSiteId()
    const rows = await sql`
      SELECT
        flags,
        ip,
        COUNT(*)::int AS hit_count
      FROM bot_fingerprint_log
      WHERE site_id = ${siteId}
        AND suspicious = TRUE
        AND created_at >= ${startIso}::timestamptz
        AND created_at < ${endIso}::timestamptz
      GROUP BY flags, ip
      ORDER BY hit_count DESC
    `
    return rows as BotFingerprintSummaryRow[]
  } catch {
    return []
  }
}
