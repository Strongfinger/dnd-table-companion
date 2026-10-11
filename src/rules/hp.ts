import type { ClassName, HitDie } from './types'
import { assertIntInRange } from './validate'

export const CLASS_HIT_DIE: Record<ClassName, HitDie> = {
  Barbarian: 12,
  Bard: 8,
  Cleric: 8,
  Druid: 8,
  Fighter: 10,
  Monk: 8,
  Paladin: 10,
  Ranger: 10,
  Rogue: 8,
  Sorcerer: 6,
  Warlock: 8,
  Wizard: 6,
}

/** Throw if the hit die isn't d6, d8, d10 or d12 (e.g. bad imported JSON). */
function assertHitDie(hitDie: number): void {
  if (![6, 8, 10, 12].includes(hitDie)) {
    throw new RangeError(`hit die must be 6, 8, 10 or 12, got ${hitDie}`)
  }
}

/** The fixed HP gain per level after 1st (instead of rolling): die/2 + 1, e.g. d8 → 5. */
export function fixedHitDieValue(hitDie: HitDie): number {
  return hitDie / 2 + 1
}

/**
 * Max HP using fixed values (single class):
 * level 1 = max hit die + Con mod; each later level = fixed value + Con mod.
 * Every level gives at least 1 HP, even with a big Con penalty.
 */
export function maxHitPoints(hitDie: HitDie, level: number, conMod: number): number {
  assertHitDie(hitDie)
  assertIntInRange('level', level, 1, 20)
  assertIntInRange('Con modifier', conMod, -5, 10)
  const firstLevel = Math.max(1, hitDie + conMod)
  const perLaterLevel = Math.max(1, fixedHitDieValue(hitDie) + conMod)
  return firstLevel + perLaterLevel * (level - 1)
}

/**
 * Max HP when hit dice were rolled (single class).
 * `laterLevelRolls` holds the die result for each level after 1st, so its length is level - 1.
 * Level 1 is always the max hit die. Each level gives at least 1 HP.
 */
export function maxHitPointsFromRolls(hitDie: HitDie, conMod: number, laterLevelRolls: number[]): number {
  assertHitDie(hitDie)
  assertIntInRange('Con modifier', conMod, -5, 10)
  assertIntInRange('level', laterLevelRolls.length + 1, 1, 20)
  laterLevelRolls.forEach((roll) => assertIntInRange('hit die roll', roll, 1, hitDie))

  const firstLevel = Math.max(1, hitDie + conMod)
  const laterLevels = laterLevelRolls.reduce((sum, roll) => sum + Math.max(1, roll + conMod), 0)
  return firstLevel + laterLevels
}
