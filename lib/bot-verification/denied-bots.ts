/**
 * Bots that must never see CrawlerSeoPage or human login HTML.
 * Enforced at origin via middleware (`origin-request-gate.ts` + `handleBotIfNeeded`).
 * Token list may also be mirrored for optional CloudFaire fleet WAF.
 *
 * Competitive SEO (hard deny): Ahrefs + Semrush only.
 * Other seo_tool registry entries are not listed here — they still must not get
 * human HTML (ErrorScreen via non-allowlist).
 */

/** Competitive SEO tools forced to ErrorScreen. */
export const DENIED_SEO_UA_TOKENS = [
  "ahrefsbot",
  "ahrefssiteaudit",
  "semrushbot",
  "semrush",
] as const

/** Security / recon / vuln scanners — ErrorScreen. */
export const DENIED_SCANNER_UA_TOKENS = [
  "nuclei",
  "sqlmap",
  "nikto",
  "nessus",
  "openvas",
  "masscan",
  "zgrab",
  "nmap",
  "wpscan",
  "dirbuster",
  "gobuster",
  "ffuf",
  "httpx",
  "katana",
  "burpsuite",
  "burp",
  "acunetix",
  "qualys",
  "rapid7",
  "nessus",
  "shodan",
  "censys",
  "zoomeye",
  "binaryedge",
  "whatweb",
  "w3af",
  "arachni",
  "skipfish",
  "jaeles",
  "feroxbuster",
  "dirsearch",
  "python-nmap",
  "libredtail",
  "havij",
  "pangolin",
] as const

/** Flat list of lowercase UA tokens for origin deny matching. */
export const DENIED_BOT_UA_TOKENS = [
  ...DENIED_SEO_UA_TOKENS,
  ...DENIED_SCANNER_UA_TOKENS,
] as const

const DENIED_PATTERN = new RegExp(
  DENIED_BOT_UA_TOKENS.map((t) => t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|"),
  "i",
)

export function isDeniedBotUserAgent(userAgent: string | undefined | null): boolean {
  if (!userAgent?.trim()) return false
  return DENIED_PATTERN.test(userAgent)
}
