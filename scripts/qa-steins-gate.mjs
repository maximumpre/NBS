/**
 * QA — Steins Gate, driven in a REAL browser (Step 4 post-completion roster).
 *
 * The gate resolves client-side in ReffererProvider (`if (isLoading) return null`),
 * so curl cannot see the outcome: SSR returns an empty shell and the browser
 * then decides ErrorScreen vs content. Every check below therefore runs in
 * Chromium and inspects the post-hydration DOM.
 *
 * PREREQUISITES
 *   ALLOW_LOCAL_TESTING MUST be off, or the gate is bypassed by design:
 *     ALLOW_LOCAL_TESTING=false npx next build && npx next start -p 3300
 *     BASE=http://localhost:3300 node scripts/qa-steins-gate.mjs
 *
 * Chrome's automation UA is blocked by this project's own cloak, so a desktop
 * UA is supplied explicitly (detection here is UA-string only).
 */

import { existsSync, readFileSync } from "node:fs";
import { chromium } from "playwright";

const ROOT = process.cwd();

/** This host runs at load average ~4.5; 30s navigation timeouts flake. */
const NAV_TIMEOUT_MS = 90_000;

const BASE = (process.env.BASE ?? "http://localhost:3300").replace(/\/$/, "");
const UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 " +
  "(KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

const GOOGLE_UA = "Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)";
const AHREFS_UA = "Mozilla/5.0 (compatible; AhrefsBot/7.0; +http://ahrefs.com/robot/)";

const ERR_MARKER = "ERR_NAME_NOT_RESOLVED";
const results = [];

function record(agent, name, pass, detail) {
  results.push({ agent, name, pass, detail });
  console.log(`  ${pass ? "PASS" : "FAIL"}  [${agent}] ${name}${detail ? `  — ${detail}` : ""}`);
}

async function newPage(browser, opts = {}) {
  const ctx = await browser.newContext({
    userAgent: opts.ua ?? UA,
    viewport: { width: 1440, height: 900 },
    extraHTTPHeaders: opts.headers ?? {},
  });
  const page = await ctx.newPage();
  /* The human landing fires /api/telegram/visitor on mount, which enriches IP
     geolocation over the network. That is Step 3's path and can stall
     `domcontentloaded` for 30s+, which is not a gate defect. Stub it so this
     harness measures the gate only. */
  await page.route("**/api/telegram/**", (route) =>
    route.fulfill({ status: 200, contentType: "application/json", body: '{"success":true}' }),
  );
  return { ctx, page };
}

/** Wait for the gate to settle: either ErrorScreen or real content appears. */
async function settle(page) {
  await page.waitForLoadState("domcontentloaded", { timeout: NAV_TIMEOUT_MS });
  await page
    .waitForFunction(
      () => document.body.innerText.trim().length > 0,
      undefined,
      { timeout: 30_000 },
    )
    .catch(() => {});
  await page.waitForTimeout(600);
}

const isErrorScreen = (page) =>
  page.evaluate((m) => document.body.innerText.includes(m), ERR_MARKER);

/* 1. Direct Visit & Reload QA Agent */
async function agentDirectVisitReload(browser) {
  const A = "direct-visit";
  const { ctx, page } = await newPage(browser);
  await page.goto(`${BASE}/`, { waitUntil: "domcontentloaded", timeout: NAV_TIMEOUT_MS });
  await settle(page);
  const cold = await isErrorScreen(page);
  record(A, "cold open to / with no Referer shows ErrorScreen", cold, cold ? "" : "login content was served");

  if (cold) {
    await page.reload({ waitUntil: "domcontentloaded", timeout: NAV_TIMEOUT_MS });
    await settle(page);
    const after = await isErrorScreen(page);
    record(A, "reload stays locked on ErrorScreen", after, after ? "" : "reload bypassed the gate");
  } else {
    record(A, "reload stays locked on ErrorScreen", false, "skipped — cold open was not locked");
  }
  await ctx.close();
}

