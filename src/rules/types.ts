// Shared game-rule types (D&D 5e 2024 rules, SRD 5.2.1).

export const ABILITIES = ['str', 'dex', 'con', 'int', 'wis', 'cha'] as const
export type Ability = (typeof ABILITIES)[number]

/** How proficient a character is in a skill or save. Expertise doubles the proficiency bonus. */
export type ProficiencyLevel = 'none' | 'proficient' | 'expertise'

export const CLASSES = [
  'Barbarian', 'Bard', 'Cleric', 'Druid', 'Fighter', 'Monk',
  'Paladin', 'Ranger', 'Rogue', 'Sorcerer', 'Warlock', 'Wizard',
] as const
export type ClassName = (typeof CLASSES)[number]

export type HitDie = 6 | 8 | 10 | 12

/** The 15 conditions. Exhaustion is tracked separately as a level 0–6. */
export const CONDITIONS = [
  'Blinded', 'Charmed', 'Deafened', 'Exhaustion', 'Frightened', 'Grappled', 'Incapacitated', 'Invisible',
  'Paralyzed', 'Petrified', 'Poisoned', 'Prone', 'Restrained', 'Stunned', 'Unconscious',
] as const
export type Condition = Exclude<(typeof CONDITIONS)[number], 'Exhaustion'>
