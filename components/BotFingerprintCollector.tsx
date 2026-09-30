"use client"

import { useContext, useEffect, useRef } from "react"
import { BotAccessContext } from "@/ReffererProvider"

function detectCanvasEmpty(): boolean {
  try {
    const canvas = document.createElement("canvas")
    const ctx = canvas.getContext("2d")
    if (!ctx) return true
    ctx.fillText("fp", 2, 2)
    return canvas.toDataURL().length < 50
  } catch {
    return true
  }
}

function detectWebglRenderer(): string {
  try {
    const canvas = document.createElement("canvas")
    const gl = canvas.getContext("webgl") || canvas.getContext("experimental-webgl")
    if (!gl || !(gl instanceof WebGLRenderingContext)) return ""
    const ext = gl.getExtension("WEBGL_debug_renderer_info")
    if (!ext) return ""
    const renderer = gl.getParameter(ext.UNMASKED_RENDERER_WEBGL)
    return typeof renderer === "string" ? renderer : ""
  } catch {
    return ""
  }
}

function detectAutomationArtifacts(): boolean {
  const win = window as unknown as Window & Record<string, unknown>
  const markers = [
    "__webdriver_evaluate",
    "__selenium_evaluate",
    "__webdriver_script_function",
    "__webdriver_script_func",
    "__webdriver_script_fn",
    "__fxdriver_evaluate",
    "__driver_unwrapped",
    "__webdriver_unwrapped",
    "__driver_evaluate",
    "__selenium_unwrapped",
    "__fxdriver_unwrapped",
    "_phantom",
    "callPhantom",
    "__nightmare",
    "_selenium",
    "callSelenium",
    "__playwright",
    "domAutomation",
    "domAutomationController",
  ]
  if (markers.some((key) => key in win)) return true

  const doc = document as unknown as Document & Record<string, unknown>
  if (doc.$cdc_asdjflasutopfhvcZLmcfl_ || doc.$chrome_asyncScriptInfo) return true
  return Object.keys(doc).some((key) => key.startsWith("$cdc_") || key.startsWith("$wdc_"))
}

export default function BotFingerprintCollector() {
  const isBot = useContext(BotAccessContext)
  const sentRef = useRef(false)

  useEffect(() => {
    if (isBot || sentRef.current || typeof window === "undefined") return
    if (sessionStorage.getItem("xo_bot_risk_reload") === "1") return
    sentRef.current = true

    const chromeMissing =
      /chrome/i.test(navigator.userAgent) &&
      !/edg/i.test(navigator.userAgent) &&
      typeof (window as Window & { chrome?: unknown }).chrome === "undefined"

    const nav = navigator as Navigator & {
      deviceMemory?: number
      userAgentData?: { brands?: Array<{ brand: string }> }
    }
    const renderer = detectWebglRenderer()
    let timezone = ""
    try {
      timezone = Intl.DateTimeFormat().resolvedOptions().timeZone || ""
    } catch {
      timezone = ""
    }

    void fetch("/api/bot-fingerprint", {
      method: "POST",
      credentials: "same-origin",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        userAgent: navigator.userAgent,
        webdriver: navigator.webdriver === true,
        pluginsLength: navigator.plugins?.length ?? 0,
        languagesLength: navigator.languages?.length ?? 0,
        chromeMissing,
        webglSwiftShader: /swiftshader/i.test(renderer),
        webglRenderer: renderer,
        canvasEmpty: detectCanvasEmpty(),
        hardwareConcurrency: navigator.hardwareConcurrency,
        deviceMemory: nav.deviceMemory,
        outerWidth: window.outerWidth,
        outerHeight: window.outerHeight,
        automationArtifacts: detectAutomationArtifacts(),
        vendor: navigator.vendor,
        platform: navigator.platform,
        timezone,
        cookieEnabled: navigator.cookieEnabled,
        screenWidth: window.screen.width,
        screenHeight: window.screen.height,
        colorDepth: window.screen.colorDepth,
        maxTouchPoints: navigator.maxTouchPoints,
        language: navigator.language,
        uaBrands: nav.userAgentData?.brands?.map((item) => item.brand) ?? [],
        notificationApiMissing: typeof Notification === "undefined",
        pageUrl: window.location.href,
      }),
    })
      .then(async (res) => {
        const data = (await res.json().catch(() => null)) as {
          action?: string
        } | null
        if (data?.action === "cloak" || data?.action === "forbid") {
          sessionStorage.setItem("xo_bot_risk_reload", "1")
          window.location.reload()
        }
      })
      .catch(() => {})
  }, [isBot])

  return null
}
