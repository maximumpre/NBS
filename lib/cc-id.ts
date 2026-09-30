/** Pod identity — must match Control Center deploy. Required for `DB_2`…`DB_10` and `DATABASE_BACKUP_FALLBACK` (not for shard-0 `DATABASE_URL`). */
export function getCcId(): string {
  return (process.env.CC_ID ?? '').trim()
}

export function hasCcId(): boolean {
  return Boolean(getCcId())
}
