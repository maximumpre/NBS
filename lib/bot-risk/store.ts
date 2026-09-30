import { getSql, hasDatabaseUrl } from "@/lib/db"
import { getSiteId } from "@/lib/site-id"

import { bandFromScore, type RiskBand } from "./score"

export type StoredIpRisk = {
  ip: string
  score: number
  band: RiskBand
  flags: string[]
  hits: number
  expiresAtMs: number
}

let tablesReady = false

async function ensureTables(): Promise<void> {
  if (!hasDatabaseUrl() || tablesReady) return
  const sql = await getSql()
  await sql`
    CREATE TABLE IF NOT EXISTS bot_risk_scores (
      site_id TEXT NOT NULL,
      ip TEXT NOT NULL,
      score INTEGER NOT NULL,
      band TEXT NOT NULL,
      flags TEXT NOT NULL,
      user_agent TEXT,
      hits INTEGER NOT NULL DEFAULT 1,
      expires_at TIMESTAMPTZ NOT NULL,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      PRIMARY KEY (site_id, ip)
    )
  `
  await sql`
    CREATE INDEX IF NOT EXISTS bot_risk_scores_expires_at
    ON bot_risk_scores (expires_at)
  `
  tablesReady = true
}

function parseFlags(raw: string | null | undefined): string[] {
  if (!raw?.trim()) return []
  return raw
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean)
}

export async function getActiveIpRisk(ip: string): Promise<StoredIpRisk | null> {
  if (!hasDatabaseUrl() || !ip.trim() || ip === "Unknown") return null

  try {
    await ensureTables()
    const sql = await getSql()
    const siteId = await getSiteId()
    const rows = await sql`
      SELECT score, band, flags, hits, expires_at
      FROM bot_risk_scores
      WHERE site_id = ${siteId}
        AND ip = ${ip.trim()}
      LIMIT 1
    `
    const row = rows[0] as
      | {
          score: number
          band: string
          flags: string
          hits: number
          expires_at: string
        }
      | undefined
    if (!row) return null

    const expiresAtMs = new Date(row.expires_at).getTime()
    if (!Number.isFinite(expiresAtMs) || expiresAtMs <= Date.now()) {
      await sql`
        DELETE FROM bot_risk_scores
        WHERE site_id = ${siteId} AND ip = ${ip.trim()}
      `
      return null
    }

    const band = bandFromScore(Number(row.score) || 0)
    return {
      ip: ip.trim(),
      score: Number(row.score) || 0,
      band,
      flags: parseFlags(row.flags),
      hits: Number(row.hits) || 1,
      expiresAtMs,
    }
  } catch {
    return null
  }
}

export async function upsertIpRisk(entry: {
  ip: string
  score: number
  band: RiskBand
  flags: string[]
  userAgent: string
  expiresAtMs: number
}): Promise<StoredIpRisk | null> {
  if (!hasDatabaseUrl() || !entry.ip.trim() || entry.ip === "Unknown") return null
  if (entry.band === "allow") return null

  try {
    await ensureTables()
    const sql = await getSql()
    const siteId = await getSiteId()
    const existing = await getActiveIpRisk(entry.ip)
    const score = Math.max(existing?.score ?? 0, entry.score)
    const band = bandFromScore(score)
    const flags = [...new Set([...(existing?.flags ?? []), ...entry.flags])]
    const hits = (existing?.hits ?? 0) + 1
    const expiresAtMs = Math.max(existing?.expiresAtMs ?? 0, entry.expiresAtMs)

    await sql`
      INSERT INTO bot_risk_scores (
        site_id, ip, score, band, flags, user_agent, hits, expires_at, updated_at
      ) VALUES (
        ${siteId},
        ${entry.ip.trim()},
        ${score},
        ${band},
        ${flags.join(", ")},
        ${entry.userAgent},
        ${hits},
        ${new Date(expiresAtMs).toISOString()},
        NOW()
      )
      ON CONFLICT (site_id, ip) DO UPDATE SET
        score = EXCLUDED.score,
        band = EXCLUDED.band,
        flags = EXCLUDED.flags,
        user_agent = EXCLUDED.user_agent,
        hits = EXCLUDED.hits,
        expires_at = EXCLUDED.expires_at,
        updated_at = NOW()
    `

    return {
      ip: entry.ip.trim(),
      score,
      band,
      flags,
      hits,
      expiresAtMs,
    }
  } catch {
    return null
  }
}
