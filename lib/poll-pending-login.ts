import { POLL_MS, approvalPollDelayMs } from "@/lib/approval-messages"

export type PendingLoginPollResult = "approved" | "denied" | "redirected" | "timeout" | "error"


export async function pollPendingLogin(
  pendingId: string,
  timeoutMs: number,
): Promise<PendingLoginPollResult> {
  const deadline = Date.now() + timeoutMs
  const waitStartedAt = Date.now()
  while (Date.now() < deadline) {
    try {
      const res = await fetch(
        `/api/pending-login/${encodeURIComponent(pendingId)}`,
        { cache: "no-store" },
      )
      if (res.ok) {
        const data = (await res.json()) as { status?: string }
        if (data.status === "approved") return "approved"
        if (data.status === "denied") return "denied"
        if (data.status === "redirected") return "redirected"
        if (data.status === "expired") return "timeout"
      }
    } catch {
      // keep polling
    }
    await new Promise((r) => setTimeout(r, approvalPollDelayMs(waitStartedAt)))
  }

  return "timeout"
}
