// How many cantrips and prepared spells each class has at each level (2024 rules, SRD 5.2.1 class
// tables). The app warns when a character has more than this; it never blocks (DM's call).
// Spells that are always prepared (e.g. from a subclass) and spells from feats don't count, but the
// app can't tell those apart, so the DM keeps that in mind.
import { assertIntInRange } from './validate'
import type { ClassName } from './types'

/** Cantrips known: [from level 1, from level 4, from level 10]. */
const CANTRIPS: Partial<Record<ClassName, [number, number, number]>> = {
  Bard: [2, 3, 4],
  Cleric: [3, 4, 5],
  Druid: [2, 3, 4],
  Sorcerer: [4, 5, 6],
  Warlock: [2, 3, 4],
  Wizard: [3, 4, 5],
}

/** Prepared spells by class level 1..20. */
const FULL = [4, 5, 6, 7, 9, 10, 11, 12, 14, 15, 16, 16, 17, 17, 18, 18, 19, 20, 21, 22]
const HALF = [2, 3, 4, 5, 6, 6, 7, 7, 9, 9, 10, 10, 11, 11, 12, 12, 14, 14, 15, 15]
const PREPARED: Partial<Record<ClassName, number[]>> = {
  Bard: FULL,
  Cleric: FULL,
  Druid: FULL,
  Paladin: HALF,
  Ranger: HALF,
  Sorcerer: [2, 4, 6, 7, 9, 10, 11, 12, 14, 15, 16, 16, 17, 17, 18, 18, 19, 20, 21, 22],
  Warlock: [2, 3, 4, 5, 6, 7, 8, 9, 10, 10, 11, 11, 12, 12, 13, 13, 14, 14, 15, 15],
  Wizard: [4, 5, 6, 7, 9, 10, 11, 12, 14, 15, 16, 16, 17, 18, 19, 21, 22, 23, 24, 25],
}

/** Cantrips and prepared spells for a class level, or null for classes without spellcasting. */
export function spellLimits(className: ClassName, level: number): { cantrips: number; prepared: number } | null {
  assertIntInRange('level', level, 1, 20)
  const prepared = PREPARED[className]
  if (!prepared) return null
  const c = CANTRIPS[className]
  return { cantrips: c ? c[level >= 10 ? 2 : level >= 4 ? 1 : 0] : 0, prepared: prepared[level - 1] }
}
