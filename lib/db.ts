import {
  getBackupDatabaseUrl,
  getDatabaseUrlForShard,
  hasBackupDatabaseUrl,
  hasDatabaseUrl,
  normalizeNeonDatabaseUrl,
} from '@/lib/database-urls'

export { hasDatabaseUrl, hasBackupDatabaseUrl }

let neonModPromise: Promise<typeof import('@neondatabase/serverless')> | null = null

async function loadNeon() {
  if (!neonModPromise) {
    neonModPromise = import('@neondatabase/serverless').then((mod) => {
      mod.neonConfig.fetchConnectionCache = true
      return mod
    })
  }
  return neonModPromise
}

async function createAsyncSql(url: string) {
  const { neon } = await loadNeon()
  return neon(normalizeNeonDatabaseUrl(url))
}

type Sql = Awaited<ReturnType<typeof createAsyncSql>>

const sqlByShard = new Map<number, Sql>()
let sqlBackup: Sql | null = null

export async function getSqlForShard(shardIndex = 0) {
  const cached = sqlByShard.get(shardIndex)
  if (cached) return cached
  const sql = await createAsyncSql(getDatabaseUrlForShard(shardIndex))
  sqlByShard.set(shardIndex, sql)
  return sql
}

export async function getSqlForBackup() {
  if (sqlBackup) return sqlBackup
  const url = getBackupDatabaseUrl()
  if (!url) {
    throw new Error('DATABASE_BACKUP_FALLBACK is not configured.')
  }
  sqlBackup = await createAsyncSql(url)
  return sqlBackup
}

/** Primary shard (SEO v1, backward-compatible default). */
export async function getSql() {
  return getSqlForShard(0)
}
