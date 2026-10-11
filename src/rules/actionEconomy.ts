// Action economy for one creature's turn (2024): Action, Bonus Action, Reaction.
// true = already used this turn. All three come back at the start of the creature's turn.

export interface ActionEconomy {
  action: boolean
  bonusAction: boolean
  reaction: boolean
}

export type ActionKind = keyof ActionEconomy

export const ACTION_KINDS: ActionKind[] = ['action', 'bonusAction', 'reaction']

export const FRESH_TURN: ActionEconomy = { action: false, bonusAction: false, reaction: false }

/** Tap to mark used, tap again to give it back (fixing a mistake). */
export function toggleAction(e: ActionEconomy, kind: ActionKind): ActionEconomy {
  return { ...e, [kind]: !e[kind] }
}

/** Start of the creature's turn: everything is available again. */
export function startOfTurn(): ActionEconomy {
  return { ...FRESH_TURN }
}
