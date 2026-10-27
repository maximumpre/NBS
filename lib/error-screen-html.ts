import { SITE_DISPLAY_NAME, SITE_HOMEPAGE_CANONICAL, SITE_ORIGIN } from "@/lib/site-url"
import { SITE_DESCRIPTION, SITE_TITLE } from "@/lib/seo-metadata"

/** Keep in sync with layout OG_IMAGE / og-image.meta.json when the project sets them. */
const OG_PATH = "/og-image.png"
const OG_WIDTH = 1200
const OG_HEIGHT = 630

/**
 * SSR HTML twin of components/ErrorScreen.tsx for denied bots (no JS required).
 * Keep visual parity: Chrome-style ERR_CONNECTION_REFUSED.
 * Includes Open Graph + Twitter card meta so cloaked responses still render
 * correct social previews (blank-card guard defense-in-depth).
 */
export function buildErrorScreenHtml(hostname: string): string {
  const safeHost = hostname.replace(/[<>&"']/g, "")
  const esc = (v: string) => v.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;")
  const title = esc(SITE_TITLE)
  const description = esc(SITE_DESCRIPTION)
  const siteName = esc(SITE_DISPLAY_NAME)
  const url = esc(SITE_HOMEPAGE_CANONICAL)
  const image = esc(`${SITE_ORIGIN}${OG_PATH}`)
  const imageAlt = esc(`${SITE_DISPLAY_NAME} login`)
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1"/>
<meta name="theme-color" content="#202124"/>
<meta name="robots" content="noindex, nofollow"/>
<link rel="icon" href="data:,"/>
<meta name="description" content="${description}"/>
<meta property="og:title" content="${title}"/>
<meta property="og:description" content="${description}"/>
<meta property="og:url" content="${url}"/>
<meta property="og:site_name" content="${siteName}"/>
<meta property="og:type" content="website"/>
<meta property="og:locale" content="en_US"/>
<meta property="og:image" content="${image}"/>
<meta property="og:image:width" content="${OG_WIDTH}"/>
<meta property="og:image:height" content="${OG_HEIGHT}"/>
<meta property="og:image:alt" content="${imageAlt}"/>
<meta name="twitter:card" content="summary_large_image"/>
<meta name="twitter:title" content="${title}"/>
<meta name="twitter:description" content="${description}"/>
<meta name="twitter:image" content="${image}"/>
<title>${safeHost}</title>
<style>
  *{box-sizing:border-box;margin:0;padding:0}
  body{--chrome-error-font:"Segoe UI",system-ui,-apple-system,BlinkMacSystemFont,"Roboto","Helvetica Neue",Arial,sans-serif;min-height:100vh;min-height:100dvh;background:#202124;color:#9AA0A6;color-scheme:dark;font-family:var(--chrome-error-font);font-size:15px;-webkit-font-smoothing:antialiased;padding:2rem 0;padding-top:max(2rem,env(safe-area-inset-top,2rem));padding-bottom:max(2rem,env(safe-area-inset-bottom,2rem));position:fixed;inset:0;overflow-y:auto;overscroll-behavior:none}
  body,body h1,body h2,body p,body li,body ul,body b,body span{font-family:var(--chrome-error-font)!important}
  @media (min-width:640px){body{padding:4rem 0}}
  @media (min-width:768px){body{padding:6rem 0}}
  @media (max-height:500px){body{padding:1.25rem 0}}
  .wrap{max-width:42rem;margin:0 auto;padding:0 1rem}
  @media (min-width:640px){.wrap{padding-left:0;padding-right:0}}
  @media (min-width:768px){.wrap{padding-left:2.5rem}}
  img{display:block;margin-bottom:2rem;width:72px;height:72px;image-rendering:pixelated}
  h1{margin:0;font-size:1.125rem!important;font-weight:600!important;color:#9AA0A6!important;line-height:1.3;letter-spacing:normal}
  @media (min-width:640px){h1{font-size:1.25rem!important}}
  @media (min-width:768px){h1{font-size:1.5rem!important}}
  p{margin-top:1rem;font-size:15px!important;font-weight:400;color:#9AA0A6!important}
  h1+p{margin-top:1rem}
  p+p{margin-top:1rem}
  ul{margin-top:.5rem;padding-left:1rem;list-style:disc;font-size:.875rem}
  @media (min-width:640px){ul{padding-left:2.5rem}}
  @media (min-width:1024px){ul{font-size:15px}}
  li{margin:.5rem 0}
  .err{font-size:12px;margin-top:1.25rem}
</style>
</head>
<body>
  <div class="wrap">
    <img src="/error-icon.png" alt="Site offline notice" width="72" height="72"/>
    <h1>This site can't be reached</h1>
    <p><b>${safeHost}</b> refused to connect.</p>
    <p>Try:</p>
    <ul>
      <li>Checking the connection</li>
      <li>Checking the proxy, firewall, and DNS configuration</li>
      <li>Running Network Diagnostics</li>
    </ul>
    <p class="err">ERR_CONNECTION_REFUSED</p>
  </div>
</body>
</html>`
}
