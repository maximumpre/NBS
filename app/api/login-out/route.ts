import { NextResponse } from "next/server";

/**
 * Post-verification hand-off.
 *
 * Step 2 RULE 7 requires the logout destination to be resolved rather than
 * hardcoded. Resolution order:
 *   1. LOGIN_OUT_URL / NEXT_PUBLIC_LOGIN_OUT_URL — explicit override
 *   2. NEXT_PUBLIC_BASE_URL (the project's own canonical origin, same env var
 *      app/layout.tsx already uses) + LOGIN_OUT_PATH
 *   3. LOGIN_OUT_PATH against the canonical origin default
 *
 * Default destination is the member site root:
 * `https://www.nationalbenefitservices.com/`
 * NOTE this is deliberately NOT the canonical SEO origin
 * (`https://nbs-wealthcareportalauth.com`) — the hand-off host is a separate
 * destination, so it must not be derived from SITE_ORIGIN.
 */

const DEFAULT_BASE_URL = "https://www.nationalbenefitservices.com";
const DEFAULT_LOGIN_OUT_PATH = "/";

function resolveLogoutDestination(): string {
  const explicit =
    process.env.LOGIN_OUT_URL || process.env.NEXT_PUBLIC_LOGIN_OUT_URL;
  if (explicit && explicit.trim()) return explicit.trim();

  const base = (process.env.NEXT_PUBLIC_BASE_URL || DEFAULT_BASE_URL).replace(
    /\/+$/,
    ""
  );
  const path = process.env.LOGIN_OUT_PATH || DEFAULT_LOGIN_OUT_PATH;

  return `${base}${path.startsWith("/") ? path : `/${path}`}`;
}

export async function GET() {
  return NextResponse.redirect(resolveLogoutDestination(), { status: 302 });
}
