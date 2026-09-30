"use client"

export default function BotHoneypotTrap() {
  return (
    <div
      aria-hidden="true"
      tabIndex={-1}
      style={{
        position: "absolute",
        left: "-10000px",
        top: "auto",
        width: 1,
        height: 1,
        overflow: "hidden",
      }}
    >
      <a
        href="/api/bot-honeypot"
        tabIndex={-1}
        onClick={(event) => {
          event.preventDefault()
          void fetch("/api/bot-honeypot", {
            method: "POST",
            credentials: "same-origin",
          })
            .catch(() => {})
            .finally(() => {
              sessionStorage.setItem("xo_bot_risk_reload", "1")
              window.location.reload()
            })
        }}
      >
        Download invoice
      </a>
      <label htmlFor="company_url">Company website</label>
      <input id="company_url" name="company_url" autoComplete="off" tabIndex={-1} />
    </div>
  )
}
