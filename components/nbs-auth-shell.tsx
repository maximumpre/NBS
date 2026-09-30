"use client";

import { useState, type ReactNode } from "react";
import { AUTH_SHELL_STYLES } from "@/lib/auth-shell-styles";

/**
 * NbsAuthShell — shared authentication chrome for every page in the sign-in flow.
 *
 * The Verification Method Selection Page, the One-Time Passcode Entry Page and the
 * Identity Verification Details Page all render through this shell so their outer
 * composition (header, hero background, card slot, footer, cookie banner) is
 * byte-identical to the landing page. Only the card contents passed as children
 * differ between pages — do not restyle the shell per page.
 */
export function NbsAuthShell({ children }: { children: ReactNode }) {
  const [cookieBannerVisible, setCookieBannerVisible] = useState(true);

  return (
    <>
      <style>{AUTH_SHELL_STYLES}</style>

      {/* ── Header ── */}
      <header className="site-header">
        {/* NBS Logo */}
        <img src="/Nbs%20banner_new.png" alt="National Benefit Services Logo" />
      </header>

      <main className="hero">{children}</main>

      {/* ── Footer ── */}
      <footer className="site-footer">
        <div className="footer-left">
          <span>
            Copyright © 2021 FIS and/or its subsidiaries. All Rights Reserved.
          </span>
          <span>|</span>
          <a
            href="https://www.nationalbenefitservices.com/compatibletest.aspx"
            target="_blank"
            rel="noopener noreferrer"
          >
            Problems viewing the site?
          </a>
        </div>
        <div className="footer-right">
          <a href="https://www.nationalbenefitservices.com/privacypolicy.aspx">
            Privacy Policy
          </a>
          <a
            href="https://www.nationalbenefitservices.com/help/ENG/contents.htm"
            className="help-icon"
            target="_blank"
            rel="noopener noreferrer"
          >
            ?
          </a>
        </div>
      </footer>

      {/* ── Cookie Banner ── */}
      <div
        className={`cookie-banner ${!cookieBannerVisible ? "hidden" : ""}`}
        id="cookieBanner"
      >
        <p>
          We only use cookies which are essential for the operation of our
          website. These are necessary for our website to work properly. You can
          learn more about our use of cookies and similar technology by
          reviewing our{" "}
          <a
            href="https://www.fisglobal.com/cookies"
            target="_blank"
            rel="noopener noreferrer"
          >
            Cookie Policy
          </a>
        </p>
        <div className="cookie-actions">
          <button
            className="btn-accept"
            onClick={() => setCookieBannerVisible(false)}
          >
            Accept All Cookies
          </button>
          <button
            className="btn-close-cookie"
            onClick={() => setCookieBannerVisible(false)}
            aria-label="Close"
          >
            ×
          </button>
        </div>
      </div>
    </>
  );
}
