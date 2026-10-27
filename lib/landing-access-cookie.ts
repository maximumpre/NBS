/**
 * Durable grant cookie so middleware can SSR-cloak direct humans (no flash of login UI)
 * while funnel reloads still work after a search-referrer grant.
 *
 * Client SteinsGate sets this when access is granted; clears when cloaked.
 * Middleware reads it on `/` / Astro landing entries.
 */
export const LANDING_ACCESS_COOKIE = "landing_access_granted" as const

/** Max age: one browser session day — long enough for OTP funnel, short enough to rotate. */
export const LANDING_ACCESS_MAX_AGE_SEC = 60 * 60 * 12

export function landingAccessCookieWriteOptions(secure: boolean) {
  return {
    path: "/",
    maxAge: LANDING_ACCESS_MAX_AGE_SEC,
    sameSite: "lax" as const,
    httpOnly: false,
    secure,
  }
}
