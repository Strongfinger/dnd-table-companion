import type { ProficiencyLevel } from './types'
import { assertIntInRange } from './validate'

/** Proficiency bonus by total character level: +2 at 1–4, +3 at 5–8, … +6 at 17–20. */
export function proficiencyBonus(level: number): number {
  assertIntInRange('level', level, 1, 20)
  return Math.ceil(level / 4) + 1
}

/** How much proficiency adds: 0, the bonus, or double it with Expertise. */
export function proficiencyContribution(prof: ProficiencyLevel, bonus: number): number {
  if (prof === 'expertise') return bonus * 2
  if (prof === 'proficient') return bonus
  return 0
}
