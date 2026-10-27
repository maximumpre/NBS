/**
 * `next/navigation` shim for the Astro build.
 *
 * The landing island is a self-contained client app: every navigation it
 * performs leaves the island for a full Next.js page (the Next server owns
 * /password, /verify*, /api/*). So push/replace become real document
 * navigations rather than soft client-side transitions.
 *
 * This is also WHY the Astro landing works: `router.push("/password")` from an
 * island lands on a real Next route, and `router.push("/")` from a Next page
 * (password step, verify, forgot-password) does a full load of `/`, which the
 * middleware rewrite serves from the built static file.
 */
"use client"

import { useCallback, useMemo } from "react"
import type { ReadonlyURLSearchParams } from "next/navigation"

type Router = {
  push: (href: string, options?: { scroll?: boolean }) => void
  replace: (href: string, options?: { scroll?: boolean }) => void
  refresh: () => void
  back: () => void
  forward: () => void
  prefetch: () => void
  preconnect: () => void
}

export function useRouter(): Router {
  return useMemo<Router>(
    () => ({
      push: (href) => { window.location.assign(href) },
      replace: (href) => { window.location.replace(href) },
      refresh: () => { window.location.reload() },
      back: () => { window.history.back() },
      forward: () => { window.history.forward() },
      prefetch: () => {},
      preconnect: () => {},
    }),
    [],
  )
}

export function usePathname(): string {
  if (typeof window === "undefined") return "/"
  return window.location.pathname
}

export function useSearchParams(): ReadonlyURLSearchParams {
  const search = typeof window === "undefined" ? "" : window.location.search
  return useMemo(() => new URLSearchParams(search) as unknown as ReadonlyURLSearchParams, [search])
}

export function useParams<T = Record<string, string | string[]>>(): T {
  return useMemo(() => ({} as T), [])
}

export function useSelectedLayoutSegment(): string | null { return null }
export function useSelectedLayoutSegments(): string[] { return [] }

export const RedirectType = { push: "push", replace: "replace" } as const

export function redirect(href: string): never {
  if (typeof window !== "undefined") window.location.replace(href)
  throw new Error(`redirect(${href})`)
}

export function permanentRedirect(href: string): never { return redirect(href) }
export function notFound(): never { throw new Error("NEXT_NOT_FOUND") }

/** Some components import the hook under this alias. */
export const useNavigation = useCallback