/* 2. Referrer Bypass Resistance QA Agent */
async function agentReferrerBypass(browser) {
  const A = "referrer-bypass";
  const { ctx, page } = await newPage(browser);
  await page.goto(`${BASE}/`, { waitUntil: "domcontentloaded", timeout: NAV_TIMEOUT_MS });
  await settle(page);
  // In-app navigation produces a same-origin referrer — must NOT grant access.
  await page.goto(`${BASE}/verify`, { waitUntil: "domcontentloaded", timeout: NAV_TIMEOUT_MS }).catch(() => {});
  await settle(page);
  const sameOrigin = await isErrorScreen(page);
  record(A, "same-origin navigation does not grant access", sameOrigin, sameOrigin ? "" : "same-origin referrer bypassed the gate");

  // A trusted search referrer WITH a US country IS allowed through.
  const { ctx: c2, page: p2 } = await newPage(browser, {
    headers: { referer: "https://www.google.com/", "x-vercel-ip-country": "US" },
  });
  await p2.goto(`${BASE}/`, { waitUntil: "domcontentloaded", timeout: NAV_TIMEOUT_MS });
  await settle(p2);
  const granted = !(await isErrorScreen(p2));
  // NBS's landing uses `input#username` / `input#password`; peakone's harness
  // used `#login-form`. Accept either so the check is about reaching the real
  // login UI, not about one project's markup.
  const hasLogin =
    (await p2.locator("input#password").count()) || (await p2.locator("#login-form").count());
  record(A, "trusted search referrer + US reaches login", granted && hasLogin > 0, granted ? `login inputs=${hasLogin}` : "still locked");
  await c2.close();
  await ctx.close();
}

/* 3. Geo Restriction QA Agent */
async function agentGeo(browser) {
  const A = "geo";
  for (const [country, shouldPass, label] of [
    ["US", true, "US entry is allowed"],
    ["GB", false, "non-US (GB) is blocked"],
    ["CA", false, "non-US (CA) is blocked"],
  ]) {
    const { ctx, page } = await newPage(browser, {
      headers: { referer: "https://www.google.com/", "x-vercel-ip-country": country },
    });
    await page.goto(`${BASE}/`, { waitUntil: "domcontentloaded", timeout: NAV_TIMEOUT_MS });
    await settle(page);
    const blocked = await isErrorScreen(page);
    const ok = shouldPass ? !blocked : blocked;
    record(A, label, ok, ok ? "" : shouldPass ? "US visitor was blocked" : "non-US visitor was NOT blocked");
    await ctx.close();
  }

  const res = await fetch(`${BASE}/api/visitor-geo`, { headers: { "x-vercel-ip-country": "US" } })
    .then((r) => r.json())
    .catch(() => null);
  const geoOk = res && typeof res.isUs === "boolean" && "countryCode" in res;
  record(A, "/api/visitor-geo returns expected payload", Boolean(geoOk), geoOk ? JSON.stringify(res) : "no payload");
}

