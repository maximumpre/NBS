export type ClientFingerprintSignals = {
  webdriver?: boolean
  pluginsLength?: number
  languagesLength?: number
  chromeMissing?: boolean
  webglSwiftShader?: boolean
  canvasEmpty?: boolean
  userAgent?: string
  hardwareConcurrency?: number
  deviceMemory?: number
  outerWidth?: number
  outerHeight?: number
  automationArtifacts?: boolean
  webglRenderer?: string
  vendor?: string
  platform?: string
  timezone?: string
  cookieEnabled?: boolean
  screenWidth?: number
  screenHeight?: number
  colorDepth?: number
  maxTouchPoints?: number
  language?: string
  uaBrands?: string[]
  notificationApiMissing?: boolean
}

export type FingerprintScoreResult = {
  flags: string[]
  suspicious: boolean
}

function claimsDesktopChrome(ua: string): boolean {
  return (
    ua.includes("chrome/") &&
    !ua.includes("edg/") &&
    !ua.includes("opr/") &&
    !ua.includes("iphone") &&
    !ua.includes("ipad") &&
    !ua.includes("android")
  )
}

export function scoreClientSignals(signals: ClientFingerprintSignals): FingerprintScoreResult {
  const flags: string[] = []
  const ua = signals.userAgent?.toLowerCase() ?? ""
  const renderer = signals.webglRenderer?.toLowerCase() ?? ""

  if (signals.webdriver) flags.push("webdriver")
  if (signals.automationArtifacts) flags.push("automation_artifacts")
  if (signals.chromeMissing && claimsDesktopChrome(ua)) {
    flags.push("chrome_object_missing")
  }
  if (signals.pluginsLength === 0 && claimsDesktopChrome(ua)) {
    flags.push("no_plugins")
  }
  if (signals.languagesLength === 0) flags.push("no_languages")
  if (signals.webglSwiftShader || /swiftshader|llvmpipe|mesa|virtio|vmware|virtualbox/.test(renderer)) {
    flags.push("webgl_swiftshader")
  }
  if (signals.canvasEmpty) flags.push("empty_canvas")
  if (signals.hardwareConcurrency === 0) flags.push("no_hardware_concurrency")
  if (signals.deviceMemory === 0) flags.push("zero_device_memory")
  if (signals.outerWidth === 0 && signals.outerHeight === 0) {
    flags.push("hidden_outer_window")
  }
  if (!signals.timezone?.trim()) flags.push("missing_timezone")
  if (signals.cookieEnabled === false) flags.push("cookies_disabled")
  if ((signals.screenWidth === 0 || signals.screenHeight === 0) && signals.screenWidth != null) {
    flags.push("zero_screen")
  }
  if (signals.colorDepth === 0) flags.push("zero_color_depth")
  if (claimsDesktopChrome(ua) && !(signals.vendor ?? "").trim()) {
    flags.push("missing_vendor")
  }
  if (/headless/i.test(signals.platform ?? "")) flags.push("headless_platform")
  if (
    signals.language &&
    typeof signals.languagesLength === "number" &&
    signals.languagesLength === 0
  ) {
    flags.push("language_mismatch")
  }
  if (claimsDesktopChrome(ua) && signals.notificationApiMissing) {
    flags.push("notification_api_missing")
  }
  if (claimsDesktopChrome(ua) && Array.isArray(signals.uaBrands)) {
    const brands = signals.uaBrands.map((b) => b.toLowerCase()).join(" ")
    if (brands.includes("headless")) flags.push("headless_brand")
    if (brands.length > 0 && !brands.includes("chrom") && !brands.includes("google")) {
      flags.push("ua_brands_mismatch")
    }
  }

  return {
    flags,
    suspicious: flags.length >= 2,
  }
}
