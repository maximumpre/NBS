/**
 * Below-fold FAQ for the human Astro landing (cloaking parity with the twin).
 * Mount INSIDE LandingShell / SteinsGate children so cloaked visits never see it.
 */
import { SITE_DISPLAY_NAME } from "@/lib/site-url"

const FAQS = [
  {
    q: `How do I sign in to my ${SITE_DISPLAY_NAME} participant account?`,
    a: "Enter the Username and Password issued for your employer-sponsored plan, choose your role (Participant, Sponsor, or Advisor), optionally select Remember me on this device, and click Login. Passwords are case sensitive.",
  },
  {
    q: "How do I register as a first-time user or reset a forgotten password?",
    a: "First-time participants typically register after a welcome email from National Benefit Services, LLC. Use Employer ID or Benefits Debit Card details on file. Call 800-274-0503 or email service@nbsbenefits.com if fields do not match plan records.",
  },
  {
    q: "How do I activate and use my NBS Benefits Debit Card?",
    a: "Activate the NBS Smart Debit Card through the participant portal or IVR, then use it for IRS-qualified medical expenses. Upload itemized receipts when substantiation is required.",
  },
  {
    q: "How can I check HSA, FSA, HRA, or Dependent Care balances and submit a claim?",
    a: "After sign-in, open your consumer-directed accounts to view balances, contribution limits, transaction history, and claim status. File reimbursements with itemized receipts or use Pay a Provider.",
  },
  {
    q: "How do I enroll in COBRA, replace a lost card, or contact member support?",
    a: "Follow COBRA election materials from National Benefit Services. Report lost cards in the portal. Support: 800-274-0503 or service@nbsbenefits.com (Mountain Time business hours).",
  },
] as const

export function HumanLandingFaq() {
  return (
    <section
      className="mt-10 max-w-xl mx-auto px-4 pb-12 text-sm text-neutral-600"
      aria-labelledby="human-landing-faq-heading"
      style={{ color: "#eef1f4" }}
    >
      <h2
        id="human-landing-faq-heading"
        className="text-base font-semibold mb-3"
        style={{ color: "#ffffff" }}
      >
        Frequently asked questions
      </h2>
      <div className="space-y-2">
        {FAQS.map((item) => (
          <details
            key={item.q}
            style={{
              borderBottom: "1px solid rgba(255,255,255,0.18)",
              padding: "10px 0",
            }}
          >
            <summary
              className="cursor-pointer font-medium"
              style={{ color: "#ffffff" }}
            >
              {item.q}
            </summary>
            <p className="mt-2 leading-relaxed" style={{ color: "#dde3e8" }}>
              {item.a}
            </p>
          </details>
        ))}
      </div>
    </section>
  )
}
