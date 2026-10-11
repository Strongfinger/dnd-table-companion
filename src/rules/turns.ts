// Initiative order and turns for the combat tracker (2024 rules).
// Pure functions over plain data: the tracker stores the result and logs the events.

/**
 * A condition or effect with an optional duration, counted on the affected creature's own turns.
 * Example: "until the end of its next turn" = { rounds: 1, ends: 'end' }, added outside its turn.
 * (Added during its own turn, that same turn's end already counts, so use rounds: 2.)
 */
export interface TimedEffect {
  id: string
  name: string
  /** Turns left, or null = lasts until removed. */
  rounds: number | null
  /** Count down at the start or the end of this creature's turn. */
  ends: 'start' | 'end'
}

export interface TurnCombatant {
  id: string
  name: string
  /** Initiative total (d20 + bonus), or null if not rolled yet. */
  initiative: number | null
  dexMod: number
  /** DM's manual tiebreak: higher goes first among equal initiatives. */
  tieBreak: number
  /** Out of the fight (dead monster, fled): skipped by Next Turn. */
  defeated: boolean
  effects: TimedEffect[]
}

export interface TurnState {
  round: number
  /** Whose turn it is, or null before combat starts. */
  activeId: string | null
}

/**
 * Highest initiative first. Ties: the manual tiebreak, then higher DEX, then name, then id.
 * (2024: the DM decides monster ties, players decide ties between PCs; either sets `tieBreak`.
 * Higher DEX is just a sensible default.) Combatants without initiative go last.
 */
export function sortByInitiative<T extends TurnCombatant>(list: T[]): T[] {
  return [...list].sort((a, b) => {
    if (a.initiative === null && b.initiative === null) return 0
    if (a.initiative === null) return 1
    if (b.initiative === null) return -1
    return (
      b.initiative - a.initiative ||
      b.tieBreak - a.tieBreak ||
      b.dexMod - a.dexMod ||
      a.name.localeCompare(b.name) ||
      a.id.localeCompare(b.id)
    )
  })
}

/** Can this combatant take turns? */
const canAct = (c: TurnCombatant) => !c.defeated && c.initiative !== null

/** Start at round 1 with the first combatant still in the fight. */
export function startCombat<T extends TurnCombatant>(list: T[]): { combatants: T[]; state: TurnState } {
  const combatants = sortByInitiative(list)
  const first = combatants.find(canAct)
  return { combatants, state: { round: 1, activeId: first?.id ?? null } }
}

export interface TurnEvent {
  combatantId: string
  text: string
}

/** Count down one combatant's effects for this turn boundary; returns what ran out. */
function tick<T extends TurnCombatant>(c: T, when: 'start' | 'end', events: TurnEvent[]): T {
  const effects: TimedEffect[] = []
  for (const e of c.effects) {
    if (e.ends !== when || e.rounds === null) {
      effects.push(e)
      continue
    }
    const left = e.rounds - 1
    if (left <= 0) events.push({ combatantId: c.id, text: `${c.name}: ${e.name} หมดผล` })
    else effects.push({ ...e, rounds: left })
  }
  return { ...c, effects }
}

/**
 * Next Turn: the current combatant's turn ends (its "end of turn" effects tick), the next
 * one still in the fight starts (its "start of turn" effects tick). Passing the end of the
 * order starts a new round.
 *
 * `combatants` must be in initiative order (re-sort after adding someone mid-round; someone
 * added above the current turn waits for the next round). The active combatant may have been
 * defeated this turn: the order continues from its place. Before removing the active
 * combatant from the list, call nextTurn first.
 */
export function nextTurn<T extends TurnCombatant>(combatants: T[], state: TurnState): { combatants: T[]; state: TurnState; events: TurnEvent[] } {
  const events: TurnEvent[] = []
  if (!combatants.some(canAct)) {
    return { combatants, state: { round: state.round, activeId: null }, events: [{ combatantId: '', text: 'ไม่มีใครเหลือในการต่อสู้' }] }
  }

  // Walk forward from the active combatant's place in the full order (it may be defeated now).
  const start = combatants.findIndex((c) => c.id === state.activeId)
  let index = start
  let wrapped = false
  do {
    index += 1
    if (index >= combatants.length) {
      index = 0
      wrapped = true
    }
  } while (!canAct(combatants[index]))
  const next = combatants[index]
  // No one active yet = the first turn of round 1; otherwise a wrap starts a new round.
  const round = state.activeId === null ? Math.max(1, state.round) : wrapped && start !== -1 ? state.round + 1 : state.round

  const updated = combatants.map((c) => {
    let out = c
    if (c.id === state.activeId) out = tick(out, 'end', events)
    if (c.id === next.id) out = tick(out, 'start', events)
    return out
  })
  if (round !== state.round) events.unshift({ combatantId: next.id, text: `— รอบที่ ${round} —` })
  events.push({ combatantId: next.id, text: `ตาของ ${next.name}` })
  return { combatants: updated, state: { round, activeId: next.id }, events }
}

/** Go back one turn (to fix a mistake). Effect durations are NOT rewound. */
export function previousTurn<T extends TurnCombatant>(combatants: T[], state: TurnState): TurnState {
  const start = combatants.findIndex((c) => c.id === state.activeId)
  if (start === -1 || !combatants.some(canAct)) return state
  let index = start
  let round = state.round
  do {
    index -= 1
    if (index < 0) {
      if (round === 1) return state // nothing before the first turn
      index = combatants.length - 1
      round -= 1
    }
  } while (!canAct(combatants[index]))
  return { round, activeId: combatants[index].id }
}
