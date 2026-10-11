import { assertIntInRange } from './validate'

/** Ability modifier: floor((score - 10) / 2). Scores range 1–30. */
export function abilityModifier(score: number): number {
  assertIntInRange('ability score', score, 1, 30)
  return Math.floor((score - 10) / 2)
}

/** Show a bonus with its sign, e.g. 3 → "+3", -1 → "-1", 0 → "+0". */
export function formatModifier(mod: number): string {
  return mod >= 0 ? `+${mod}` : `${mod}`
}
