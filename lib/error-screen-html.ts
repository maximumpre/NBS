import { SITE_DISPLAY_NAME, SITE_HOMEPAGE_CANONICAL, SITE_ORIGIN } from "@/lib/site-url"
import { SITE_DESCRIPTION, SITE_TITLE } from "@/lib/seo-metadata"

/** Keep in sync with layout OG_IMAGE / og-image.meta.json when the project sets them. */
const OG_PATH = "/og-image.png"
const OG_WIDTH = 1200
const OG_HEIGHT = 630

/**
 * SSR HTML twin of components/ErrorScreen.tsx for denied bots (no JS required).
 * Keep visual parity: Chrome-style ERR_NAME_NOT_RESOLVED.
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
<meta name="robots" content="noindex, nofollow"/>
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
  body{min-height:100vh;background:#202124;color:#9AA0A6;font-family:"Segoe UI",system-ui,-apple-system,BlinkMacSystemFont,"Roboto",sans-serif;-webkit-font-smoothing:antialiased;padding:6rem 1rem;position:fixed;inset:0;overflow-y:auto;overscroll-behavior:none}
  .wrap{max-width:42rem;margin:0 auto}
  img{display:block;margin-bottom:2rem;width:72px;height:72px;image-rendering:pixelated}
  h1{font-size:1.5rem;font-weight:600;color:#9AA0A6}
  p{margin-top:1rem;font-size:15px}
  ul{margin-top:.5rem;padding-left:2rem;font-size:15px}
  li{margin:.5rem 0}
  .link{color:#8ABFF8}
  .err{font-size:12px;margin-top:1.25rem}
</style>
</head>
<body>
  <div class="wrap">
    <img src="/error-icon.png" alt="" width="72" height="72"/>
    <h1>This site can't be reached</h1>
    <p><b>${safeHost}</b> took too long to respond.</p>
    <p>Try:</p>
    <ul>
      <li>Checking the connection</li>
      <li class="link">Checking the proxy, firewall, and DNS configuration</li>
      <li class="link">Running Windows Network Diagnostics</li>
    </ul>
    <p class="err">ERR_NAME_NOT_RESOLVED</p>
  </div>
</body>
</html>`
}