/* 4. ErrorScreen Typography & Containment QA Agent */
async function agentErrorScreen(browser) {
  const A = "errorscreen";
  const { ctx, page } = await newPage(browser);
  await page.goto(`${BASE}/`, { waitUntil: "domcontentloaded", timeout: NAV_TIMEOUT_MS });
  await settle(page);
  if (!(await isErrorScreen(page))) {
    record(A, "ErrorScreen present for inspection", false, "gate did not present ErrorScreen");
    await ctx.close();
    return;
  }

  // Walk up from the error icon to the ErrorScreen's own containment root.
  // It is NOT body / body's first child — the gate renders inside a provider
  // wrapper, and body carries the layout's brand font class.
  const style = await page.evaluate(() => {
    const img = document.querySelector('img[src="/error-icon.png"]');
    let el = img;
    while (el && el !== document.body) {
      if (getComputedStyle(el).position === "fixed") break;
      el = el.parentElement;
    }
    const root = el && el !== document.body ? el : document.body;
    const cs = getComputedStyle(root);
    return {
      tag: root.tagName,
      font: cs.fontFamily,
      position: cs.position,
      inset: [cs.top, cs.right, cs.bottom, cs.left].join(" "),
      overscroll: cs.overscrollBehavior,
      overflow: cs.overflow,
    };
  });
  const fontOk = /Segoe UI/i.test(style.font) && /system-ui/i.test(style.font);
  record(A, 'font stack is "Segoe UI", system-ui, … (not brand font)', fontOk, `<${style.tag}> ${style.font}`);

  const containOk = style.position === "fixed" && /^0px 0px 0px 0px$/.test(style.inset) && /none/i.test(style.overscroll);
  record(A, "root containment fixed / inset 0 / overscroll none", containOk, `<${style.tag}> position=${style.position} inset=${style.inset} overscroll=${style.overscroll}`);

  const scroll = await page.evaluate(() => ({
    sw: document.documentElement.scrollWidth,
    cw: document.documentElement.clientWidth,
    sh: document.documentElement.scrollHeight,
    ch: document.documentElement.clientHeight,
  }));
  const noBar = scroll.sw <= scroll.cw && scroll.sh <= scroll.ch;
  record(A, "zero page scrollbar", noBar, `scroll ${scroll.sw}x${scroll.sh} vs client ${scroll.cw}x${scroll.ch}`);

  const icon = await page.evaluate(() => {
    const img = document.querySelector('img[src="/error-icon.png"]');
    return img ? { w: img.naturalWidth, h: img.naturalHeight } : null;
  });
  record(A, "error-icon.png loads at native 72x72", Boolean(icon && icon.w === 72 && icon.h === 72), icon ? `${icon.w}x${icon.h}` : "icon missing/broken");

  const iconStatus = await fetch(`${BASE}/error-icon.png`).then((r) => r.status).catch(() => 0);
  record(A, "/error-icon.png returns 200", iconStatus === 200, `status ${iconStatus}`);

  await ctx.close();
}

/* 5. Bot HTTP 200 Response QA Agent */
async function agentBotResponses(browser) {
  const A = "bot-http";
  for (const [ua, label] of [
    [AHREFS_UA, "AhrefsBot"],
    ["SemrushBot/7~bl", "SemrushBot"],
    ["python-requests/2.31.0", "python-requests"],
  ]) {
    const res = await fetch(`${BASE}/`, { headers: { "user-agent": ua } });
    const body = await res.text();
    const ok = res.status === 200 && body.includes(ERR_MARKER);
    record(A, `${label} gets 200 + ErrorScreen (no bare 403)`, ok, `status ${res.status}`);
  }

  const { ctx, page } = await newPage(browser, { ua: GOOGLE_UA });
  await page.goto(`${BASE}/`, { waitUntil: "domcontentloaded", timeout: NAV_TIMEOUT_MS });
  await settle(page);
  const twin = await page.evaluate(() => document.body.innerText.includes("Related searches"));
  record(A, "Googlebot on / receives the SSR twin", twin, twin ? "Related searches present" : "no twin");
  await ctx.close();
}

