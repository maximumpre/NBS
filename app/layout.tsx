import type { ReactNode } from "react";
import type { Metadata, Viewport } from "next";
import { headers } from "next/headers";
import { Geist } from "next/font/google";
import { Analytics } from "@vercel/analytics/next";
import "./globals.css";
import CrawlerSeoPage from "@/components/CrawlerSeoPage";
import ProtectedLayout from "@/components/protected-layout";
import { isCrawlerSeoPreviewUnlocked } from "@/lib/crawler-seo-preview";
import { isSocialPreviewCrawlerUA, SEARCH_CRAWLER_UA, DISCOVERY_CRAWLER_UA } from "@/lib/bot-detection";
import { AI_REFERENCE_CRAWLER_UA, AI_TRAINING_CRAWLER_UA } from "@/lib/ai-referral";
import { isSeoCrawlerPath } from "@/lib/seo-crawler-paths";
import { SITE_KEYWORDS, SITE_ALTERNATE_NAMES } from "@/lib/seo-keywords";
import { SITE_DESCRIPTION } from "@/lib/seo-metadata";
import { SITE_DISPLAY_NAME, SITE_HOMEPAGE_CANONICAL, SITE_ORIGIN } from "@/lib/site-url";

const geist = Geist({ subsets: ["latin"] });

/* Step 6: metadataBase, canonical, og:url, og:image and twitter:image all derive
   from the single operator-pasted origin. This previously fell back to
   `https://nbs-auth.com`, a different host — so every social preview and
   canonical would have advertised a domain that is not this site. */
const SITE_BASE_URL = SITE_ORIGIN;
const SITE_BRAND = SITE_DISPLAY_NAME;

export const metadata: Metadata = {
  metadataBase: new URL(SITE_BASE_URL),
  title: {
    default: "National Benefit Services - Login",
    template: "%s | National Benefit Services",
  },
  keywords: SITE_KEYWORDS,
  description: SITE_DESCRIPTION,

  authors: [{ name: "National Benefit Services" }],
  creator: "National Benefit Services",
  publisher: "National Benefit Services",
  applicationName: SITE_BRAND,
  referrer: "origin-when-cross-origin",
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-video-preview": -1,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
  openGraph: {
    type: "website",
    locale: "en_US",
    title: "National Benefit Services - Login",
    description: SITE_DESCRIPTION,
    siteName: SITE_BRAND,
    // Same canonical constant as `alternates.canonical` so og:url can never
    // drift from the declared canonical.
    url: SITE_HOMEPAGE_CANONICAL,
    images: [
      {
        url: `${SITE_BASE_URL}/og-image.png`,
        width: 1200,
        height: 630,
        alt: `${SITE_BRAND}`,
      },
    ],
  },
  twitter: {
    // summary_large_image: og-image is 1200x630, and `summary` renders it as a
    // small thumbnail on X/Twitter instead of the full-width card.
    card: "summary_large_image",
    title: "National Benefit Services - Login",
    description: SITE_DESCRIPTION,
    images: [`${SITE_BASE_URL}/og-image.png`],
  },
  // RULE 4: the SERP favicon and the social preview are separate pipelines and are
  // never swapped. There is no legitimate NBS favicon source in this project yet
  // (the only square candidate is non-brand stock), so the OG image is NOT reused
  // here. Drop a real `public/favicon-source.png` and regenerate to populate these.
  // RULE 4 (BRAND_ICONS.md): the three brand surfaces are separate pipelines and
  // are never swapped. Every generated size must be declared here — a single
  // `favicon.ico` shortcut means most crawlers never see the 32/48 SERP icons.
  // og-image.png is the social preview + JSON-LD logo and is NOT reused here.
  icons: {
    icon: [
      { url: "/favicon.ico", sizes: "16x16" },
      { url: "/favicon-32x32.png", sizes: "32x32" },
      { url: "/icon-32x32.png", sizes: "32x32" },
      { url: "/icon-48x48.png", sizes: "48x48" },
    ],
    shortcut: "/favicon.ico",
    apple: "/apple-touch-icon.png",
  },
  category: "Business",
  alternates: {
    // SITE_HOMEPAGE_CANONICAL (trailing slash), not SITE_ORIGIN — the canonical
    // must match the single sitemap <loc> exactly, or the two disagree on the
    // one URL this site is meant to be known by.
    canonical: SITE_HOMEPAGE_CANONICAL,
    languages: {
      "en-US": SITE_HOMEPAGE_CANONICAL,
    },
  },
  other: {
    "geo.region": "US",
    // Bing reads the tile from here; without it the 48x48 SERP icon is never
    // surfaced to Bing (BRAND_ICONS.md §3a).
    "msapplication-TileImage": "/icon-48x48.png",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  themeColor: "#254650",
};

const organizationSchema = {
  "@context": "https://schema.org",
  "@type": "Organization",
  name: SITE_BRAND,
  url: SITE_BASE_URL,
  logo: `${SITE_BASE_URL}/og-image.png`,
  description:
    "National Benefit Services provides secure access to FSA, HSA, COBRA, and dependent care benefits through our employee benefits portal.",
  sameAs: [],
  contactPoint: {
    "@type": "ContactPoint",
    contactType: "Customer Support",
    availableLanguage: ["en"],
  },
};

const faqSchema = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: [
    {
      "@type": "Question",
      name: "How do I login to my National Benefit Services account?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "Visit the National Benefit Services participant portal and enter your username and password. Select your user role (Participant, Sponsor, or Advisor) and click LOGIN.",
      },
    },
    {
      "@type": "Question",
      name: "What is FSA login and how do I access it?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "FSA (Flexible Spending Account) login allows you to manage your health and dependent care reimbursement accounts through the National Benefit Services portal.",
      },
    },
    {
      "@type": "Question",
      name: "How do I reset my National Benefit Services password?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "Click the forgot password link on the login page. Follow the verification steps and set a new password for your account.",
      },
    },
    {
      "@type": "Question",
      name: "What benefits can I manage through this employee benefits portal?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "You can manage FSA (health and dependent care), HSA, COBRA continuation coverage, and other employee benefits through your secure account.",
      },
    },
  ],
};

