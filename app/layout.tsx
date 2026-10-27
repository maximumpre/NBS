import type { Metadata, Viewport } from "next";
import { Geist } from "next/font/google";
import { Analytics } from "@vercel/analytics/next";
import "./globals.css";
import ProtectedLayout from "@/components/protected-layout";
import { SeoJsonLd } from "@/components/seo-json-ld";
import { SITE_KEYWORDS } from "@/lib/seo-keywords";
import { SITE_DESCRIPTION, SITE_TITLE } from "@/lib/seo-metadata";
import { SITE_DISPLAY_NAME, SITE_HOMEPAGE_CANONICAL, SITE_ORIGIN } from "@/lib/site-url";

const geist = Geist({ subsets: ["latin"] });

const SITE_BASE_URL = SITE_ORIGIN;
const SITE_BRAND = SITE_DISPLAY_NAME;

export const metadata: Metadata = {
  metadataBase: new URL(SITE_BASE_URL),
  title: {
    default: SITE_TITLE,
    template: `%s | ${SITE_DISPLAY_NAME}`,
  },
  keywords: SITE_KEYWORDS,
  description: SITE_DESCRIPTION,

  authors: [{ name: SITE_DISPLAY_NAME }],
  creator: SITE_DISPLAY_NAME,
  publisher: SITE_DISPLAY_NAME,
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
    title: SITE_TITLE,
    description: SITE_DESCRIPTION,
    siteName: SITE_BRAND,
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
    card: "summary_large_image",
    title: SITE_TITLE,
    description: SITE_DESCRIPTION,
    images: [`${SITE_BASE_URL}/og-image.png`],
  },
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
    canonical: SITE_HOMEPAGE_CANONICAL,
    languages: {
      "en-US": SITE_HOMEPAGE_CANONICAL,
    },
  },
  other: {
    "geo.region": "US",
    "msapplication-TileImage": "/icon-48x48.png",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  themeColor: "#254650",
};

export const dynamic = "force-dynamic";

/**
 * Remaining Next routes only — `/` and the crawler twin are Astro static files
 * rewritten by middleware after the gate chain.
 */
export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
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
        <SeoJsonLd />
        <ProtectedLayout>{children}</ProtectedLayout>
        <Analytics />
      </body>
    </html>
  );
}