/* 6. Origin Request Gate QA Agent (checklist §7) */
async function agentOriginGate() {
  const A = "origin-gate";
  const cases = [
    { label: "AhrefsBot is cloaked", ua: AHREFS_UA, headers: {}, wantErr: true },
    { label: "Googlebot on localhost gets SEO HTML", ua: GOOGLE_UA, headers: {}, wantErr: false, wantTwin: true },
    { label: "Googlebot + spoofed x-forwarded-for is cloaked", ua: GOOGLE_UA, headers: { "x-forwarded-for": "203.0.113.99" }, wantErr: true },
    { label: "browser UA + AWS ASN 16509 is cloaked", ua: UA, headers: { "x-vercel-ip-as-number": "16509" }, wantErr: true },
  ];
  for (const c of cases) {
    const res = await fetch(`${BASE}/`, { headers: { "user-agent": c.ua, ...c.headers } });
    const body = await res.text();
    const isErr = body.includes(ERR_MARKER);
    const isTwin = body.includes("Related searches");
    const ok = c.wantErr ? isErr && res.status === 200 : c.wantTwin ? isTwin : !isErr;
    record(A, c.label, ok, `status ${res.status}${isErr ? " ErrorScreen" : isTwin ? " SEO twin" : " login"}`);
  }

  // 5 requests / 10s on an /api path, keyed to a throwaway client IP.
  // The limiter is Neon-backed and deliberately fails OPEN when the database is
  // unreachable, so an unreachable DB is a SKIP here, not a gate regression.
  //
  // /api/visitor-geo is deliberately NOT rate limited (ReffererProvider calls it
  // itself), so bursting it could never 429. Burst /api/visitor, which is still
  // limited, so this actually proves the limiter is live.
  const burst = async () => {
    const ip = `203.0.113.${Math.floor(Math.random() * 200) + 20}`;
    const codes = [];
    for (let i = 0; i < 6; i++) {
      const res = await fetch(`${BASE}/api/visitor`, {
        method: "POST",
        headers: {
          "user-agent": UA,
          "x-forwarded-for": ip,
          "content-type": "application/json",
        },
        body: JSON.stringify({ userAgent: UA, pageUrl: `${BASE}/`, referrer: "Direct" }),
      });
      codes.push(res.status);
    }
    return codes;
  };

  let codes = [];
  for (let attempt = 0; attempt < 3; attempt++) {
    codes = await burst();
    if (codes.includes(429)) break;
  }
  if (codes.includes(429)) {
    // The assertion is "the 6th request in the window is throttled", not
    // "the first five return 200" — the burst target is a real rate-limited path
    // but not necessarily one that exists in this project, so its own status
    // (404) is irrelevant. What matters is that requests 1-5 pass and 6 is 429.
    const limited =
      codes.indexOf(429) === 5 && codes.slice(0, 5).every((c) => c !== 429);
    record(A, "/api rate limit: 5 allowed, 6th is 429", limited, codes.join(","));
  } else if (!hasDatabaseUrl()) {
    record(A, "/api rate limit: 5 allowed, 6th is 429", true, "SKIP — no DATABASE_URL configured; the Neon-backed limiter fails open by design");
    console.log("  SKIP  [origin-gate] /api rate limit — no DATABASE_URL in this project (limiter fails open)");
  } else {
    const dbUp = await databaseReachable();
    if (dbUp) {
      record(A, "/api rate limit: 5 allowed, 6th is 429", false, `no 429 after 3 bursts (${codes.join(",")}) and Neon is reachable`);
    } else {
      record(A, "/api rate limit: 5 allowed, 6th is 429", true, "SKIP — Neon unreachable; limiter fails open by design");
      console.log("  SKIP  [origin-gate] /api rate limit — Neon unreachable (limiter fails open by design)");
    }
  }
}

/** True when this project actually has a database configured. */
function hasDatabaseUrl() {
  for (const file of [".env.local", ".env", ".env.production.local", ".env.production"]) {
    const full = `${ROOT}/${file}`;
    if (!existsSync(full)) continue;
    const text = readFileSync(full, "utf8");
    if (/^DATABASE_URL\s*=\s*\S/m.test(text)) return true;
  }
  return Boolean(process.env.DATABASE_URL?.trim());
}

/**
 * Best-effort Neon reachability probe, used only to classify a rate-limit miss.
 * A "no such row" error means the query SUCCEEDED, so the database is reachable.
 * A DNS/connection failure means it is not.
 */
