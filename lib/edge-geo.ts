import type { NextRequest } from "next/server"

export function getRequestCountryCode(request: NextRequest): string | null {
  const fromGeo = (request as NextRequest & { geo?: { country?: string } }).geo?.country
  if (fromGeo && typeof fromGeo === "string") {
    return fromGeo.trim().toUpperCase() || null
  }
  const header = request.headers.get("x-vercel-ip-country")
  if (header) {
    return header.trim().toUpperCase() || null
  }
  return null
}
