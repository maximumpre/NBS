/**
 * Local QA bypass for geo/referrer gates (.env.local only).
 * Never honored on Vercel production — even if ALLOW_LOCAL_TESTING is set there by mistake.
 */
export function isLocalTestingUnlocked(): boolean {
  if (process.env.VERCEL_ENV === "production") {
    return false
  }

  const value = process.env.ALLOW_LOCAL_TESTING?.trim().toLowerCase()
  return value === "true" || value === "1" || value === "yes"
}
