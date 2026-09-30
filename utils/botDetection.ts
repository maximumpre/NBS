import { isDeniedBotUserAgent } from "@/lib/bot-verification/denied-bots"
import { AI_TRAINING_CRAWLER_UA } from "@/lib/ai-referral"

export { isDeniedBotUserAgent }

export const BOT_PATTERNS = {
    google: [
        /Mozilla\/5\.0 \(compatible; Googlebot\/2\.1; \+http:\/\/www\.google\.com\/bot\.html\)/i,
        /Mozilla\/5\.0 \(Linux; Android .*\) AppleWebKit\/.* \(KHTML, like Gecko\) Chrome\/41\.0\.2272\.96 .* \(compatible; Googlebot\/2\.1; \+http:\/\/www\.google\.com\/bot\.html\)/i,
        /Googlebot-Image\/1\.0/i,
        /Googlebot-Video\/1\.0/i,
        /Googlebot-News/i,
        /Googlebot-Favicon/i,
        /Google-InspectionTool/i,
        /Mozilla\/5\.0 \(Linux; Android .*\) AppleWebKit\/.* \(KHTML, like Gecko\) Chrome\/41\.0\.2272\.96 .* \(compatible; Google-AMPHTML\/1\.0; \+https:\/\/www\.google\.com\/bot\.html\)/i,
        /AMP Googlebot/i,
        /AdsBot-Google(\-Mobile)?/i,
        /Mediapartners-Google/i,
        /Feedfetcher-Google/i,
        /Googlebot/i
    ],
    bing: [
        /bingbot/i,
        /msnbot/i,
        /BingPreview/i,
        /MicrosoftPreview/i,
        /BingVideoPreview/i,
        /adidxbot/i
    ],
    yahoo: [
        /Slurp/i,
        /yahoo/i
    ],
    yandex: [
        /YandexBot/i,
        /YandexImages/i,
        /YandexVideo/i,
        /YandexMedia/i,
        /YandexBlogs/i
    ],
    baidu: [
        /Baiduspider/i,
        /Baiduspider-image/i,
        /Baiduspider-video/i
    ],
    petal: [
        /PetalBot/i,
        /petalbot/i,
    ],
    majestic: [
        /MJ12bot/i,
        /mj12bot/i,
    ],
    duckduckgo: [
        /DuckDuckBot/i,
        /DuckDuckGo-Favicons-Bot/i
    ],
    facebook: [
        /facebookexternalhit/i,
        /FacebookBot/i,
        /meta-externalfetcher/i,
    ],
    twitter: [
        /Twitterbot/i
    ],
    linkedin: [
        /LinkedInBot/i
    ],
    pinterest: [
        /Pinterest/i
    ],
    apple: [
        // Exclude Applebot-Extended (AI training) — matched under aiTraining
        /Applebot(?!-Extended)/i,
    ],
    /** Link unfurl / chat previews (previously only in middleware allow list) */
    messaging: [
        /slackbot/i,
        /discordbot/i,
        /whatsapp/i,
        /skypeuripreview/i,
        /telegrambot/i,
    ],
    snapchat: [
        /snapchat/i,
    ],
    /** AI citation / browse crawlers (CrawlerSeoPage allowlist) */
    aiReference: [
        /ChatGPT-User/i,
        /Claude-Web/i,
        /PerplexityBot/i,
        /DuckAssistBot/i,
        /YouBot/i,
        /OAI-SearchBot/i,
        /Claude-SearchBot/i,
        /Claude-User/i,
        /Perplexity-User/i,
        /meta-webindexer/i,
        /Amzn-SearchBot/i,
        /Amzn-User/i,
    ],
    /** AI training crawlers — not trusted for CrawlerSeoPage; robots Disallow:/ */
    aiTraining: [
        /Google-Extended/i,
        /Applebot-Extended/i,
        /GPTBot/i,
        /anthropic-ai/i,
        /ClaudeBot/i,
        /Bytespider/i,
        /cohere-ai/i,
        /Diffbot/i,
        /omgili/i,
        /Amazonbot/i,
        /CCBot/i,
        /commoncrawl/i,
        /cohere-training-data-crawler/i,
        /Coherebot/i,
    ],
    /** Discovery / archive (CrawlerSeoPage allowlist — not competitive SEO) */
    discovery: [
        /mojeekbot/i,
        /mojeek/i,
        /marginalia/i,
        /ia_archiver/i,
    ],
    other: [
        /crawler/i,
        /spider/i,
        /bot\//i,
        /slurp/i
    ]
};

// Detect bot type from user agent
export function detectBotType(ua: string): { isBot: boolean; botName: string | null } {
    if (!ua) return { isBot: false, botName: null };

    for (const [botName, patterns] of Object.entries(BOT_PATTERNS)) {
        if (patterns.some((p) => p.test(ua))) {
            return { isBot: true, botName };
        }
    }

    return { isBot: false, botName: null };
}

