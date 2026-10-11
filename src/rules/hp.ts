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
  if (![6, 8, 10, 12].includes(hitDie)) {
    throw new RangeError(`hit die must be 6, 8, 10 or 12, got ${hitDie}`)
  }
  assertIntInRange('level', level, 1, 20)
  assertIntInRange('Con modifier', conMod, -5, 10)
  const firstLevel = Math.max(1, hitDie + conMod)
  const perLaterLevel = Math.max(1, fixedHitDieValue(hitDie) + conMod)
  return firstLevel + perLaterLevel * (level - 1)
}
