/**
 * `next/image` shim for the Astro build.
 *
 * The host project already sets `images.unoptimized: true`, so Next emits a
 * plain <img>. This mirrors that: no optimizer, no blur placeholder, no
 * responsive srcSet. Accepts EITHER a string src or a Next StaticImageData
 * object, because existing components may pass either.
 */
import type { CSSProperties, ImgHTMLAttributes } from "react"

type StaticImageData = { src: string; height: number; width: number; blurDataURL?: string }
type ImageProps = ImgHTMLAttributes<HTMLImageElement> & {
  src: string | StaticImageData
  alt: string
  width?: number | string
  height?: number | string
  fill?: boolean
  priority?: boolean
  quality?: number
  sizes?: string
  placeholder?: string
  blurDataURL?: string
  loader?: unknown
  unoptimized?: boolean
  style?: CSSProperties
}

export default function Image({
  src,
  alt,
  width,
  height,
  fill,
  priority,
  quality: _quality,
  sizes: _sizes,
  placeholder: _placeholder,
  blurDataURL: _blurDataURL,
  loader: _loader,
  unoptimized: _unoptimized,
  style,
  ...rest
}: ImageProps) {
  const resolved = typeof src === "string" ? src : src?.src
  const resolvedWidth = width ?? (typeof src === "string" ? undefined : src?.width)
  const resolvedHeight = height ?? (typeof src === "string" ? undefined : src?.height)

  return (
    <img
      src={resolved}
      alt={alt}
      width={fill ? undefined : resolvedWidth}
      height={fill ? undefined : resolvedHeight}
      loading={priority ? "eager" : "lazy"}
      fetchPriority={priority ? "high" : undefined}
      decoding={priority ? "sync" : "async"}
      style={fill ? { position: "absolute", inset: 0, width: "100%", height: "100%", ...style } : style}
      {...rest}
    />
  )
}

export { Image }
