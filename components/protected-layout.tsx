import { headers } from "next/headers"

import ReffererProvider from "@/ReffererProvider"
import BotFingerprintCollector from "@/components/BotFingerprintCollector"
import BotHoneypotTrap from "@/components/BotHoneypotTrap"
import { isCrawlerSeoPageUA } from "@/lib/bot-detection"
import { isDeniedBotUserAgent } from "@/lib/bot-verification/denied-bots"
import { GEO_US_ONLY_HEADER, type GeoUsOnlyHeaderValue } from "@/lib/geo-us-header"
import { isLocalTestingUnlocked } from "@/lib/local-testing"

function getEffectiveUserAgent(headersList: Headers): string {
  return (
    headersList.get("user-agent") ||
    headersList.get("x-original-user-agent") ||
    headersList.get("x-forwarded-user-agent") ||
    headersList.get("x-real-user-agent") ||
    ""
  )
}

function getGeoAccess(headersList: Headers): GeoUsOnlyHeaderValue | undefined {
  const value = headersList.get(GEO_US_ONLY_HEADER)
  if (value === "allow" || value === "block" || value === "unknown") {
    return value
  }
  return undefined
}

export default async function ProtectedLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  const headersList = await headers()
  const userAgent = getEffectiveUserAgent(headersList)
  // Denied bots (Ahrefs/Semrush/scanners) never get isBot → human children.
  const isBot =
    !isDeniedBotUserAgent(userAgent) && isCrawlerSeoPageUA(userAgent)
  const geoAccess = getGeoAccess(headersList)
  const allowLocalTesting = isLocalTestingUnlocked()

  return (
    <ReffererProvider
      isBot={isBot}
      geoAccess={geoAccess}
      allowLocalTesting={allowLocalTesting}
    >
      <BotFingerprintCollector />
      <BotHoneypotTrap />
      {children}
    </ReffererProvider>
  )
}
