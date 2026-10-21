// Lets any screen open the floating dice roller with an expression already filled in
// (e.g. the sheet's "🎯 Attack +5" → "1d20+5", labelled "Rapier · โจมตี").
export interface RollerRequest {
  expression: string
  /** Shown above the roll and in the log, e.g. "Rapier · ดาเมจ". */
  label: string
  /** Called once with the total of the next roll (app roll or typed), e.g. Second Wind heals with it. */
  onResult?: (total: number) => void
  /** Shown under the label so the player knows what happens with the result. */
  resultHint?: string
}

type Listener = (r: RollerRequest) => void
const listeners = new Set<Listener>()

export function openRoller(r: RollerRequest): void {
  for (const l of listeners) l(r)
}

/** The roller subscribes; returns the unsubscribe function (for useEffect). */
export function onRollerRequest(l: Listener): () => void {
  listeners.add(l)
  return () => listeners.delete(l)
}

// A screen with its own 🎲 button (the DM panel on a laptop) "docks" the roller: the floating
// button then hides on wide screens, where it would cover the panel. Counted, so nesting is safe.
let docks = 0
const dockListeners = new Set<(docked: boolean) => void>()

/** Call in a useEffect; returns the undock function. */
export function dockRoller(): () => void {
  docks++
  for (const l of dockListeners) l(true)
  return () => {
    docks--
    for (const l of dockListeners) l(docks > 0)
  }
}

export const isRollerDocked = (): boolean => docks > 0

export function onRollerDock(l: (docked: boolean) => void): () => void {
  dockListeners.add(l)
  return () => dockListeners.delete(l)
}
