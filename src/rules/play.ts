// In-play rules (2024): damage, healing, temp HP, death saves, rests, concentration.
// Pure functions: they take the current state and return the new state plus what happened.
import { abilityModifier } from './abilities'
import { CLASS_HIT_DIE } from './hp'
import type { ClassName } from './types'

export interface HpState {
  hp: { max: number; current: number; temp: number }
  deathSaves: { successes: number; failures: number }
}

export interface DamageResult extends HpState {
  /** Dropped to 0 HP from above 0 this hit. */
  droppedToZero: boolean
  /** Leftover damage after 0 HP was at least max HP (or 3 failures at 0 HP). */
  dead: boolean
}

/**
 * Take damage: temp HP is lost first, then HP (never below 0).
 * At 0 HP already, any damage = 1 death save failure (2 on a Critical Hit).
 * Massive damage: if the damage left over after reaching 0 is ≥ max HP, the creature dies.
 */
export function applyDamage(state: HpState, amount: number, critical = false): DamageResult {
  const dmg = Math.max(0, Math.floor(amount))
  const fromTemp = Math.min(state.hp.temp, dmg)
  const rest = dmg - fromTemp
  const temp = state.hp.temp - fromTemp
  const wasAtZero = state.hp.current === 0

  if (wasAtZero && rest > 0) {
    // A Stable creature (3 successes) that takes damage starts dying again from zero.
    const stable = state.deathSaves.successes >= 3
    const before = stable ? { successes: 0, failures: 0 } : state.deathSaves
    const failures = Math.min(3, before.failures + (critical ? 2 : 1))
    const dead = rest >= state.hp.max || failures >= 3
    return { hp: { ...state.hp, temp }, deathSaves: { ...before, failures }, droppedToZero: false, dead }
  }

  const current = Math.max(0, state.hp.current - rest)
  const leftover = rest - state.hp.current
  const droppedToZero = current === 0 && rest > 0
  return {
    hp: { ...state.hp, current, temp },
    // Every time you drop to 0 HP the death saves start fresh.
    deathSaves: droppedToZero ? { successes: 0, failures: 0 } : state.deathSaves,
    droppedToZero,
    dead: droppedToZero && leftover >= state.hp.max,
  }
}

/** Regain HP up to the max. Any healing at 0 HP ends dying, so death saves reset. */
export function heal(state: HpState, amount: number): HpState {
  const gained = Math.max(0, Math.floor(amount))
  if (gained === 0) return state
  return {
    hp: { ...state.hp, current: Math.min(state.hp.max, state.hp.current + gained) },
    deathSaves: { successes: 0, failures: 0 },
  }
}

/** Temp HP doesn't stack: keep whichever is higher. */
export function gainTempHp(state: HpState, amount: number): HpState {
  return { ...state, hp: { ...state.hp, temp: Math.max(state.hp.temp, Math.max(0, Math.floor(amount))) } }
}

export type DeathSaveOutcome = 'success' | 'failure' | 'stable' | 'dead' | 'revived'

/**
 * Record a death save d20 roll (DC 10): 10+ success, 9- failure, 1 = two failures,
 * 20 = regain 1 HP. Three successes = stable (still at 0 HP), three failures = dead.
 */
export function rollDeathSave(state: HpState, d20: number): HpState & { outcome: DeathSaveOutcome } {
  if (d20 === 20) {
    return { hp: { ...state.hp, current: 1 }, deathSaves: { successes: 0, failures: 0 }, outcome: 'revived' }
  }
  let { successes, failures } = state.deathSaves
  if (d20 >= 10) successes += 1
  else failures += d20 === 1 ? 2 : 1
  successes = Math.min(3, successes)
  failures = Math.min(3, failures)
  const outcome: DeathSaveOutcome = failures >= 3 ? 'dead' : successes >= 3 ? 'stable' : d20 >= 10 ? 'success' : 'failure'
  return { hp: state.hp, deathSaves: { successes, failures }, outcome }
}

/** Constitution save DC to keep Concentration after taking damage: half the damage, min 10, max 30. */
export function concentrationDC(damage: number): number {
  return Math.min(30, Math.max(10, Math.floor(damage / 2)))
}

/** HP regained from spending one Hit Die on a Short Rest: roll + Con modifier, at least 0. */
export function hitDieHealing(roll: number, conScore: number): number {
  return Math.max(0, roll + abilityModifier(conScore))
}

export function hitDieSize(className: ClassName): number {
  return CLASS_HIT_DIE[className]
}

/** Exhaustion (2024): −2 per level to D20 Tests, −5 ft. Speed per level. */
export function exhaustionPenalty(level: number): { d20: number; speed: number } {
  const l = Math.min(6, Math.max(0, Math.floor(level)))
  return { d20: 2 * l, speed: 5 * l }
}

export interface RestState extends HpState {
  className: ClassName
  level: number
  hitDiceSpent: number
  exhaustion: number
  spellSlots: { max: number; used: number }[]
  features: { id: string; name: string; max: number; used: number; recharge: 'short' | 'long' }[]
}

/** Short Rest: limited-use features marked "short" come back (and Warlock Pact slots). Hit Dice are spent separately. */
export function shortRest<T extends RestState>(c: T): T {
  return {
    ...c,
    features: c.features.map((f) => (f.recharge === 'short' ? { ...f, used: 0 } : f)),
    spellSlots: c.className === 'Warlock' ? c.spellSlots.map((s) => ({ ...s, used: 0 })) : c.spellSlots,
  }
}

/** Spend one Hit Die during a Short Rest. Returns null if none are left or the character is at 0 HP. */
export function spendHitDie<T extends RestState>(c: T, roll: number, conScore: number): T | null {
  if (c.hitDiceSpent >= c.level || c.hp.current === 0) return null
  const healed = heal(c, hitDieHealing(roll, conScore))
  return { ...c, ...healed, hitDiceSpent: c.hitDiceSpent + 1 }
}

/**
 * Long Rest (2024): regain all HP and all spent Hit Dice, all spell slots and features,
 * Exhaustion −1, temp HP ends. Needs at least 1 HP at the start, otherwise nothing happens.
 */
export function longRest<T extends RestState>(c: T): T | null {
  if (c.hp.current === 0) return null
  return {
    ...c,
    hp: { ...c.hp, current: c.hp.max, temp: 0 },
    deathSaves: { successes: 0, failures: 0 },
    hitDiceSpent: 0,
    exhaustion: Math.max(0, c.exhaustion - 1),
    spellSlots: c.spellSlots.map((s) => ({ ...s, used: 0 })),
    features: c.features.map((f) => ({ ...f, used: 0 })),
  }
}
