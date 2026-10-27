const DOH_URL = "https://cloudflare-dns.com/dns-query"

type DohAnswer = { name?: string; type?: number; data?: string }

const DNS_CACHE = new Map<string, { result: "VERIFIED" | "SPOOFED"; expiresAt: number }>()
const CACHE_TTL_MS = 60 * 60 * 1000 // 1 hour

async function dohQuery(name: string, type: "PTR" | "A" | "AAAA"): Promise<DohAnswer[]> {
  const url = `${DOH_URL}?name=${encodeURIComponent(name)}&type=${type}`
  const res = await fetch(url, {
    headers: { Accept: "application/dns-json" },
    cache: "no-store",
  })
  if (!res.ok) return []
  const data = (await res.json()) as { Answer?: DohAnswer[] }
  return data.Answer ?? []
}

function isPrivateIpv4(ip: string): boolean {
  const n = ip.split(".").map(Number)
  if (n.length !== 4 || n.some((x) => !Number.isInteger(x))) return true
  if (n[0] === 10) return true
  if (n[0] === 127) return true
  if (n[0] === 192 && n[1] === 168) return true
  if (n[0] === 172 && n[1] >= 16 && n[1] <= 31) return true
  return false
}

function ptrNameForIpv4(ip: string): string | null {
  if (isPrivateIpv4(ip)) return null
  const parts = ip.split(".")
  if (parts.length !== 4) return null
  return `${parts[3]}.${parts[2]}.${parts[1]}.${parts[0]}.in-addr.arpa`
}

function expandIpv6(ip: string): string | null {
  const clean = ip.toLowerCase().trim()
  if (!clean.includes(":")) return null
  if (clean === "::1" || clean.startsWith("fe80:") || clean.startsWith("fc00:") || clean.startsWith("fd00:")) {
    return null
  }
  const doubleColonIndex = clean.indexOf("::")
  let groups: string[] = []
  if (doubleColonIndex !== -1) {
    const left = clean.slice(0, doubleColonIndex).split(":").filter(Boolean)
    const right = clean.slice(doubleColonIndex + 2).split(":").filter(Boolean)
    const missing = 8 - (left.length + right.length)
    if (missing < 0) return null
    groups = [...left, ...Array(missing).fill("0"), ...right]
  } else {
    groups = clean.split(":").filter(Boolean)
  }
  if (groups.length !== 8) return null
  return groups.map((g) => g.padStart(4, "0")).join("")
}

function ptrNameForIpv6(ip: string): string | null {
  const hex32 = expandIpv6(ip)
  if (!hex32 || hex32.length !== 32) return null
  return `${hex32.split("").reverse().join(".")}.ip6.arpa`
}

function ptrNameForIp(ip: string): string | null {
  const trimmed = ip.trim()
  if (!trimmed) return null
  if (trimmed.includes(":")) return ptrNameForIpv6(trimmed)
  return ptrNameForIpv4(trimmed)
}

function hostnameMatchesSuffix(hostname: string, suffixes: readonly string[]): boolean {
  const lower = hostname.toLowerCase().replace(/\.$/, "")
  return suffixes.some((suffix) => {
    const s = suffix.toLowerCase()
    return lower === s.slice(1) || lower.endsWith(s)
  })
}

async function forwardResolvesToIp(hostname: string, ip: string): Promise<boolean> {
  const clean = hostname.replace(/\.$/, "")
  const [aRecords, aaaaRecords] = await Promise.all([
    dohQuery(clean, "A"),
    dohQuery(clean, "AAAA"),
  ])

  for (const record of aRecords) {
    if (record.data === ip) return true
  }

  if (ip.includes(":")) {
    const normalized = expandIpv6(ip)
    for (const record of aaaaRecords) {
      if (record.data && expandIpv6(record.data) === normalized) return true
    }
  }

  return false
}

export async function verifyDnsBot(
  ip: string,
  suffixes: readonly string[],
): Promise<"VERIFIED" | "SPOOFED" | "UNVERIFIED"> {
  const cleanIp = ip.trim()
  if (!cleanIp) return "UNVERIFIED"

  const cacheKey = `${cleanIp}|${suffixes.join(",")}`
  const cached = DNS_CACHE.get(cacheKey)
  if (cached && Date.now() < cached.expiresAt) {
    return cached.result
  }

  const ptrName = ptrNameForIp(cleanIp)
  if (!ptrName) return "UNVERIFIED"

  try {
    const ptrAnswers = await dohQuery(ptrName, "PTR")
    const hostname = ptrAnswers.find((a) => a.type === 12)?.data?.replace(/\.$/, "")
    if (!hostname) {
      DNS_CACHE.set(cacheKey, { result: "SPOOFED", expiresAt: Date.now() + CACHE_TTL_MS })
      return "SPOOFED"
    }

    if (!hostnameMatchesSuffix(hostname, suffixes)) {
      DNS_CACHE.set(cacheKey, { result: "SPOOFED", expiresAt: Date.now() + CACHE_TTL_MS })
      return "SPOOFED"
    }

    const forwardOk = await forwardResolvesToIp(hostname, cleanIp)
    const result = forwardOk ? "VERIFIED" : "SPOOFED"
    DNS_CACHE.set(cacheKey, { result, expiresAt: Date.now() + CACHE_TTL_MS })
    return result
  } catch {
    return "UNVERIFIED"
  }
}
