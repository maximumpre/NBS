import { permanentRedirect } from "next/navigation"

/**
 * Legacy `/login` — permanent redirect to homepage so crawlers do not index a competing URL.
 * Login UI lives at `/` (Astro landing).
 */
export default function LoginRedirectPage() {
  permanentRedirect("/")
}
