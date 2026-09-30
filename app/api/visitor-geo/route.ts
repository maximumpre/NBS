import type { NextRequest } from "next/server"
import { NextResponse } from "next/server"
import { getClientIpFromRequest } from "@/lib/client-ip"
import { getRequestCountryCode } from "@/lib/edge-geo"
import { enrichIpGeo, isUnknownVisitorGeoProfile, isUsCountryCode } from "@/lib/ip-geolocation"

const ENRICH_TIMEOUT_MS = 4500

async function enrichIpGeoWithTimeout(clientIp: string) {
  return Promise.race([
    enrichIpGeo(clientIp),
    new Promise<Awaited<ReturnType<typeof enrichIpGeo>>>((resolve) => {
      setTimeout(
        () =>
          resolve({
            ip: clientIp.trim() || "Unknown",
            location: "Unknown",
            timezone: "Unknown",
            isp: "Unknown",
            org: "Unknown",
            asn: null,
            countryCode: null,
          }),
        ENRICH_TIMEOUT_MS,
      )
    }),
  ])
}

export async function GET(request: NextRequest) {
  const clientIp = getClientIpFromRequest(request)
  const edgeCountry = getRequestCountryCode(request)
  const geo = await enrichIpGeoWithTimeout(clientIp)
  const countryCode = edgeCountry || geo.countryCode
  const unknownVisitor = isUnknownVisitorGeoProfile(geo, clientIp)
  const isUs = isUsCountryCode(countryCode)
  return NextResponse.json(
    { unknownVisitor, countryCode, isUs },
    { headers: { "Cache-Control": "no-store" } },
  )
}