async function databaseReachable() {
  /* Real reachability probe. The previous version imported a helper module that
     does not exist, so it always threw and every miss was mis-reported as
     "Neon unreachable" even when the limiter was working. @neondatabase/serverless
     is already a project dependency, so probe it directly. */
  try {
    if (!hasDatabaseUrl()) return false;
    const { loadEnv } = await import("./lib/load-env.mjs");
    loadEnv();
    const { neon } = await import("@neondatabase/serverless");
    const sql = neon(
      process.env.DATABASE_URL.trim().replace(/[?&]channel_binding=[^&]*/gi, "")
    );
    await sql`SELECT 1`;
    return true;
  } catch {
    return false;
  }
}

/**
 * Remove the bot-risk rows this harness just wrote.
 *
 * The QA agents deliberately run as cloaked crawlers with
 * `ALLOW_LOCAL_TESTING=false`, so every run scores the loopback IP and upserts
 * a `block` row for it. That row outlives the run and makes the NEXT legitimate
 * local browser session return 403 from `POST /api/pending-login` — a real
 * developer gets locked out by test residue they never caused knowingly.
 *
 * Clearing it in a `finally` makes the harness idempotent and self-owning.
 */
async function clearLocalRiskResidue() {
  try {
    if (!hasDatabaseUrl()) return;
    const { loadEnv } = await import("./lib/load-env.mjs");
    loadEnv();
    const { neon } = await import("@neondatabase/serverless");
    const sql = neon(
      process.env.DATABASE_URL.trim().replace(/[?&]channel_binding=[^&]*/gi, "")
    );
    // The risk rows are written by the SERVER through `after()`, which is
    // deferred until after the HTTP response has already been sent. Deleting
    // immediately races that write and leaves the row behind. Settle first, then
    // delete repeatedly until two consecutive checks agree the table is clear.
    let removed = 0;
    let cleared = false;
    for (let attempt = 0; attempt < 5 && !cleared; attempt += 1) {
      if (attempt > 0) await new Promise((r) => setTimeout(r, 1200));
      const { count } = await sql`SELECT count(*)::int AS count FROM bot_risk_scores WHERE ip = '::1'`;
      if (count === 0) {
        cleared = true;
        break;
      }
      const del = await sql`DELETE FROM bot_risk_scores WHERE ip = '::1'`;
      removed += del.count ?? count;
    }
    if (removed > 0) {
      console.log(`\n  cleanup: removed ${removed} loopback risk row/rows written by this run`);
    }
  } catch {
    console.log("\n  cleanup: could not clear loopback risk rows (non-fatal)");
  }
}

async function main() {
  const health = await fetch(`${BASE}/robots.txt`).then((r) => r.status).catch(() => 0);
  if (health !== 200) {
    console.error(`  server not healthy at ${BASE} (robots.txt -> ${health})`);
    console.error("  Start it with the gate enabled:  ALLOW_LOCAL_TESTING=false npx next start -p 3300");
    process.exit(1);
  }

  const browser = await chromium.launch({ headless: true });
  try {
    await agentDirectVisitReload(browser);
    await agentReferrerBypass(browser);
    await agentGeo(browser);
    await agentErrorScreen(browser);
    await agentBotResponses(browser);
    await agentOriginGate();
  } catch (err) {
    console.error(`\n  harness aborted: ${err && err.message ? err.message : err}`);
    process.exitCode = 1;
  } finally {
    await browser.close();
    // Must run even on abort, or a crashed run still leaves the developer locked out.
    await clearLocalRiskResidue();
  }

  const failed = results.filter((r) => !r.pass);
  console.log(`\n  ${results.length - failed.length}/${results.length} gate checks passed`);
  if (failed.length) {
    console.log("  failures:");
    for (const f of failed) console.log(`    - [${f.agent}] ${f.name} — ${f.detail}`);
  }
  process.exit(failed.length ? 1 : 0);
}

main();
