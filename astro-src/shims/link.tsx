import type { AnchorHTMLAttributes, MouseEvent, ReactNode } from "react"

export interface LinkProps extends Omit<AnchorHTMLAttributes<HTMLAnchorElement>, "href"> {
  href: string | { pathname?: string; query?: Record<string, string | number | boolean>; hash?: string }
  replace?: boolean
  scroll?: boolean
  prefetch?: boolean
  children?: ReactNode
}

export default function Link({
  href,
  children,
  onClick,
  replace,
  scroll: _scroll,
  prefetch: _prefetch,
  ...rest
}: LinkProps) {
  const resolvedHref =
    typeof href === "string"
      ? href
      : `${href?.pathname ?? ""}${href?.hash ?? ""}`

  const handleClick = (e: MouseEvent<HTMLAnchorElement>) => {
    if (onClick) onClick(e)
    if (!e.defaultPrevented && replace && typeof window !== "undefined") {
      e.preventDefault()
      window.location.replace(resolvedHref)
    }
  }

  return (
    <a href={resolvedHref} onClick={handleClick} {...rest}>
      {children}
    </a>
  )
}

export { Link }
