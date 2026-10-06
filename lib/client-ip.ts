import type { NextRequest } from "next/server"

function isOnVercel(): boolean {
  return process.env.VERCEL === "1" || Boolean(process.env.VERCEL_ENV)
}

/**
 * Cloudflare is trusted when:
 * 1. Running on Cloudflare Pages / Workers (env markers CF_PAGES, CF_ACCOUNT_ID).
 * 2. Explicitly configured via CLOUDFLARE_PROXY=1 / BEHIND_CLOUDFLARE=1.
 * 3. On Vercel when the upstream TCP connection is proven to come from Cloudflare
 *    via Vercel's platform-verified ASN header (AS13335 or AS209242) and cf-ray header.
 */
function isBehindCloudflare(headers?: Headers): boolean {
  if (
    Boolean(
      process.env.CF_PAGES ||
      process.env.CF_ACCOUNT_ID ||
      process.env.CLOUDFLARE_PROXY === "1" ||
      process.env.BEHIND_CLOUDFLARE === "1",
    )
  ) {
    return true
  }

  if (headers && isOnVercel()) {
    const vercelAsn = headers.get("x-vercel-ip-as-number")?.trim()
    if (vercelAsn) {
      const clean = vercelAsn.replace(/^AS/i, "")
      if ((clean === "13335" || clean === "209242") && headers.has("cf-ray")) {
        return true
      }
    }
  }

  return false
}

export function getClientIpFromRequest(request: NextRequest): string {
  const h = request.headers

  if (isBehindCloudflare(h)) {
    const cfIp = h.get("cf-connecting-ip")?.trim()
    if (cfIp) return cfIp
  }

  const ordered = [
    h.get("x-vercel-forwarded-for"),
    h.get("x-forwarded-for"),
    h.get("true-client-ip"),
    h.get("x-real-ip"),
    h.get("fastly-client-ip"),
  ]

  for (const raw of ordered) {
    if (!raw) continue
    const first = raw.split(",")[0]?.trim()
    if (first) return first
  }

  const withIp = request as NextRequest & { ip?: string | null }
  if (withIp.ip) return String(withIp.ip)

  return ""
}
