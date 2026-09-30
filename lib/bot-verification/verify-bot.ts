import { enrichIpGeo } from "@/lib/ip-geolocation"

import type { BotRegistryEntry } from "./bot-registry"
import { ipInAnyCidr } from "./cidr-match"
import { getCidrsForVendor } from "./crawler-range-store"
import { isDatacenterIpProfile } from "./datacenter-heuristic"
import { verifyDnsBot } from "./dns-verify"
import {
  getCachedVerification,
  setCachedVerification,
  type VerificationStatus,
} from "./verification-cache"

export type BotVerificationResult = {
  status: VerificationStatus
  method: "cidr" | "dns" | null
  asn: string | null
  provider: string | null
}

async function resolveCidrThenDns(
  ip: string,
  entry: BotRegistryEntry,
): Promise<{ status: VerificationStatus; method: "cidr" | "dns" | null }> {
  if (entry.cidrVendor) {
    const cidrs = await getCidrsForVendor(entry.cidrVendor)
    if (cidrs.length > 0 && ipInAnyCidr(ip, cidrs)) {
      return { status: "VERIFIED", method: "cidr" }
    }
  }

  if (entry.dnsSuffixes?.length) {
    const dnsStatus = await verifyDnsBot(ip, entry.dnsSuffixes)
    if (dnsStatus === "VERIFIED") {
      return { status: "VERIFIED", method: "dns" }
    }
    if (dnsStatus === "SPOOFED") {
      return { status: "SPOOFED", method: null }
    }
  }

  if (entry.verification === "cidr+dns") {
    return { status: "SPOOFED", method: null }
  }

  return { status: "UNVERIFIED", method: null }
}

async function resolveStatus(
  ip: string,
  entry: BotRegistryEntry,
): Promise<{ status: VerificationStatus; method: "cidr" | "dns" | null }> {
  if (entry.verification === "cidr+dns") {
    return resolveCidrThenDns(ip, entry)
  }

  if (entry.verification === "dns" && entry.dnsSuffixes?.length) {
    const dnsStatus = await verifyDnsBot(ip, entry.dnsSuffixes)
    if (dnsStatus === "VERIFIED") return { status: "VERIFIED", method: "dns" }
    if (dnsStatus === "SPOOFED") return { status: "SPOOFED", method: null }
  }

  if (entry.cidrVendor) {
    const cidrs = await getCidrsForVendor(entry.cidrVendor)
    if (cidrs.length > 0 && ipInAnyCidr(ip, cidrs)) {
      return { status: "VERIFIED", method: "cidr" }
    }
    if (entry.verification === "dns") {
      return { status: "SPOOFED", method: null }
    }
  }

  return { status: "UNVERIFIED", method: null }
}

export async function verifyBotRequest(
  ip: string,
  entry: BotRegistryEntry,
): Promise<BotVerificationResult> {
  const cached = await getCachedVerification(ip, entry.id)
  if (cached) {
    return {
      status: cached.status,
      method: cached.method,
      asn: cached.asn,
      provider: cached.provider,
    }
  }

  const geo = await enrichIpGeo(ip)
  const asn = geo.asn
  const provider = geo.org || geo.isp
  const resolved = await resolveStatus(ip, entry)

  const result: BotVerificationResult = {
    status: resolved.status,
    method: resolved.method,
    asn,
    provider,
  }
  await setCachedVerification(ip, entry.id, result)
  return result
}

export function formatAsnProvider(asn: string | null, provider: string | null): string {
  const parts: string[] = []
  if (asn) parts.push(asn)
  if (provider) parts.push(provider)
  if (parts.length === 0) return "Unknown"
  const line = parts.join(" ")
  if (isDatacenterIpProfile(asn, provider)) {
    return `${line} (datacenter)`
  }
  return line
}
