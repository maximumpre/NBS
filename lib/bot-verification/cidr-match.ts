function ipv4ToInt(ip: string): number | null {
  const parts = ip.trim().split(".")
  if (parts.length !== 4) return null
  let value = 0
  for (const part of parts) {
    const n = Number(part)
    if (!Number.isInteger(n) || n < 0 || n > 255) return null
    value = (value << 8) + n
  }
  return value >>> 0
}

function expandIpv6(ip: string): bigint | null {
  const lower = ip.trim().toLowerCase()
  if (!lower.includes(":")) return null

  const [head, tail] = lower.split("::")
  const headParts = head ? head.split(":") : []
  const tailParts = tail ? tail.split(":") : []
  const missing = 8 - (headParts.length + tailParts.length)
  if (missing < 0) return null

  const parts = [
    ...headParts,
    ...Array.from({ length: missing }, () => "0"),
    ...tailParts,
  ]

  if (parts.length !== 8) return null

  let value = BigInt(0)
  for (const part of parts) {
    if (!/^[0-9a-f]{1,4}$/i.test(part)) return null
    value = (value << BigInt(16)) + BigInt(parseInt(part, 16))
  }

  return value
}

export function ipv4InCidr(ip: string, cidr: string): boolean {
  const [network, prefixRaw] = cidr.split("/")
  const prefix = Number(prefixRaw)
  if (!network || !Number.isInteger(prefix) || prefix < 0 || prefix > 32) return false

  const ipInt = ipv4ToInt(ip)
  const networkInt = ipv4ToInt(network)
  if (ipInt === null || networkInt === null) return false

  const mask = prefix === 0 ? 0 : (0xffffffff << (32 - prefix)) >>> 0
  return (ipInt & mask) === (networkInt & mask)
}

export function ipv6InCidr(ip: string, cidr: string): boolean {
  const [network, prefixRaw] = cidr.split("/")
  const prefix = Number(prefixRaw)
  if (!network || !Number.isInteger(prefix) || prefix < 0 || prefix > 128) return false

  const ipInt = expandIpv6(ip)
  const networkInt = expandIpv6(network)
  if (ipInt === null || networkInt === null) return false

  if (prefix === 0) return true

  const hostBits = 128 - prefix
  const ipShifted = ipInt >> BigInt(hostBits)
  const networkShifted = networkInt >> BigInt(hostBits)
  return ipShifted === networkShifted
}

export function ipInAnyCidr(ip: string, cidrs: readonly string[]): boolean {
  const isV6 = ip.includes(":")
  for (const cidr of cidrs) {
    const cidrIsV6 = cidr.includes(":")
    if (isV6 !== cidrIsV6) continue
    if (cidrIsV6) {
      if (ipv6InCidr(ip, cidr)) return true
    } else if (ipv4InCidr(ip, cidr)) {
      return true
    }
  }
  return false
}

export function extractCidrs(payload: unknown): string[] {
  if (!payload || typeof payload !== "object") return []
  const prefixes = (payload as { prefixes?: unknown }).prefixes
  if (!Array.isArray(prefixes)) return []

  const cidrs: string[] = []
  for (const item of prefixes) {
    if (!item || typeof item !== "object") continue
    const ipv4 = (item as { ipv4Prefix?: string }).ipv4Prefix
    const ipv6 = (item as { ipv6Prefix?: string }).ipv6Prefix
    if (ipv4) cidrs.push(ipv4)
    if (ipv6) cidrs.push(ipv6)
  }
  return cidrs
}

export function extractGoogleCidrs(payload: unknown): string[] {
  return extractCidrs(payload)
}

export function extractBingCidrs(payload: unknown): string[] {
  return extractCidrs(payload)
}

export function extractAhrefsCidrs(payload: unknown): string[] {
  return extractCidrs(payload)
}
