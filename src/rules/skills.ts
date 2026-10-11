import { proficiencyContribution } from './proficiency'
import type { Ability, ProficiencyLevel } from './types'

/** The 18 SRD skills and the ability each one uses. */
export const SKILL_ABILITY = {
  'Acrobatics': 'dex',
  'Animal Handling': 'wis',
  'Arcana': 'int',
  'Athletics': 'str',
  'Deception': 'cha',
  'History': 'int',
  'Insight': 'wis',
  'Intimidation': 'cha',
  'Investigation': 'int',
  'Medicine': 'wis',
  'Nature': 'int',
  'Perception': 'wis',
  'Performance': 'cha',
  'Persuasion': 'cha',
  'Religion': 'int',
  'Sleight of Hand': 'dex',
  'Stealth': 'dex',
  'Survival': 'wis',
} as const satisfies Record<string, Ability>

export type Skill = keyof typeof SKILL_ABILITY
export const SKILLS = Object.keys(SKILL_ABILITY) as Skill[]

/**
 * Bonus for a skill check or saving throw:
 * ability modifier + proficiency (0, ×1, or ×2 with Expertise).
 */
export function checkBonus(abilityMod: number, prof: ProficiencyLevel, profBonus: number): number {
  return abilityMod + proficiencyContribution(prof, profBonus)
}

/** Passive score (e.g. Passive Perception): 10 + bonus, ±5 for advantage/disadvantage. */
export function passiveScore(
  bonus: number,
  roll: 'normal' | 'advantage' | 'disadvantage' = 'normal',
): number {
  const adjust = roll === 'advantage' ? 5 : roll === 'disadvantage' ? -5 : 0
  return 10 + bonus + adjust
}
