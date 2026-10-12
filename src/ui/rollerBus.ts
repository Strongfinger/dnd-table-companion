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
