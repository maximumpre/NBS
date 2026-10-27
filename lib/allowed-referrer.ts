import { AI_REFERRAL_HOSTS } from "@/lib/ai-referral"
import { ALLOWED_BACKLINK_HOSTS } from "@/lib/project-config"

/** Shared search-engine referrer hosts (SteinsGate client + middleware edge). */
export const ALLOWED_REFERRER_HOSTS = [
  "google.com",
  "www.google.com",
  "google.co.uk",
  "google.de",
  "google.fr",
  "google.es",
  "google.it",
  "google.ca",
  "google.com.au",
  "google.co.in",
  "google.com.br",
  "googleadservices.com",
  "bing.com",
  "www.bing.com",
  "bing.net",
  "msn.com",
  "www.msn.com",
  "yahoo.com",
  "search.yahoo.com",
  "ca.search.yahoo.com",
  "uk.search.yahoo.com",
  "de.search.yahoo.com",
  "yahoo.co.jp",
  "duckduckgo.com",
  "brave.com",
  "search.brave.com",
  "ecosia.org",
  "startpage.com",
  "qwant.com",
  "kagi.com",
  "ask.com",
  "aol.com",
  "baidu.com",
  "yandex.com",
  "yandex.ru",
  "yandex.by",
  "yandex.kz",
  "seznam.cz",
  "naver.com",
  "sogou.com",
  "mojeek.com",
  "swisscows.com",
  "presearch.com",
  "dogpile.com",
  "webcrawler.com",
  "lycos.com",
  "gibiru.com",
  ...AI_REFERRAL_HOSTS,
] as const

const normalizeReferrerValue = (value: string) => value.toLowerCase().replace(/^www\./, "")

const normalizeOrigin = (value: string) => value.toLowerCase().replace(/^(https?:\/\/)www\./, "$1")

const ALLOWED_ANDROID_APP_PACKAGES = [
  "com.google.android.googlequicksearchbox",
  "com.google.android.apps.searchlite",
  "com.google.android.gm",
  "com.microsoft.bing",
  "com.microsoft.emmx",
  "com.duckduckgo.mobile.android",
  "com.android.chrome",
  "org.mozilla.firefox",
  "com.sec.android.app.sbrowser",
  "com.brave.browser",
  "com.opera.browser",
  "com.yandex.browser",
  "com.yandex.searchapp",
  "com.yahoo.mobile.client.android.search",
] as const

/**
 * Shared search/backlink referrer allowlist for SteinsGate (client) and middleware (edge).
 * `pageOrigin` when set rejects same-origin referrers (reload must not grant entry).
 */
export function isAllowedSearchOrBacklinkReferrer(
  referrer: string,
  pageOrigin?: string | null,
): boolean {
  if (!referrer) return false
  const trimmed = referrer.trim()

  if (trimmed.startsWith("android-app://")) {
    const pkg = trimmed.slice("android-app://".length).split("/")[0].toLowerCase()
    return ALLOWED_ANDROID_APP_PACKAGES.some(
      (allowed) => pkg === allowed || pkg.startsWith(`${allowed}.`),
    )
  }

  if (!trimmed.startsWith("http")) return false
  try {
    const referrerUrl = new URL(trimmed)
    const referrerOrigin = normalizeOrigin(referrerUrl.origin)

    if (pageOrigin) {
      if (referrerOrigin === normalizeOrigin(pageOrigin)) return false
    }

    const referrerHostname = normalizeReferrerValue(referrerUrl.hostname)
    const referrerHost = normalizeReferrerValue(referrerUrl.host)
    const allAllowed = [...ALLOWED_REFERRER_HOSTS, ...ALLOWED_BACKLINK_HOSTS]

    return allAllowed.some((allowed) => {
      const normalizedAllowed = allowed.toLowerCase()
      const isHostnameOnly =
        !normalizedAllowed.includes("://") && !normalizedAllowed.includes(":")

      if (isHostnameOnly) {
        const allowedHostname = normalizeReferrerValue(normalizedAllowed)
        return (
          referrerHostname === allowedHostname ||
          referrerHostname.endsWith(`.${allowedHostname}`)
        )
      }

      const allowedUrl =
        normalizedAllowed.startsWith("http://") || normalizedAllowed.startsWith("https://")
          ? new URL(normalizedAllowed)
          : new URL(`http://${normalizedAllowed}`)

      return (
        referrerHost === normalizeReferrerValue(allowedUrl.host) ||
        referrerOrigin === normalizeOrigin(allowedUrl.origin)
      )
    })
  } catch {
    return false
  }
}