const websiteSchema = {
  "@context": "https://schema.org",
  "@type": "WebSite",
  name: SITE_BRAND,
  // Next.js normalises the root canonical/og:url by dropping the trailing
  // slash, so the raw JSON-LD string matches them by using SITE_ORIGIN. Same URL
  // either way; identical bytes in the document avoid a needless audit diff.
  url: SITE_ORIGIN,
  // Brand phrases first, then the bare host last — Google's documented
  // fallback in `alternateName` when it cannot map the brand.
  alternateName: [...SITE_ALTERNATE_NAMES, new URL(SITE_ORIGIN).hostname.toLowerCase()],
};

const jsonLd = [organizationSchema, faqSchema, websiteSchema];

/**
 * Mirror of the middleware decision, used when the header/cookie stamp is absent
 * (e.g. a direct render). Kept in step with middleware.isCrawlerSeoPageUserAgent.
 */
function isCrawlerSeoPageUserAgent(ua: string): boolean {
  if (!ua) return false
  if (AI_TRAINING_CRAWLER_UA.test(ua)) return false
  if (/applebot-extended/i.test(ua)) return false
  if (SEARCH_CRAWLER_UA.test(ua)) return true
  if (DISCOVERY_CRAWLER_UA.test(ua)) return true
  if (AI_REFERENCE_CRAWLER_UA.test(ua)) return true
  return isSocialPreviewCrawlerUA(ua)
}

export const dynamic = "force-dynamic"

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // Step 5: allowed crawlers (and local `CSP=1` preview) get the SSR
  // CrawlerSeoPage twin. Everything else — every real member — renders the
  // interactive login exactly as before.
  const headerList = await headers();
  const pathname = headerList.get("x-pathname") ?? "";
  // Header first, then the RSC cookie (client navigation does not re-run
  // middleware), then a direct UA+path check. Header-only would regress to the
  // human UI in Search Console whenever a stamp is lost.
  const userAgent = headerList.get("user-agent") ?? "";
  const isCrawlerSeoPage =
    headerList.get("x-crawler-seo-page") === "1" ||
    (isCrawlerSeoPageUserAgent(userAgent) && isSeoCrawlerPath(pathname)) ||
    isCrawlerSeoPreviewUnlocked();

  return (
    <html lang="en-US">
      <head>
        <link
          href="https://fonts.googleapis.com/css2?family=Open+Sans:wght@300;400;600;700&display=swap"
          rel="stylesheet"
        />
        <link rel="icon" href="/favicon.ico" />
        <link rel="shortcut icon" href="/favicon.ico" />
        <link rel="apple-touch-icon" href="/apple-touch-icon.png" />
      </head>
      <body className={`${geist.className} font-sans antialiased`}>
        {jsonLd.map((schema, idx) => (
          <script
            key={idx}
            type="application/ld+json"
            dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
          />
        ))}
        {/* Step 4 gate: ProtectedLayout reads GEO_US_ONLY_HEADER and hands
            `isBot` + `geoAccess` to ReffererProvider, which serves the Chrome
            ErrorScreen to direct visits and non-US entries. It wraps ONLY the
            human branch — crawlers must never hit the referrer gate. */}
        {isCrawlerSeoPage ? <CrawlerSeoPage /> : <ProtectedLayout>{children}</ProtectedLayout>}
        <Analytics />
      </body>
    </html>
  );
}
