/** Request header set by middleware for US-only gating (read in `app/layout.tsx`). */
export const GEO_US_ONLY_HEADER = "x-geo-us-only" as const

export type GeoUsOnlyHeaderValue = "allow" | "block" | "unknown"
