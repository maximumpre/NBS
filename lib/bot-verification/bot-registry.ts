export type BotVerificationMethod = "dns" | "cidr" | "cidr+dns" | "none"

export type BotTier = "seo_tool" | "search_crawler"

/** Display category for SEO Bot Crawl Telegram alerts (separate from alert `tier`). */
export type BotCategory = "search_engine" | "social_preview" | "discovery" | "seo_tool"

export type CrawlerVendor =
  | "google"
  | "bing"
  | "ahrefs"
  | "apple"
  | "duckduck"
  | "commoncrawl"
  | "facebook"
  | "marginalia"
  | "mojeek"
  | "semrush"
  | "yandex"
  | "telegram"
  | "cloudflare"
  | "openai"
  | "perplexity"

export type BotRegistryEntry = {
  id: string
  label: string
  tier: BotTier
  category: BotCategory
  substrings: readonly string[]
  verification: BotVerificationMethod
  cidrVendor?: CrawlerVendor
  dnsSuffixes?: readonly string[]
}

export function formatBotCategoryLabel(category: BotCategory): string {
  switch (category) {
    case "search_engine":
      return "Search engine"
    case "social_preview":
      return "Social preview"
    case "discovery":
      return "Discovery / archive"
    case "seo_tool":
      return "SEO tool"
  }
}

