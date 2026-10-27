/**
 * Single React island for the human landing: LandingShell + NBS login UI.
 * Avoids nested client:only islands that break children hydration.
 */
"use client"

import NbsLoginLanding from "@/components/nbs-login-landing"
import LandingShell from "./landing-shell"

export default function NbsLandingIsland({
  allowLocalTestingEnv = false,
}: {
  allowLocalTestingEnv?: boolean
}) {
  return (
    <LandingShell allowLocalTestingEnv={allowLocalTestingEnv}>
      <NbsLoginLanding />
    </LandingShell>
  )
}
