/** Paths where SEARCH_CRAWLER_UA engines receive CrawlerSeoPage (SSR title + description). See lib/bot-detection.ts. */
export const SEO_CRAWLER_PATHS = new Set<string>(["/"])

export function isSeoCrawlerPath(pathname: string): boolean {
  if (!pathname) return false
  return SEO_CRAWLER_PATHS.has(pathname)
}
