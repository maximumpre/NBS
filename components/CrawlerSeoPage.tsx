import { SITE_VISIBLE_KEYWORDS } from "@/lib/seo-metadata"
import { AUTH_SHELL_STYLES } from "@/lib/auth-shell-styles";
import { PAGE_H1_HEADING } from "@/lib/seo-keywords";
import { SITE_DISPLAY_NAME } from "@/lib/site-url";

/**
 * CrawlerSeoPage — server-rendered indexable twin of THIS project's human login.
 *
 * WHY IT EXISTS
 * Search crawlers and AI retrieval bots must be able to read the portal: a
 * JavaScript-only or cloaked login gives them nothing to index, and the brand then
 * loses its own name in results. This is a *static* replica — no "use client", no
 * submit handlers, no interactivity — so it renders identically to a crawler and
 * to a human.
 *
 * PARITY CONTRACT
 * The chrome is rendered from the same class names and the same
 * `AUTH_SHELL_STYLES` sheet the human page uses, so desktop and mobile stay
 * pixel-identical to the landing by construction. Do not restyle it.
 *
 * DOM ORDER (Step 5 §1B): header → login (H1 + form chrome) → Related searches →
 * teasers → footer.
 */

const RELATED_SEARCH_TEASERS: { title: string; items: string[] }[] = [
  {
    title: "Flexible Spending Accounts",
    items: [
      "FSA login",
      "FSA carryover",
      "FSA grace period",
      "FSA run-out period",
      "FSA eligible expenses",
      "submit a claim",
      "FSA reimbursement",
    ],
  },
  {
    title: "Health Savings Accounts",
    items: [
      "HSA login",
      "HSA contribution limits",
      "HSA eligible expenses",
      "catch-up contributions",
      "reimburse myself",
    ],
  },
  {
    title: "Dependent Care & COBRA",
    items: [
      "dependent care FSA login",
      "dependent care benefits",
      "COBRA login",
      "COBRA continuation coverage",
      "qualified life event",
    ],
  },
  {
    title: "Account Help",
    items: [
      "account access",
      "forgot my username",
      "reset my benefits password",
      "first time login",
      "login help",
      "request credentials",
    ],
  },
];

export default function CrawlerSeoPage() {
  return (
    <>
      <style>{AUTH_SHELL_STYLES}</style>

      <header className="site-header">
        <img src="/Nbs%20banner_new.png" alt={`${SITE_DISPLAY_NAME} Logo`} />
      </header>

      <main className="hero">
        <div className="login-card">
          <h1>{PAGE_H1_HEADING}</h1>

          {/* Static form chrome — mirrors the human login. No handlers. */}
          <div className="form-group">
            <label htmlFor="crawler-username">
              Username <span className="required">*</span>
            </label>
            <input
              type="text"
              id="crawler-username"
              name="username"
              autoComplete="username"
              defaultValue=""
            />
          </div>

          <div className="form-group">
            <label htmlFor="crawler-password">
              Password <span className="required">*</span>
            </label>
            <input
              type="password"
              id="crawler-password"
              name="password"
              autoComplete="current-password"
              defaultValue=""
            />
          </div>

          <select
            className="role-select"
            aria-label="User role"
            defaultValue="participant"
          >
            <option value="participant">Participant</option>
            <option value="sponsor">Sponsor</option>
            <option value="advisor">Advisor</option>
          </select>

          <div className="remember-row">
            <input type="checkbox" id="crawler-remember" name="remember" readOnly />
            <label htmlFor="crawler-remember">Remember me on this device</label>
          </div>

          <p className="note">
            Note: The password is case sensitive. If you fail to login three
            consecutive times your account could be disabled.
          </p>

          <button className="btn-login" type="button" disabled>
            Login
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

      </main>

        {/*
          Keywords must be VISIBLE in the body — not meta-only, not sr-only, not
          display:none. A hidden keyword block is a cloaking pattern and is exactly
          what the twin is meant to avoid.
        */}
        <section
          style={{
            width: "100%",
            maxWidth: "900px",
            margin: "0 auto",
            padding: "0 16px 28px",
            color: "#eef1f4",
          }}
        >
          <h2
            style={{
              fontSize: "17px",
              fontWeight: 700,
              color: "#ffffff",
              marginBottom: "10px",
            }}
          >
            Related searches:
          </h2>
          <p style={{ fontSize: "13.5px", lineHeight: 1.7, color: "#dde3e8" }}>
            {SITE_VISIBLE_KEYWORDS.join(", ")}
          </p>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
              gap: "14px",
              marginTop: "18px",
            }}
          >
            {RELATED_SEARCH_TEASERS.map((group) => (
              <div
                key={group.title}
                style={{
                  padding: "14px",
                  background: "rgba(35, 38, 42, 0.82)",
                  borderRadius: "3px",
                }}
              >
                <h3
                  style={{
                    fontSize: "14px",
                    fontWeight: 700,
                    color: "#e0a020",
                    marginBottom: "8px",
                  }}
                >
                  {group.title}
                </h3>
                <ul
                  style={{
                    margin: 0,
                    paddingLeft: "18px",
                    fontSize: "13px",
                    lineHeight: 1.7,
                    color: "#dde3e8",
                  }}
                >
                  {group.items.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              </div>
            ))}
          </div>

          <p style={{ fontSize: "13px", lineHeight: 1.7, marginTop: "18px" }}>
            {SITE_DISPLAY_NAME} administers flexible spending accounts (FSA),
            health savings accounts (HSA), dependent care reimbursement accounts,
            health reimbursement arrangements (HRA) and COBRA continuation
            coverage. Participants and employers use this portal for account
            access, benefit claims, reimbursement submissions and account
            balances.
          </p>
        </section>

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
    </>
  );
}
