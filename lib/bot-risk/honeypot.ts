const HONEYPOT_KEYS = ["website", "url", "company", "company_url", "fax", "hp_field"] as const

export function readHoneypotValue(body: Record<string, unknown>): string {
  for (const key of HONEYPOT_KEYS) {
    const value = body[key]
    if (typeof value === "string" && value.trim()) return value.trim()
    if (typeof value === "number" && Number.isFinite(value)) return String(value)
  }
  return ""
}
