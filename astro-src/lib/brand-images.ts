/**
 * Resolved image URLs for the Astro pages.
 *
 * CRITICAL: When importing assets via Vite/Astro, imported images return an
 * ImageMetadata OBJECT ({ src, width, height, format }), not a URL string.
 * Interpolating the object directly renders `src="[object Object]"` in <img>.
 *
 * NBS brand assets live in `public/` as root-relative paths.
 */

export const toImageUrl = (asset: string | { src: string }): string =>
  typeof asset === "string" ? asset : encodeURI(asset.src)

/** Header banner used by NbsAuthShell / crawler twin. */
export const BRAND_LOGO_SRC = "/Nbs%20banner_new.png"

/** LCP preload target — same banner (login has no separate hero photo). */
export const HERO_IMAGE_SRC = "/Nbs%20banner_new.png"

export const PARTNER_LOGO_SRC = "/LoginLogo.png"
