/**
 * AI search / chat — human referrers + crawler split:
 * - Reference crawlers → CrawlerSeoPage + Allow:/
 * - Training crawlers → Disallow:/ (not on CrawlerSeoPage allowlist)
 * - Content-Signal preference: search=yes, ai-train=no, use=reference
 */

/** robots.txt / HTTP preference (not a hard lock; pair with Disallow for training UAs). */
export const CONTENT_SIGNAL =
  "search=yes, ai-train=no, use=reference" as const

/** IETF standard-track preference header (unknown params are ignored by spec). */
export const CONTENT_USAGE = "bots=y, search=y, train-ai=n" as const

/** Training / model-ingest crawlers — block site-wide in robots.txt. */
export const AI_TRAINING_CRAWLER_AGENTS = [
  "Google-Extended",
  "Applebot-Extended",
  "GPTBot",
  "anthropic-ai",
  "ClaudeBot",
  "Bytespider",
  "cohere-training-data-crawler",
  "cohere-ai",
  "Diffbot",
  "omgili",
  // Meta documents meta-externalagent as foundation-model training; its AI *search*
  // index is meta-webindexer, which is allowed above.
  "meta-externalagent",
  "Amazonbot",
  "CCBot",
  "commoncrawl",
  "Coherebot",
] as const

export const AI_TRAINING_CRAWLER_UA =
  /google-extended|applebot-extended|gptbot|anthropic-ai|claudebot|bytespider|cohere-training-data-crawler|cohere-ai|diffbot|omgili|meta-externalagent|amazonbot|ccbot|commoncrawl|coherebot/i

/**
 * User-triggered / citation crawlers — CrawlerSeoPage + Allow:/
 * (not model-training tokens).
 *
 * Additive correction (Step 5, vendor-documented):
 *  - `OAI-SearchBot` builds the index that produces **ChatGPT search citations**.
 *    Blocking it removes the site from ChatGPT answers (navigational links may
 *    survive). It was absent from the kit list.
 *  - `Claude-SearchBot` is Anthropic's search index. `Claude-Web` is not a token
 *    Anthropic publishes; the documented set is ClaudeBot / Claude-SearchBot /
 *    Claude-User. Kept `Claude-Web` for backwards compatibility and added the real
 *    search token alongside it.
 *  - `meta-webindexer` is Meta's **AI search** index (Meta states allowing it helps
 *    Meta cite/link content). `meta-externalagent` is documented by Meta as
 *    foundation-model **training**, so it is additionally blocked below.
 *  - `Amzn-SearchBot` is Amazon's search retriever (Alexa/Rufus), not training.
 */
export const AI_REFERENCE_CRAWLER_AGENTS = [
  "OAI-SearchBot",
  "ChatGPT-User",
  "Claude-SearchBot",
  "Claude-Web",
  "PerplexityBot",
  "DuckAssistBot",
  "YouBot",
  "meta-webindexer",
  "Amzn-SearchBot",
  "Claude-User",
  "Perplexity-User",
  "Amzn-User",
] as const

export const AI_REFERENCE_CRAWLER_UA =
  /oai-searchbot|chatgpt-user|claude-searchbot|claude-web|perplexitybot|duckassistbot|youbot|meta-webindexer|amzn-searchbot|claude-user|perplexity-user|amzn-user/i

/** @deprecated Use AI_REFERENCE_CRAWLER_AGENTS — kept for older call sites during migrate. */
export const AI_REFERRAL_CRAWLER_AGENTS = AI_REFERENCE_CRAWLER_AGENTS

/** @deprecated Use AI_REFERENCE_CRAWLER_UA */
export const AI_REFERRAL_CRAWLER_UA = AI_REFERENCE_CRAWLER_UA

/** document.referrer hosts for human traffic from AI chat / search UIs. */
export const AI_REFERRAL_HOSTS = [
  "chatgpt.com",
  "chat.openai.com",
  "openai.com",
  "perplexity.ai",
  "claude.ai",
  "anthropic.com",
  "copilot.microsoft.com",
  "copilot.com",
  "gemini.google.com",
  "you.com",
  "poe.com",
  "phind.com",
  "meta.ai",
  "x.ai",
  "grok.com",
] as const
