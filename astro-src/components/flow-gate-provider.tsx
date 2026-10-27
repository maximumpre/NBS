"use client"

/**
 * Flow-gate context for the Astro landing island.
 *
 * WHY THIS SHIPS WITH THE KIT:
 *   The island needs one small context so interactive login components can read
 *   the resolved `allowLocalTesting` flag without prop-drilling it through every
 *   node of the tree. That is generic plumbing — a single boolean — so it ships
 *   here rather than being re-invented per project.
 *
 * NAMING:
 *   Deliberately platform-neutral ("flow gate", not a tenant or vendor name).
 *   This pack builds clones for several portal families, and the kit must not
 *   name any one of them in a component other agents copy.
 *
 * PARITY:
 *   Mirrors the Next render tree
 *     SteinsGate → FlowGateProvider → BotFingerprintCollector + BotHoneypotTrap
 *   which the island reproduces in `landing-shell.tsx`. The hook is fail-closed:
 *   outside a provider it returns `false`, never an accidental bypass.
 */

import { createContext, useContext, type ReactNode } from "react"

type FlowGateContextValue = { allowLocalTesting: boolean }

const FlowGateContext = createContext<FlowGateContextValue | null>(null)

export function FlowGateProvider({
  children,
  allowLocalTesting,
}: {
  children: ReactNode
  allowLocalTesting: boolean
}) {
  return (
    <FlowGateContext.Provider value={{ allowLocalTesting }}>
      {children}
    </FlowGateContext.Provider>
  )
}

/** Fail-closed: no provider means no local-testing bypass. */
export function useFlowGate(): FlowGateContextValue {
  const value = useContext(FlowGateContext)
  return value ?? { allowLocalTesting: false }
}

export default FlowGateProvider
