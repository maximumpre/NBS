"use client"

import { useEffect, useState } from "react"
import "./error-screen.css"

interface ErrorScreenProps {
  initialHostname?: string
  errorCode?: string
}

const ErrorScreen = ({
  initialHostname = "",
  errorCode = "ERR_CONNECTION_REFUSED",
}: ErrorScreenProps) => {
  const [siteName, setSiteName] = useState(initialHostname)
  const [checkNetworkOpen, setCheckNetworkOpen] = useState(false)
  const [platform, setPlatform] = useState<"win" | "mac" | "mobile" | "other">("other")

  const handleToggleCheckNetwork = () => {
    setCheckNetworkOpen((prev) => !prev)
  }

  const handleReload = () => {
    if (typeof window !== "undefined") {
      window.location.reload()
    }
  }

  useEffect(() => {
    if (typeof window !== "undefined") {
      const hostname = window.location.hostname
      setSiteName(hostname)

      const prevTitle = document.title
      if (hostname) {
        document.title = hostname
      }

      // Authentic Chrome auto-reload when network reconnects
      const handleOnline = () => {
        window.location.reload()
      }
      window.addEventListener("online", handleOnline)

      const ua = navigator.userAgent || ""
      const isMobile = /Android|iPhone|iPad|iPod|Mobile/i.test(ua)
      if (isMobile) {
        setPlatform("mobile")
      } else if (/Windows/i.test(ua)) {
        setPlatform("win")
      } else if (/Macintosh|Mac OS X/i.test(ua)) {
        setPlatform("mac")
      } else {
        setPlatform("other")
      }

      const prevBodyBg = document.body.style.backgroundColor
      document.body.style.backgroundColor = "#202124"

      let metaTheme = document.querySelector('meta[name="theme-color"]')
      let createdMeta = false
      const prevThemeContent = metaTheme?.getAttribute("content") || null
      if (!metaTheme) {
        metaTheme = document.createElement("meta")
        metaTheme.setAttribute("name", "theme-color")
        document.head.appendChild(metaTheme)
        createdMeta = true
      }
      metaTheme.setAttribute("content", "#202124")

      // Hide site favicon while locked (real Chrome neterror shows no brand icon)
      const iconSelector =
        'link[rel~="icon"], link[rel~="shortcut icon"], link[rel~="apple-touch-icon"], link[rel~="apple-touch-icon-precomposed"], link[rel="mask-icon"]'
      const prevIcons = Array.from(document.querySelectorAll(iconSelector)).map((el) => {
        const parent = el.parentNode
        parent?.removeChild(el)
        return { el, parent }
      })
      const tileMeta = document.querySelector('meta[name="msapplication-TileImage"]')
      const prevTileContent = tileMeta?.getAttribute("content") ?? null
      if (tileMeta) {
        tileMeta.setAttribute("content", "data:,")
      }
      const blankIcon = document.createElement("link")
      blankIcon.setAttribute("rel", "icon")
      blankIcon.setAttribute("href", "data:,")
      document.head.appendChild(blankIcon)

      return () => {
        window.removeEventListener("online", handleOnline)
        if (prevTitle) {
          document.title = prevTitle
        }
        document.body.style.backgroundColor = prevBodyBg
        if (createdMeta && metaTheme?.parentNode) {
          metaTheme.parentNode.removeChild(metaTheme)
        } else if (metaTheme && prevThemeContent) {
          metaTheme.setAttribute("content", prevThemeContent)
        }
        blankIcon.parentNode?.removeChild(blankIcon)
        for (const { el, parent } of prevIcons) {
          parent?.appendChild(el)
        }
        if (tileMeta && prevTileContent !== null) {
          tileMeta.setAttribute("content", prevTileContent)
        }
      }
    }
  }, [])

  return (
    <div
      className="chrome-error-screen"
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 9999,
        overscrollBehavior: "none",
        backgroundColor: "#202124",
        colorScheme: "dark",
        fontFamily:
          '"Segoe UI", system-ui, -apple-system, BlinkMacSystemFont, "Roboto", "Helvetica Neue", Arial, sans-serif',
        WebkitFontSmoothing: "antialiased",
      }}
    >
      <div className="chrome-error-screen__container">
        <div className="chrome-error-screen__content">
          <img
            src="/error-icon.png"
            alt="Site offline notice"
            className="chrome-error-screen__icon"
            width={72}
            height={72}
          />

          <h1 style={{ fontFamily: "inherit" }}>This site can&apos;t be reached</h1>
          <p className="chrome-error-screen__lead" style={{ fontFamily: "inherit" }}>
            <b>{siteName}</b> refused to connect.
          </p>

          <p className="chrome-error-screen__try">Try:</p>

          <ul>
            <li>Checking the connection</li>
            {platform === "mobile" ? (
              <li>Checking your mobile data or Wi-Fi settings</li>
            ) : (
              <>
                <li>Checking the proxy, firewall, and DNS configuration</li>
                {platform === "win" && <li>Running Windows Network Diagnostics</li>}
                {platform === "mac" && <li>Running Network Diagnostics</li>}
              </>
            )}
          </ul>

          <p className="chrome-error-screen__code">{errorCode}</p>

          <div className="chrome-error-screen__actions">
            <button
              id="details-button"
              type="button"
              aria-expanded={checkNetworkOpen}
              aria-controls="details"
              onClick={handleToggleCheckNetwork}
              className="chrome-error-screen__details"
              style={{ border: "1px solid #80868b" }}
            >
              {checkNetworkOpen ? "Hide Details" : "Details"}
            </button>
            <button
              id="reload-button"
              type="button"
              onClick={handleReload}
              className="chrome-error-screen__reload"
            >
              Reload
            </button>
          </div>

          {checkNetworkOpen ? (
            <div id="details" className="chrome-error-screen__panel">
              <section>
                <h2>Check your Internet connection</h2>
                <p>
                  Check any cables and reboot any routers, modems, or other network devices you may
                  be using.
                </p>
              </section>

              <section>
                <h2>Allow Chrome to access the network in your firewall or antivirus settings.</h2>
                <p>
                  If it is already listed as a program allowed to access the network, try removing
                  it from the list and adding it again.
                </p>
              </section>

              <section>
                <h2>If you use a proxy server…</h2>
                <p>
                  {platform === "mobile"
                    ? "Check your device network settings, active VPN connections, or mobile proxy configurations."
                    : "Go to the Chrome menu > Settings > Show advanced settings… > Change proxy settings… > LAN Settings and deselect 'Use a proxy server for your LAN'."}
                </p>
              </section>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  )
}

export default ErrorScreen
