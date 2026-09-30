/**
 * NBS SEO keywords.
 *
 * Google ignores the meta keywords tag; Bing may use it. Keep it natural —
 * these are the same terms the brand already targets, not a stuffing list.
 *
 * WIRED INTO:
 *  - `lib/seo-metadata.ts` → `SITE_KEYWORDS` (layout `<meta name="keywords">` + CrawlerSeoPage body)
 *  - structured data → `alternateName` (brand phrases first, bare host fallback last)
 *
 * ABSOLUTE KEYWORD PRESERVATION (Step 5 RULE 1):
 *  `LEGACY_KEYWORDS` is the verbatim pre-SEO baseline of 44 keywords that already
 *  shipped in `app/layout.tsx`. They are preserved untouched. Everything else is
 *  additive. Do not remove a member of LEGACY_KEYWORDS without an extraordinary
 *  technical reason recorded in the README changelog.
 */

import { SITE_DISPLAY_NAME } from "@/lib/site-url";

/**
 * The twin mirrors the human landing heading verbatim so the page a crawler
 * reads is the same page a member sees (§1B item 3 lookalike parity).
 */
export const PAGE_H1_HEADING = "Welcome to National Benefit Services, LLC";

/**
 * Verbatim baseline (44) from the pre-SEO `app/layout.tsx` metadata.
 * PRESERVED — see the note above.
 */
export const LEGACY_KEYWORDS = [
  "National Benefit Services",
  "employee benefits portal",
  "benefits login",
  "FSA account",
  "HSA account",
  "COBRA continuation",
  "benefits enrollment",
  "benefits claims",
  "participant login",
  "new user registration",
  "password reset",
  "benefits administration",
  "dependent care benefits",
  "healthcare benefits",
  "employer benefits portal",
  "broker benefits",
  "secure benefits login",
  "benefits account management",
  "benefits eligibility",
  "benefits customer support",
  "nbsbenefits",
  "national benefits services",
  "national benefits",
  "nbs login",
  "National Benefit Services login",
  "NBS Benefits login",
  "nbs HSA administrator",
  "nbs Flexible Spending Account (FSA) administrator",
  "nbs COBRA administration services",
  "nbs Health Reimbursement Arrangement (HRA) administrator",
  "nbs Employee benefits administration",
  "nbs 401(k) retirement plan administration",
  "nbs Third-party benefits administrator (TPA)",
  "nbs Employer benefits administration",
  "nbs retirement plan administration",
  "nbs third party administrator",
  "nbs benefit administration",
  "nbs COBRA administration",
  "nbs 401k administration",
  "nbs FSA administration",
  "nbs HSA administration",
  "nbs TPA benefits",
  "nbs employee benefits administrator",
  "nbs flexible benefit administration",
] as const;

/**
 * ADDITIVE — brand / navigational.
 * Observed: competitors publish distinct login labels per account type
 * ("FSA Login", "COBRA Login", "HSA Login" — BASIC; "Employee & Member Login"
 * — Benefitfocus; "Member Login" — LifeTime). Account-qualified login queries are
 * the dominant pattern in this SERP.
 */
export const ACCOUNT_LOGIN_KEYWORDS = [
  "FSA login",
  "HSA login",
  "COBRA login",
  "dependent care FSA login",
  "health FSA login",
  "HRA login",
  "benefits account login",
  "account access",
  "NBS benefits login",
  "NBS participant portal",
  "National Benefit Services participant login",
  "NBS benefits card",
  "NBS debit card",
] as const;

/**
 * ADDITIVE — account types and plan documents.
 * Observed: the brand carries these (nbsbenefits.com Health & Welfare and
 * Retirement sections) and they are the terms the informational SERP uses.
 */
