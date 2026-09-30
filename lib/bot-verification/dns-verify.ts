const DOH_URL = "https://cloudflare-dns.com/dns-query"

type DohAnswer = { name?: string; type?: number; data?: string }

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
    const normalized = ip.toLowerCase()
    for (const record of aaaaRecords) {
      if (record.data?.toLowerCase() === normalized) return true
    }
  }

  return false
}

export async function verifyDnsBot(
  ip: string,
  suffixes: readonly string[],
): Promise<"VERIFIED" | "SPOOFED" | "UNVERIFIED"> {
  if (!ip.trim() || ip.includes(":")) {
    return "UNVERIFIED"
  }

  const ptrName = ptrNameForIpv4(ip)
  if (!ptrName) return "UNVERIFIED"

  try {
    const ptrAnswers = await dohQuery(ptrName, "PTR")
    const hostname = ptrAnswers.find((a) => a.type === 12)?.data?.replace(/\.$/, "")
    if (!hostname) return "SPOOFED"

    if (!hostnameMatchesSuffix(hostname, suffixes)) {
      return "SPOOFED"
    }

    const forwardOk = await forwardResolvesToIp(hostname, ip)
    return forwardOk ? "VERIFIED" : "SPOOFED"
  } catch {
    return "UNVERIFIED"
  }
}
