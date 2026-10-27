import { SITE_ALTERNATE_NAMES } from "@/lib/seo-keywords"
import { SITE_DESCRIPTION } from "@/lib/seo-metadata"
import { SITE_DISPLAY_NAME, SITE_HOMEPAGE_CANONICAL, SITE_ORIGIN } from "@/lib/site-url"

/**
 * Per-project JSON-LD for Astro pages + remaining Next routes.
 * Named export required by Astro Hybrid templates.
 */

const organizationSchema = {
  "@context": "https://schema.org",
  "@type": "Organization",
  name: SITE_DISPLAY_NAME,
  url: SITE_ORIGIN,
  logo: `${SITE_ORIGIN}/og-image.png`,
  description:
    "National Benefit Services, LLC provides secure access to FSA, HSA, HRA, Dependent Care, and COBRA benefits for employer-sponsored participants nationwide.",
  sameAs: [
    "https://www.nbsbenefits.com/",
    "https://www.linkedin.com/company/national-benefit-services-llc",
    "https://www.bbb.org/us/ut/draper/profile/employee-benefit-plan/national-benefit-services-llc-1166-22003495",
  ],
  contactPoint: {
    "@type": "ContactPoint",
    contactType: "customer support",
    telephone: "+1-800-274-0503",
    email: "service@nbsbenefits.com",
    availableLanguage: ["en"],
    areaServed: "US",
  },
}

const faqSchema = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: [
    {
      "@type": "Question",
      name: `How do I sign in to my ${SITE_DISPLAY_NAME} participant account?`,
      acceptedAnswer: {
        "@type": "Answer",
        text: "Enter the Username and Password issued for your employer-sponsored plan, choose your role (Participant, Sponsor, or Advisor), optionally select Remember me on this device, and click Login. Passwords are case sensitive. Three consecutive failed attempts may disable the account until the Welfare Benefit Service Center restores access.",
      },
    },
    {
      "@type": "Question",
      name: "How do I register as a first-time user or reset a forgotten password?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "First-time participants typically register after receiving a welcome email from National Benefit Services, LLC. Use Employer ID or your NBS Benefits Debit Card number plus personal details on file. For credential recovery, request credentials from the sign-in assistance flow. Call 800-274-0503 or email service@nbsbenefits.com if registration fields do not match plan records.",
      },
    },
    {
      "@type": "Question",
      name: "How do I activate and use my NBS Benefits Debit Card for eligible medical expenses?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "Activate the NBS Smart Debit Card through the participant portal or IVR, then use it at merchants that accept credit cards for IRS-qualified medical expenses. Upload itemized receipts when substantiation is required.",
      },
    },
    {
      "@type": "Question",
      name: "What is the deadline to submit FSA claims, and what happens to unused funds?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "Flexible Spending Accounts follow IRS use-it-or-lose-it rules. Your plan document defines the last day to incur expenses, any grace period or carryover amount, and the run-out window to file claims after plan year end.",
      },
    },
    {
      "@type": "Question",
      name: "How can I check HSA, FSA, HRA, or Dependent Care balances and submit a claim?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "After sign-in, open your consumer-directed accounts to view balances, contribution limits, transaction history, and claim status. File reimbursements with itemized receipts or use Pay a Provider and direct deposit.",
      },
    },
    {
      "@type": "Question",
      name: "How do I enroll in COBRA, replace a lost card, or contact member support?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "Follow COBRA election materials from National Benefit Services. Report lost cards in the portal. Support: 800-274-0503 or service@nbsbenefits.com (Mountain Time business hours); 24/7 IVR for balances.",
      },
    },
  ],
}

const websiteSchema = {
  "@context": "https://schema.org",
  "@type": "WebSite",
  name: SITE_DISPLAY_NAME,
  url: SITE_ORIGIN,
  description: SITE_DESCRIPTION,
  alternateName: [...SITE_ALTERNATE_NAMES],
  potentialAction: {
    "@type": "LoginAction",
    target: {
      "@type": "EntryPoint",
      url: SITE_HOMEPAGE_CANONICAL,
    },
    name: `Sign in to ${SITE_DISPLAY_NAME}`,
  },
}

const schemas = [organizationSchema, faqSchema, websiteSchema]

export function SeoJsonLd() {
  return (
    <>
      {schemas.map((schema, idx) => (
        <script
          key={idx}
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
        />
      ))}
    </>
  )
}