export const ACCOUNT_TYPE_KEYWORDS = [
  "flexible spending account",
  "dependent care flexible spending account",
  "health savings account",
  "health reimbursement arrangement",
  "COBRA continuation coverage",
  "limited purpose FSA",
  "limited purpose HRA",
  "post-deductible FSA",
  "suspended HRA",
  "retiree-only HRA",
  "excepted benefit HRA",
  "HSA-compatible FSA",
  "high deductible health plan",
  "transit and parking benefits",
  "premium only plan",
  "Section 125 cafeteria plan",
  "Archer MSA",
] as const;

/**
 * ADDITIVE — plan-year deadlines. Highest observed intent with the thinnest
 * observed supply: "run-out period" appeared on only ~3-4 publishers in the
 * research sweep, and the brand has no page for it.
 */
export const DEADLINE_KEYWORDS = [
  "FSA carryover",
  "FSA rollover",
  "FSA grace period",
  "FSA run-out period",
  "use it or lose it FSA",
  "last day to incur expenses",
  "plan year end FSA",
  "FSA contribution limits",
  "HSA contribution limits",
  "catch-up contributions",
] as const;

/**
 * ADDITIVE — participant tasks (what a member actually types once inside).
 * "submit a claim" / "file a claim" was the most universal verb pair observed
 * across the whole competitor corpus.
 */
export const TASK_KEYWORDS = [
  "submit a claim",
  "file a benefits claim",
  "FSA reimbursement",
  "reimburse myself",
  "claim status",
  "FSA eligible expenses",
  "HSA eligible expenses",
  "pay a provider",
  "direct deposit reimbursement",
  "replacement benefits card",
  "report lost debit card",
  "view account balance",
] as const;

/**
 * ADDITIVE — enrollment events.
 */
export const ENROLLMENT_KEYWORDS = [
  "open enrollment benefits",
  "annual benefits election",
  "qualifying life event",
  "change in status benefits",
  "benefits eligibility period",
] as const;

/**
 * ADDITIVE — support / recovery intent. Mirrors the observed
 * "I forgot my login" / "Need help logging in for the first time?" content
 * pattern (WageWorks "Login Help", LifeTime, BRI, Sentinel Group).
 */
export const SUPPORT_KEYWORDS = [
  "forgot my username",
  "forgot my password",
  "reset my benefits password",
  "first time login",
  "request credentials",
  "login help",
  "trouble logging in",
  "user id login",
  "benefits support phone number",
] as const;

/** Role labels offered by this portal's own dropdown (Participant/Sponsor/Advisor). */
export const ROLE_KEYWORDS = [
  "sponsor login",
  "advisor login",
  "employer benefits login",
] as const;

function mergeKeywords(
  ...lists: readonly (readonly string[])[]
): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const list of lists) {
    for (const raw of list) {
      const keyword = raw.trim();
      if (!keyword) continue;
      const key = keyword.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      out.push(keyword);
    }
  }
  return out;
}

/**
 * EXISTING + NEW, de-duplicated case-insensitively. Legacy keywords are listed
 * first so the shipped baseline always leads the list.
 */
export function buildSiteKeywords(): string[] {
  return mergeKeywords(
    LEGACY_KEYWORDS,
    ACCOUNT_LOGIN_KEYWORDS,
    ACCOUNT_TYPE_KEYWORDS,
    DEADLINE_KEYWORDS,
    TASK_KEYWORDS,
    ENROLLMENT_KEYWORDS,
    SUPPORT_KEYWORDS,
    ROLE_KEYWORDS
  );
}

export const SITE_KEYWORDS = buildSiteKeywords();

/**
 * Brand phrases for JSON-LD `alternateName`, listed before the bare host that
 * the schema site appends last as Google's documented fallback.
 */
const BRAND_SAFE_PHRASES = [
  "National Benefit Services benefits portal",
  "National Benefit Services participant login",
  "NBS employee benefits administration",
] as const;

export const SITE_ALTERNATE_NAMES = mergeKeywords(
  [SITE_DISPLAY_NAME, "National Benefit Services", "NBS", "NBS Benefits"],
  BRAND_SAFE_PHRASES
);
