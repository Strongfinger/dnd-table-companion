// Character creation rules (2024): Point Buy and background ability increases.
import { abilityModifier } from './abilities'
import { CLASS_HIT_DIE, maxHitPoints } from './hp'
import { isSrdSpecies, SPECIES_INFO } from './srd/species'
import { ABILITIES, type Ability, type ClassName } from './types'

export const POINT_BUY_BUDGET = 27
export const POINT_BUY_MIN = 8
export const POINT_BUY_MAX = 15
const POINT_BUY_COST: Record<number, number> = { 8: 0, 9: 1, 10: 2, 11: 3, 12: 4, 13: 5, 14: 7, 15: 9 }

/** Points spent on one score (8–15). */
export function pointBuyCost(score: number): number {
  const cost = POINT_BUY_COST[score]
  if (cost === undefined) throw new RangeError(`Point Buy scores must be 8–15, got ${score}`)
  return cost
}

/** Total points spent; must not exceed 27. */
export function pointBuyTotal(scores: Record<Ability, number>): number {
  return ABILITIES.reduce((sum, a) => sum + pointBuyCost(scores[a]), 0)
}

export const POINT_BUY_START: Record<Ability, number> = { str: 8, dex: 8, con: 8, int: 8, wis: 8, cha: 8 }

/** Background increase: +2 to one and +1 to another, or +1 to all three of its abilities. */
export type BackgroundBonus = Partial<Record<Ability, number>>

/** Returns a Thai error message, or null when the bonus is legal for these background abilities. */
export function checkBackgroundBonus(bonus: BackgroundBonus, allowed: readonly Ability[]): string | null {
  const entries = Object.entries(bonus).filter(([, v]) => v) as [Ability, number][]
  if (entries.some(([a]) => !allowed.includes(a))) return 'เพิ่มค่าได้เฉพาะ Ability ที่ Background กำหนด'
  const values = entries.map(([, v]) => v).sort((x, y) => x - y)
  const twoOne = values.length === 2 && values[0] === 1 && values[1] === 2
  const oneOneOne = values.length === 3 && values.every((v) => v === 1)
  return twoOne || oneOneOne ? null : 'เลือกได้แบบ +2/+1 (สองค่า) หรือ +1/+1/+1 (สามค่า)'
}

/** Base scores + background bonus, capped at 20. */
export function applyBonus(base: Record<Ability, number>, bonus: BackgroundBonus): Record<Ability, number> {
  return Object.fromEntries(ABILITIES.map((a) => [a, Math.min(20, base[a] + (bonus[a] ?? 0))])) as Record<Ability, number>
}

/**
 * Average-roll max HP plus extras: Dwarven Toughness (+1 per level) and
 * Draconic Sorcery's Draconic Resilience (+3 at Sorcerer 3, +1 per level after = +level from level 3).
 */
export function suggestedMaxHp(c: {
  className: ClassName
  level: number
  scores: Record<Ability, number>
  species: string
  subclass?: string
}): number {
  const base = maxHitPoints(CLASS_HIT_DIE[c.className], c.level, abilityModifier(c.scores.con))
  const perLevel = isSrdSpecies(c.species) ? SPECIES_INFO[c.species].hpPerLevel : 0
  const draconic = c.className === 'Sorcerer' && c.level >= 3 && c.subclass?.trim().toLowerCase() === 'draconic sorcery' ? c.level : 0
  return base + perLevel * c.level + draconic
}

/**
 * Tap an ability while choosing a +2/+1 background bonus:
 * tapping a chosen ability removes it, otherwise the first pick gets +2 and the second +1.
 */
export function tapTwoOneBonus(bonus: BackgroundBonus, ability: Ability): BackgroundBonus {
  const next = { ...bonus }
  if (next[ability]) delete next[ability]
  else if (!Object.values(next).includes(2)) next[ability] = 2
  else if (!Object.values(next).includes(1)) next[ability] = 1
  return next
}

/** "9=1 · 10=2 · …" for showing the Point Buy price list. */
export function pointBuyPriceList(): string {
  const scores = Array.from({ length: POINT_BUY_MAX - POINT_BUY_MIN }, (_, i) => POINT_BUY_MIN + 1 + i)
  return scores.map((n) => `${n}=${pointBuyCost(n)}`).join(' · ')
}
