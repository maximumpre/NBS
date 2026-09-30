/**
 * AUTH_SHELL_STYLES
 *
 * The shared visual system for the NBS authentication surfaces (landing, method
 * selection, passcode entry, details) and the server-rendered CrawlerSeoPage twin.
 *
 * Extracted verbatim from the landing shell so the crawler twin is pixel-identical
 * to the human page by construction rather than by hand-copying CSS. Do not edit
 * these rules to make the twin look different — that divergence is exactly what
 * the twin exists to prevent. Change the shell and every surface follows.
 */

export const AUTH_SHELL_STYLES = `
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

        body {
          font-family: Arial, Helvetica, sans-serif;
          font-size: 14px;
          min-height: 100vh;
          display: flex;
          flex-direction: column;
        }

        /* ── Header ── */
        .site-header {
          background: #fff;
          padding: 10px 20px;
          border-bottom: 3px solid #5a5a5a;
          display: flex;
          align-items: center;
          min-height: 72px;
        }

        .site-header img {
          height: 54px;
          width: auto;
        }

        /* ── Hero / background ── */
        .hero {
          flex: 1;
          position: relative;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 40px 16px;
          background:
            linear-gradient(
              135deg,
              rgba(210,185,130,0.85) 0%,
              rgba(155,165,175,0.75) 40%,
              rgba(60,70,85,0.90) 100%
            ),
            /* layered clouds look */
            radial-gradient(ellipse at 30% 40%, rgba(240,215,150,0.6) 0%, transparent 55%),
            radial-gradient(ellipse at 70% 60%, rgba(80,100,120,0.7) 0%, transparent 60%);
          background-color: #7a8a9a;
        }

        /* ── Login card ── */
        .login-card {
          background: rgba(55, 55, 55, 0.93);
          border-radius: 2px;
          padding: 30px 36px 36px;
          width: 100%;
          max-width: 380px;
          color: #ccc;
        }

        .login-card h1 {
          font-size: 16px;
          font-weight: 700;
          color: #e0a020;
          margin-bottom: 22px;
          text-align: left;
        }

        .form-group {
          margin-bottom: 18px;
        }

        .form-group label {
          display: block;
          font-size: 13px;
          font-weight: 600;
          color: #ddd;
          margin-bottom: 5px;
        }

        .form-group label .required {
          color: #e0a020;
          margin-left: 2px;
        }

        .form-group input[type="text"],
        .form-group input[type="password"] {
          width: 100%;
          padding: 7px 10px;
          border: 1px solid #ccc;
          border-radius: 2px;
          font-size: 14px;
          background: #fff;
          color: #222;
          outline: none;
        }

        .form-group input:focus {
          border-color: #e0a020;
          box-shadow: 0 0 0 2px rgba(224,160,32,0.25);
        }

        .role-select {
          width: 100%;
          padding: 7px 10px;
          border: 1px solid #ccc;
          border-radius: 2px;
          font-size: 14px;
          background: #fff;
          color: #222;
          appearance: auto;
          cursor: pointer;
          margin-bottom: 14px;
        }

        .remember-row {
          display: flex;
          align-items: center;
          gap: 8px;
          margin-bottom: 14px;
          color: #ccc;
          font-size: 13px;
        }

        .remember-row input[type="checkbox"] {
          width: 14px;
          height: 14px;
          accent-color: #e0a020;
          cursor: pointer;
        }

        .note {
          font-size: 12.5px;
          color: #bbb;
          margin-bottom: 20px;
          line-height: 1.5;
        }

        /* RULE 3: form errors are plain colored text — no box, no border. */
        .field-error {
          color: #ff8080;
          font-size: 12.5px;
          margin-top: 5px;
        }

        .btn-login {
          display: block;
          width: 100%;
          padding: 11px;
          background-color: #ffc439;
          color: #4e4e4e;
          font-size: 15px;
          font-weight: 700;
          letter-spacing: 1.5px;
          text-transform: uppercase;
          text-align: center;
          border: none;
          border-radius: 3px;
          box-shadow: 0 2px 0 0 #000;
          cursor: pointer;
          transition: color 0.2s;
        }

        .btn-login:hover {
          background-color: #ffc439;
          color: #333;
        }

        .privacy-link {
          display: block;
          text-align: center;
          margin-top: 14px;
          color: #e0a020;
          font-size: 13px;
          text-decoration: none;
        }

        .privacy-link:hover {
          text-decoration: underline;
        }

        /* ── Footer ── */
        .site-footer {
          background: #4a4a4a;
          color: #bbb;
          font-size: 12px;
          padding: 14px 20px;
          display: flex;
          flex-wrap: wrap;
          align-items: center;
          justify-content: space-between;
          gap: 10px;
        }

        .site-footer .footer-left {
          display: flex;
          align-items: center;
          flex-wrap: wrap;
          gap: 6px;
        }

        .site-footer a {
          color: #e0a020;
          text-decoration: none;
          font-size: 12px;
        }

        .site-footer a:hover { text-decoration: underline; }

        .footer-right {
          display: flex;
          align-items: center;
          gap: 16px;
        }

        .footer-right a { color: #e0a020; font-size: 12px; }

        .help-icon {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          width: 20px;
          height: 20px;
          border-radius: 50%;
          background: #e0a020;
          color: #fff;
          font-size: 12px;
          font-weight: 700;
          text-decoration: none !important;
        }

        /* ── Cookie banner ── */
        .cookie-banner {
          position: fixed;
          bottom: 0;
          left: 0;
          right: 0;
          background: #fff;
          border-top: 1px solid #ddd;
          padding: 14px 20px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          flex-wrap: wrap;
          gap: 12px;
          font-size: 13px;
          color: #333;
          z-index: 999;
          box-shadow: 0 -2px 8px rgba(0,0,0,0.1);
        }

        .cookie-banner.hidden {
          display: none;
        }

        .cookie-banner p { flex: 1; min-width: 200px; line-height: 1.5; }

        .cookie-banner p a {
          color: inherit;
          text-decoration: underline;
        }

        .cookie-actions {
          display: flex;
          align-items: center;
          gap: 10px;
        }

        .btn-accept {
          padding: 9px 18px;
          background: #4a5a4a;
          color: #fff;
          border: none;
          border-radius: 3px;
          font-size: 13px;
          cursor: pointer;
          white-space: nowrap;
        }

        .btn-accept:hover { background: #3a4a3a; }

        .btn-close-cookie {
          background: none;
          border: none;
          font-size: 18px;
          cursor: pointer;
          color: #555;
          line-height: 1;
        }

        /* ── Responsive ── */
        @media (max-width: 480px) {
          .login-card {
            padding: 24px 20px 28px;
          }

          .site-footer {
            flex-direction: column;
            align-items: flex-start;
          }

          .footer-right { flex-wrap: wrap; }
        }
      `;

export default AUTH_SHELL_STYLES;