/**
 * Same crawler/bot classification as ReferrerProvider (`isCrawlerUserAgent`).
 * Use in middleware to exempt these UAs from the automated-client 403 when they match block heuristics.
 */
export function isKnownCrawlerUserAgent(userAgent: string | undefined | null): boolean {
    if (!userAgent) return false
    if (isDeniedBotUserAgent(userAgent)) return false
    return detectBotType(userAgent).isBot
}

/**
 * Trusted search/social crawlers only. Excludes {@link BOT_PATTERNS} `other` (generic bot/crawler/spider heuristics)
 * so unknown scrapers can be blocked client-side while real crawlers are allowed.
 */
export function isTrustedCrawlerUserAgent(userAgent: string | undefined | null): boolean {
    if (!userAgent) return false
    if (isDeniedBotUserAgent(userAgent)) return false
    // Training tokens (e.g. Applebot-Extended) must not inherit Applebot / search trust
    if (AI_TRAINING_CRAWLER_UA.test(userAgent)) return false
    const { isBot, botName } = detectBotType(userAgent)
    if (!isBot) return false
    if (botName === "other") return false
    if (botName === "aiTraining") return false
    return true
}

/** Alias for {@link isKnownCrawlerUserAgent} (visit notifications, etc.). */
export function isLikelyBotUserAgent(userAgent: string | undefined | null): boolean {
    return isKnownCrawlerUserAgent(userAgent)
}

export const isCrawlerUserAgent = (userAgent?: string) => {
    const ua = userAgent || (typeof navigator !== "undefined" ? navigator.userAgent : "");
    if (isDeniedBotUserAgent(ua)) return false
    const { isBot } = detectBotType(ua);
    return isBot;
};

// Get specific bot variant
export function getSpecificBotType(ua: string): string {
    if (!ua) return "Unknown Bot";

    // Google bots
    if (/Googlebot-Image/i.test(ua)) return "Googlebot-Image";
    if (/Googlebot-Video/i.test(ua)) return "Googlebot-Video";
    if (/Googlebot-News/i.test(ua)) return "Googlebot-News";
    if (/Googlebot-Favicon/i.test(ua)) return "Googlebot-Favicon";
    if (/Google-InspectionTool/i.test(ua)) return "Google-InspectionTool";
    if (/AdsBot-Google-Mobile/i.test(ua)) return "AdsBot-Google-Mobile";
    if (/AdsBot-Google/i.test(ua)) return "AdsBot-Google";
    if (/Mediapartners-Google/i.test(ua)) return "Mediapartners-Google";
    if (/Feedfetcher-Google/i.test(ua)) return "Feedfetcher-Google";
    if (/Googlebot/i.test(ua)) return "Googlebot";

    // Bing bots
    if (/bingbot/i.test(ua)) return "Bingbot";
    if (/msnbot/i.test(ua)) return "MSNBot";
    if (/BingVideoPreview/i.test(ua)) return "BingVideoPreview";
    if (/MicrosoftPreview/i.test(ua)) return "MicrosoftPreview";
    if (/BingPreview/i.test(ua)) return "BingPreview";
    if (/adidxbot/i.test(ua)) return "AdIdxBot";

    // Yandex bots
    if (/YandexImages/i.test(ua)) return "YandexImages";
    if (/YandexVideo/i.test(ua)) return "YandexVideo";
    if (/YandexMedia/i.test(ua)) return "YandexMedia";
    if (/YandexBlogs/i.test(ua)) return "YandexBlogs";
    if (/YandexBot/i.test(ua)) return "YandexBot";

    // Baidu bots
    if (/Baiduspider-image/i.test(ua)) return "Baiduspider-Image";
    if (/Baiduspider-video/i.test(ua)) return "Baiduspider-Video";
    if (/Baiduspider/i.test(ua)) return "Baiduspider";

    // DuckDuckGo
    if (/DuckDuckGo-Favicons-Bot/i.test(ua)) return "DuckDuckGo-Favicons";
    if (/DuckDuckBot/i.test(ua)) return "DuckDuckBot";

    // Social media bots
    if (/facebookexternalhit/i.test(ua)) return "FacebookExternalHit";
    if (/FacebookBot/i.test(ua)) return "FacebookBot";
    if (/Twitterbot/i.test(ua)) return "TwitterBot";
    if (/LinkedInBot/i.test(ua)) return "LinkedInBot";
    if (/Pinterest/i.test(ua)) return "PinterestBot";

    // Apple
    if (/Applebot/i.test(ua)) return "Applebot";

    // Yahoo
    if (/Slurp/i.test(ua)) return "Yahoo Slurp";

    return "Generic Bot";
}
