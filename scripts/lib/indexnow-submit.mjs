/**
 * Shared IndexNow submit helper (Bing / IndexNow.org).
 * Used by member postbuild scripts and Odin's Chamber Index tab.
 */

export const INDEXNOW_ENDPOINT = "https://api.indexnow.org/IndexNow"

const PLACEHOLDER_KEYS = new Set([
  "YOUR_INDEXNOW_KEY_PLACEHOLDER",
  "YOUR_INDEXNOW_KEY",
  "your-indexnow-key-here",
  "",
])

/**
 * @param {string} siteOrigin — https://www.example.com (no trailing slash)
 * @param {string} key — IndexNow key
 * @returns {{ host: string, key: string, keyLocation: string, urlList: string[], home: string, sitemap: string }}
 */
export function buildIndexNowPayload(siteOrigin, key) {
  const base = String(siteOrigin || "").trim().replace(/\/$/, "")
  const k = String(key || "").trim()
  if (!base.startsWith("http")) {
    throw new Error("siteOrigin must be an https URL")
  }
  if (!k || PLACEHOLDER_KEYS.has(k)) {
    throw new Error("INDEXNOW_KEY is missing or still a placeholder")
  }
  const site = new URL(base)
  const home = `${base}/`
  const sitemap = `${base}/sitemap.xml`
  const keyLocation = `${base}/${k}.txt`
  return {
    host: site.hostname,
    key: k,
    keyLocation,
    urlList: [home, sitemap],
    home,
    sitemap,
  }
}

/**
 * @param {{ siteOrigin: string, key: string, siteName?: string }} opts
 * @returns {Promise<{
 *   ok: boolean
 *   httpStatus: number
 *   bodySnippet: string
 *   host: string
 *   keyLocation: string
 *   urlList: string[]
 *   siteName: string
 *   siteUrl: string
 *   errorMessage?: string
 * }>}
 */
export async function submitIndexNow(opts) {
  const { siteOrigin, key, siteName } = opts
  const payload = buildIndexNowPayload(siteOrigin, key)
  const displayName = siteName?.trim() || payload.host

  try {
    const res = await fetch(INDEXNOW_ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json; charset=utf-8" },
      body: JSON.stringify({
        host: payload.host,
        key: payload.key,
        keyLocation: payload.keyLocation,
        urlList: payload.urlList,
      }),
    })
    const bodyText = (await res.text().catch(() => "")).trim().slice(0, 500)
    const ok = res.status === 200 || res.status === 202
    return {
      ok,
      httpStatus: res.status,
      bodySnippet: bodyText,
      host: payload.host,
      keyLocation: payload.keyLocation,
      urlList: payload.urlList,
      siteName: displayName,
      siteUrl: siteOrigin.replace(/\/$/, ""),
      ...(ok ? {} : { errorMessage: bodyText || `HTTP ${res.status}` }),
    }
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e)
    return {
      ok: false,
      httpStatus: 0,
      bodySnippet: "",
      host: payload.host,
      keyLocation: payload.keyLocation,
      urlList: payload.urlList,
      siteName: displayName,
      siteUrl: siteOrigin.replace(/\/$/, ""),
      errorMessage: message,
    }
  }
}