export const BOT_REGISTRY: readonly BotRegistryEntry[] = [
  {
    id: "ahrefs",
    label: "Ahrefs",
    tier: "seo_tool",
    category: "seo_tool",
    substrings: ["ahrefsbot", "ahrefssiteaudit"],
    verification: "cidr+dns",
    cidrVendor: "ahrefs",
    dnsSuffixes: [".ahrefs.com", ".ahrefs.net"],
  },
  {
    id: "semrush",
    label: "Semrush",
    tier: "seo_tool",
    category: "seo_tool",
    substrings: ["semrushbot", "semrush"],
    verification: "cidr",
    cidrVendor: "semrush",
  },
  {
    id: "moz",
    label: "Moz",
    tier: "seo_tool",
    category: "seo_tool",
    substrings: ["dotbot", "opensiteexplorer", "rogerbot"],
    verification: "none",
  },
  {
    id: "seokicks",
    label: "SeoKicks",
    tier: "seo_tool",
    category: "seo_tool",
    substrings: ["seokicks-robot", "seokicks"],
    verification: "none",
  },
  {
    id: "blexbot",
    label: "BLEXBot",
    tier: "seo_tool",
    category: "seo_tool",
    substrings: ["blexbot"],
    verification: "none",
  },
  {
    id: "dataforseo",
    label: "DataForSEO",
    tier: "seo_tool",
    category: "seo_tool",
    substrings: ["dataforseobot"],
    verification: "none",
  },
  {
    id: "serpstat",
    label: "Serpstat",
    tier: "seo_tool",
    category: "seo_tool",
    substrings: ["serpstatbot"],
    verification: "none",
  },
  {
    id: "screaming_frog",
    label: "Screaming Frog",
    tier: "seo_tool",
    category: "seo_tool",
    substrings: ["screaming frog", "screamingfrog"],
    verification: "none",
  },
  {
    id: "seranking",
    label: "SE Ranking",
    tier: "seo_tool",
    category: "seo_tool",
    substrings: ["seranking"],
    verification: "none",
  },
  {
    id: "linkdex",
    label: "Linkdex",
    tier: "seo_tool",
    category: "seo_tool",
    substrings: ["linkdexbot"],
    verification: "none",
  },
  {
    id: "cognitiveseo",
    label: "cognitiveSEO",
    tier: "seo_tool",
    category: "seo_tool",
    substrings: ["cognitiveseo"],
    verification: "none",
  },
  {
    id: "sistrix",
    label: "Sistrix",
    tier: "seo_tool",
    category: "seo_tool",
    substrings: ["sistrix"],
    verification: "none",
  },
  {
    id: "sitebulb",
    label: "Sitebulb",
    tier: "seo_tool",
    category: "seo_tool",
    substrings: ["sitebulb"],
    verification: "none",
  },
  {
    id: "megaindex",
    label: "MegaIndex",
    tier: "seo_tool",
    category: "seo_tool",
    substrings: ["megaindex"],
    verification: "none",
  },
  {
    id: "googlebot",
    label: "Googlebot",
    tier: "search_crawler",
    category: "search_engine",
    substrings: [
      "googlebot",
      "mediapartners-google",
      "adsbot-google",
      "feedfetcher-google",
      "google-inspectiontool",
      "storebot-google",
    ],
    verification: "dns",
    cidrVendor: "google",
    dnsSuffixes: [".googlebot.com", ".google.com", ".googleusercontent.com"],
  },
  {
    id: "bingbot",
    label: "Bingbot",
    tier: "search_crawler",
    category: "search_engine",
    substrings: ["bingbot", "msnbot", "bingpreview", "microsoftpreview", "bingvideopreview", "adidxbot"],
    verification: "dns",
    cidrVendor: "bing",
    dnsSuffixes: [".search.msn.com"],
  },
  {
    id: "duckduckbot",
    label: "DuckDuckBot",
    tier: "search_crawler",
    category: "search_engine",
    substrings: ["duckduckbot", "duckduckgo-favicons-bot"],
    verification: "cidr",
    cidrVendor: "duckduck",
  },
  {
    id: "yahoo_slurp",
    label: "Yahoo Slurp",
    tier: "search_crawler",
    category: "search_engine",
    substrings: ["slurp"],
    verification: "none",
  },
  {
    id: "baidu",
    label: "Baiduspider",
    tier: "search_crawler",
    category: "search_engine",
    substrings: ["baiduspider"],
    verification: "none",
  },
  {
    id: "petalbot",
    label: "Petalbot",
    tier: "search_crawler",
    category: "search_engine",
    substrings: ["petalbot"],
    verification: "none",
  },
  {
    id: "majestic",
    label: "Majestic",
    tier: "search_crawler",
    category: "search_engine",
    substrings: ["mj12bot"],
    verification: "none",
  },
  {
    id: "applebot",
    label: "Applebot",
    tier: "search_crawler",
    category: "search_engine",
    substrings: ["applebot"],
    verification: "dns",
    cidrVendor: "apple",
    dnsSuffixes: [".applebot.apple.com"],
  },
  {
    id: "commoncrawl",
    label: "Common Crawl (AI training — blocked)",
    tier: "search_crawler",
    category: "discovery",
    substrings: ["ccbot", "commoncrawl"],
    verification: "cidr",
    cidrVendor: "commoncrawl",
  },
  {
    id: "facebook",
    label: "Facebook Bot",
    tier: "search_crawler",
    category: "social_preview",
    substrings: ["facebookexternalhit", "facebot", "facebookbot", "meta-externalfetcher"],
    verification: "cidr",
    cidrVendor: "facebook",
  },
  {
    id: "marginalia",
    label: "Marginalia",
    tier: "search_crawler",
    category: "discovery",
    substrings: ["marginalia"],
    verification: "cidr",
    cidrVendor: "marginalia",
  },
  {
    id: "mojeek",
    label: "MojeekBot",
    tier: "search_crawler",
    category: "discovery",
    substrings: ["mojeekbot", "mojeek"],
    verification: "cidr",
    cidrVendor: "mojeek",
  },
  {
    id: "yandex",
    label: "Yandex",
    tier: "search_crawler",
    category: "search_engine",
    substrings: ["yandexbot", "yandex"],
    verification: "cidr",
    cidrVendor: "yandex",
  },
  {
    id: "telegram",
    label: "TelegramBot",
    tier: "search_crawler",
    category: "social_preview",
    substrings: ["telegrambot"],
    verification: "cidr",
    cidrVendor: "telegram",
  },
  {
    id: "openai",
    label: "OpenAI / SearchBot",
    tier: "search_crawler",
    category: "search_engine",
    substrings: ["oai-searchbot", "chatgpt-user", "gptbot"],
    verification: "cidr",
    cidrVendor: "openai",
  },
  {
    id: "perplexity",
    label: "PerplexityBot",
    tier: "search_crawler",
    category: "search_engine",
    substrings: ["perplexitybot", "perplexity-user"],
    verification: "cidr",
    cidrVendor: "perplexity",
  },
] as const

export type BotMatch = {
  entry: BotRegistryEntry
}

export function matchBotForAlert(userAgent: string | null | undefined): BotMatch | null {
  if (!userAgent?.trim()) return null
  const ua = userAgent.toLowerCase()

  for (const entry of BOT_REGISTRY) {
    if (entry.substrings.some((sig) => ua.includes(sig))) {
      return { entry }
    }
  }

  return null
}

export function shouldAlertForStatus(
  botId: string,
  tier: BotTier,
  status: "VERIFIED" | "SPOOFED" | "UNVERIFIED",
): boolean {
  if (botId === "ahrefs") {
    return status === "SPOOFED"
  }
  if (tier === "search_crawler") return true
  if (tier === "seo_tool") return true
  return status !== "VERIFIED"
}

export function getBotRegistryEntry(botId: string): BotRegistryEntry | null {
  return BOT_REGISTRY.find((entry) => entry.id === botId) ?? null
}
