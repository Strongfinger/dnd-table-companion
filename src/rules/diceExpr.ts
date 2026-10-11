// Dice expressions like "2d6+3", "d20+5", "1d8+1d6-1": parse, roll, and check real-dice input.
import { rollDie, type Rng } from './dice'

export interface DiceTerm {
  count: number
  sides: number
  /** +1 or −1 */
  sign: 1 | -1
}

export interface DiceExpr {
  dice: DiceTerm[]
  /** Flat number added at the end, e.g. +3. */
  modifier: number
}

export type RollMode = 'normal' | 'advantage' | 'disadvantage'

const MAX_DICE = 100
const MAX_SIDES = 1000

/** Read "2d6+3" (spaces and capital D allowed). Returns null if it isn't a valid expression. */
export function parseDice(input: string): DiceExpr | null {
  const s = input.replace(/\s+/g, '').toLowerCase()
  if (!s || s.length > 60) return null
  // Split into signed parts: "2d6+3-1d4" → ["2d6", "+3", "-1d4"]
  const parts = s.match(/[+-]?[^+-]+/g)
  if (!parts || parts.join('') !== s) return null

  const dice: DiceTerm[] = []
  let modifier = 0
  for (const part of parts) {
    const sign: 1 | -1 = part.startsWith('-') ? -1 : 1
    const body = part.replace(/^[+-]/, '')
    const die = body.match(/^(\d*)d(\d+)$/)
    if (die) {
      const count = die[1] === '' ? 1 : Number(die[1])
      const sides = Number(die[2])
      if (count < 1 || count > MAX_DICE || sides < 2 || sides > MAX_SIDES) return null
      dice.push({ count, sides, sign })
    } else if (/^\d+$/.test(body)) {
      modifier += sign * Number(body)
    } else {
      return null
    }
  }
  if (dice.reduce((n, d) => n + d.count, 0) > MAX_DICE) return null
  return { dice, modifier }
}

/** "2d6+3" back from an expression (used to show what was rolled). */
export function formatDice(e: DiceExpr): string {
  const dice = e.dice.map((d, i) => `${d.sign < 0 ? '-' : i > 0 ? '+' : ''}${d.count}d${d.sides}`).join('')
  const mod = e.modifier === 0 ? '' : e.modifier > 0 ? `${dice ? '+' : ''}${e.modifier}` : `${e.modifier}`
  return dice + mod || '0'
}

/** Critical Hit: roll twice as many damage dice; the modifier is not doubled. */
export function criticalDice(e: DiceExpr): DiceExpr {
  return { ...e, dice: e.dice.map((d) => ({ ...d, count: d.count * 2 })) }
}

/**
 * Advantage/disadvantage only applies to a single d20 roll ("d20+5"):
 * roll two d20s and keep the higher/lower.
 */
export function canUseAdvantage(e: DiceExpr): boolean {
  return e.dice.length === 1 && e.dice[0].count === 1 && e.dice[0].sides === 20 && e.dice[0].sign === 1
}

export interface RollResult {
  total: number
  /** Every die rolled, per term (for advantage: both d20s, `kept` says which counted). */
  rolls: number[][]
  kept?: number
}

export function rollDice(e: DiceExpr, mode: RollMode = 'normal', rng: Rng = Math.random): RollResult {
  if (mode !== 'normal' && canUseAdvantage(e)) {
    const pair = [rollDie(20, rng), rollDie(20, rng)]
    const kept = mode === 'advantage' ? Math.max(...pair) : Math.min(...pair)
    return { total: kept + e.modifier, rolls: [pair], kept }
  }
  const rolls = e.dice.map((d) => Array.from({ length: d.count }, () => rollDie(d.sides, rng)))
  const diceSum = rolls.reduce((sum, r, i) => sum + e.dice[i].sign * r.reduce((a, b) => a + b, 0), 0)
  return { total: diceSum + e.modifier, rolls }
}

/** Smallest and largest possible sum of the dice only (no modifier). */
export function diceRange(e: DiceExpr): { min: number; max: number } {
  let min = 0
  let max = 0
  for (const d of e.dice) {
    if (d.sign > 0) {
      min += d.count
      max += d.count * d.sides
    } else {
      min -= d.count * d.sides
      max -= d.count
    }
  }
  return { min, max }
}

/**
 * Real dice at the table: the player types the sum shown on the dice, the app adds the modifier.
 * Returns null if that sum is impossible for these dice.
 */
export function totalFromManualDice(e: DiceExpr, diceSum: number): number | null {
  const { min, max } = diceRange(e)
  if (!Number.isInteger(diceSum) || diceSum < min || diceSum > max) return null
  return diceSum + e.modifier
}

/** Advantage and disadvantage cancel out; several sources don't stack (2024). */
export function resolveRollMode(advantage: boolean, disadvantage: boolean): RollMode {
  if (advantage === disadvantage) return 'normal'
  return advantage ? 'advantage' : 'disadvantage'
}

/** Quick-dice button: add one die to the expression ("1d6" + d6 → "2d6", "2d6+3" + d8 → "2d6+1d8+3"). */
export function addDie(text: string, sides: number): string {
  const e = parseDice(text)
  if (!e) return `1d${sides}`
  const i = e.dice.findIndex((d) => d.sides === sides && d.sign === 1)
  const dice = i >= 0 ? e.dice.map((d, j) => (j === i ? { ...d, count: Math.min(100, d.count + 1) } : d)) : [...e.dice, { count: 1, sides, sign: 1 as const }]
  return formatDice({ ...e, dice })
}

/** +1 / −1 buttons for the flat modifier. */
export function addModifier(text: string, delta: number): string {
  const e = parseDice(text) ?? { dice: [], modifier: 0 }
  return formatDice({ ...e, modifier: e.modifier + delta })
}

/** Typed from real dice: the d20 face on a single d20 roll tells us about natural 20s and 1s. */
export function naturalFromManual(e: DiceExpr, diceSum: number): 20 | 1 | null {
  if (!canUseAdvantage(e)) return null
  return diceSum === 20 ? 20 : diceSum === 1 ? 1 : null
}

/** A Critical Hit doubles damage dice only; a single d20 (an attack roll or check) is never doubled. */
export function canBeCritical(e: DiceExpr): boolean {
  return e.dice.length > 0 && !canUseAdvantage(e)
}

/** A natural 20 or 1 on a single d20 roll (shown highlighted). */
export function naturalD20(e: DiceExpr, r: RollResult): 20 | 1 | null {
  if (!canUseAdvantage(e)) return null
  const face = r.kept ?? r.rolls[0][0]
  return face === 20 ? 20 : face === 1 ? 1 : null
}
