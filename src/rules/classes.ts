// Per-class defaults (2024 rules), used to pre-fill a new character when a class is picked.
import type { Ability, ClassName } from './types'

/** The two saving throws each class is proficient in. */
export const CLASS_SAVES: Record<ClassName, [Ability, Ability]> = {
  Barbarian: ['str', 'con'],
  Bard: ['dex', 'cha'],
  Cleric: ['wis', 'cha'],
  Druid: ['int', 'wis'],
  Fighter: ['str', 'con'],
  Monk: ['str', 'dex'],
  Paladin: ['wis', 'cha'],
  Ranger: ['str', 'dex'],
  Rogue: ['dex', 'int'],
  Sorcerer: ['con', 'cha'],
  Warlock: ['wis', 'cha'],
  Wizard: ['int', 'wis'],
}

/** Spellcasting ability per class, or null for classes without Spellcasting. */
export const CLASS_SPELLCASTING: Record<ClassName, Ability | null> = {
  Barbarian: null,
  Bard: 'cha',
  Cleric: 'wis',
  Druid: 'wis',
  Fighter: null,
  Monk: null,
  Paladin: 'cha',
  Ranger: 'wis',
  Rogue: null,
  Sorcerer: 'cha',
  Warlock: 'cha',
  Wizard: 'int',
}
