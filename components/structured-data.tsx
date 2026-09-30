import type { ReactNode } from "react"

import { SITE_ALTERNATE_NAMES } from "@/lib/seo-keywords"
import { SITE_DESCRIPTION } from "@/lib/seo-metadata"
import {
  SITE_DISPLAY_NAME,
  SITE_HOMEPAGE_CANONICAL,
  SITE_ORIGIN,
  canonicalHostFromOrigin,
} from "@/lib/site-url"

/**
 * WebSite JSON-LD for Google Search site names.
 * Wire into app/layout.tsx inside <body> (before ProtectedLayout).
 * Full guide: SEO_SITE_NAMES.md
 *
 * Step 6: every value derives from lib/site-url.ts / lib/seo-metadata.ts. This
 * file previously carried kit placeholders (`Example Benefits Portal`,
 * `https://www.example.com`), which would have shipped that brand and domain
 * verbatim to Google, Bing and every social/AI preview.
 */

const LAYOUT_DESCRIPTION = SITE_DESCRIPTION

/**
 * Real brand variations / acronyms first — taken from the shared keyword set.
 * The bare lowercase host is appended LAST at the schema site: Google's
 * documented fallback when it cannot map the brand, not a string to lead with.
 */
const SCHEMA_ALTERNATE_NAMES = SITE_ALTERNATE_NAMES

export function StructuredData() {
  const structuredData = {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: SITE_DISPLAY_NAME,
    alternateName: [...SCHEMA_ALTERNATE_NAMES, canonicalHostFromOrigin().toLowerCase()],
    url: SITE_HOMEPAGE_CANONICAL,
    description: LAYOUT_DESCRIPTION,
    inLanguage: "en-US",
    publisher: {
      "@type": "Organization",
      name: SITE_DISPLAY_NAME,
      url: SITE_ORIGIN,
      logo: `${SITE_ORIGIN}/og-image.png`,
    },
    potentialAction: {
      "@type": "LoginAction",
      target: {
        "@type": "EntryPoint",
        url: SITE_HOMEPAGE_CANONICAL,
      },
      name: `Sign in to ${SITE_DISPLAY_NAME}`,
    },
  }

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }}
    />
  )
}

/** Example root layout wiring */
export function ExampleLayoutWithStructuredData({ children }: { children: ReactNode }) {
  return (
    <body>
      <StructuredData />
      {children}
    </body>
  )
}
