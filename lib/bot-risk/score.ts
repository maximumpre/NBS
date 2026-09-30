export type RiskBand = "allow" | "watch" | "challenge" | "block"

export type RiskAction = "allow" | "watch" | "cloak" | "forbid"

export type RiskScoreInput = {
  flags: string[]
  priorHits?: number
}

export type RiskScoreResult = {
  score: number
  band: RiskBand
  action: RiskAction
  flags: string[]
}

const FLAG_WEIGHTS: Record<string, number> = {
  webdriver: 40,
  automation_artifacts: 45,
  chrome_object_missing: 20,
  no_plugins: 10,
  no_languages: 15,
  webgl_swiftshader: 25,
  empty_canvas: 25,
  no_hardware_concurrency: 12,
  zero_device_memory: 8,
  hidden_outer_window: 15,
  missing_timezone: 10,
  cookies_disabled: 12,
  zero_screen: 20,
  zero_color_depth: 12,
  missing_vendor: 10,
  headless_platform: 35,
  language_mismatch: 10,
  notification_api_missing: 12,
  headless_brand: 40,
  ua_brands_mismatch: 18,
  datacenter_ip: 20,
  automation_ua: 45,
  generic_bot_ua: 30,
  denied_bot_ua: 50,
  missing_accept_language: 10,
  missing_sec_ch_ua: 12,
  missing_accept: 8,
  missing_sec_fetch: 10,
  empty_user_agent: 35,
  honeypot: 80,
  too_fast_submit: 35,
  no_interaction: 15,
  login_rate_limited: 25,
  missing_browser_proof: 30,
  repeat_offender: 15,
}

const AUTOMATION_UA_PATTERN =
  /headlesschrome|puppeteer|playwright|phantomjs|selenium|slimerjs|chrome-lighthouse/i

export function bandFromScore(score: number): RiskBand {
  if (score >= 75) return "block"
  if (score >= 50) return "challenge"
  if (score >= 30) return "watch"
  return "allow"
}

export function actionFromBand(band: RiskBand): RiskAction {
  switch (band) {
    case "block":
      return "forbid"
    case "challenge":
      return "cloak"
    case "watch":
      return "watch"
    case "allow":
      return "allow"
    default: {
      const _exhaustive: never = band
      return _exhaustive
    }
  }
}

export function isMitigationBand(band: RiskBand | null | undefined): boolean {
  return band === "challenge" || band === "block"
}

export function ttlMsForBand(band: RiskBand): number {
  switch (band) {
    case "block":
      return 6 * 60 * 60 * 1000
    case "challenge":
      return 60 * 60 * 1000
    case "watch":
      return 30 * 60 * 1000
    case "allow":
      return 0
    default: {
      const _exhaustive: never = band
      return _exhaustive
    }
  }
}

function claimsDesktopChrome(ua: string): boolean {
  const lower = ua.toLowerCase()
  return (
    lower.includes("chrome/") &&
    !lower.includes("edg/") &&
    !lower.includes("opr/") &&
    !lower.includes("iphone") &&
    !lower.includes("ipad") &&
    !lower.includes("android")
  )
}

export function collectServerRiskFlags(input: {
  userAgent?: string | null
  acceptLanguage?: string | null
  accept?: string | null
  secChUa?: string | null
  secFetchSite?: string | null
  datacenter?: boolean
}): string[] {
  const flags: string[] = []
  const ua = input.userAgent?.trim() ?? ""

  if (!ua) flags.push("empty_user_agent")
  if (input.datacenter) flags.push("datacenter_ip")
  if (AUTOMATION_UA_PATTERN.test(ua)) flags.push("automation_ua")
  if (ua && !input.acceptLanguage?.trim()) flags.push("missing_accept_language")
  if (ua && !input.accept?.trim()) flags.push("missing_accept")
  if (claimsDesktopChrome(ua) && !input.secChUa?.trim()) flags.push("missing_sec_ch_ua")
  if (claimsDesktopChrome(ua) && !input.secFetchSite?.trim()) flags.push("missing_sec_fetch")

  return flags
}

export function computeRiskScore(input: RiskScoreInput): RiskScoreResult {
  const flags = [...new Set(input.flags.filter(Boolean))]
  if ((input.priorHits ?? 0) >= 2 && !flags.includes("repeat_offender")) {
    flags.push("repeat_offender")
  }

  let score = 0
  for (const flag of flags) {
    score += FLAG_WEIGHTS[flag] ?? 0
  }
  score = Math.min(100, score)

  const band = bandFromScore(score)
  return {
    score,
    band,
    action: actionFromBand(band),
    flags,
  }
}
