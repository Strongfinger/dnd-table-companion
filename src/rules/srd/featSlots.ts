// All 17 SRD 5.2.1 feats and when a character gets to pick one (2024 rules). Checked against the SRD 5.2.1 PDF
// ("Feats" chapter and each class's features table).
//
// - Level 1: an Origin feat from the background (Humans: one more, Versatile).
// - Ability Score Improvement feature: every class at levels 4, 8, 12, 16; Fighter also 6 and 14; Rogue also 10.
//   Take the Ability Score Improvement feat or any other feat you qualify for.
// - Fighting Style feature: Fighter 1, Paladin 2, Ranger 2 (Champion: another at Fighter 7). Paladin and Ranger
//   may take a class option instead (Blessed Warrior / Druidic Warrior).
// - Epic Boon feature: every class at level 19 (an Epic Boon feat or another feat you qualify for).
import type { Ability, ClassName } from '../types'

export type FeatCategory = 'Origin' | 'General' | 'Fighting Style' | 'Epic Boon'

export interface SrdFeat {
  name: string
  category: FeatCategory
  repeatable: boolean
  /** Ability increase the feat gives: `points` to spend on `abilities` (ASI: 2, as +2 or +1/+1), up to `max`. */
  increase?: { points: number; abilities: readonly Ability[]; max: number; split: boolean }
  /** Extra requirement besides the category's level (shown, not enforced). */
  prerequisite?: string
}

const ANY: readonly Ability[] = ['str', 'dex', 'con', 'int', 'wis', 'cha']
const boon = (name: string, prerequisite?: string): SrdFeat => ({
  name, category: 'Epic Boon', repeatable: false, increase: { points: 1, abilities: ANY, max: 30, split: false }, ...(prerequisite ? { prerequisite } : {}),
})

export const SRD_FEATS: SrdFeat[] = [
  { name: 'Alert', category: 'Origin', repeatable: false },
  { name: 'Magic Initiate', category: 'Origin', repeatable: true },
  { name: 'Savage Attacker', category: 'Origin', repeatable: false },
  { name: 'Skilled', category: 'Origin', repeatable: true },
  { name: 'Ability Score Improvement', category: 'General', repeatable: true, increase: { points: 2, abilities: ANY, max: 20, split: true } },
  { name: 'Grappler', category: 'General', repeatable: false, increase: { points: 1, abilities: ['str', 'dex'], max: 20, split: false }, prerequisite: 'Strength or Dexterity 13+' },
  { name: 'Archery', category: 'Fighting Style', repeatable: false },
  { name: 'Defense', category: 'Fighting Style', repeatable: false },
  { name: 'Great Weapon Fighting', category: 'Fighting Style', repeatable: false },
  { name: 'Two-Weapon Fighting', category: 'Fighting Style', repeatable: false },
  boon('Boon of Combat Prowess'),
  boon('Boon of Dimensional Travel'),
  boon('Boon of Fate'),
  boon('Boon of Irresistible Offense'),
  boon('Boon of Spell Recall', 'Spellcasting feature'),
  boon('Boon of the Night Spirit'),
  boon('Boon of Truesight'),
]

/** Find an SRD feat by name (case and "Two Weapon" / "Two-Weapon" spelling don't matter). */
export function findSrdFeat(name: string): SrdFeat | undefined {
  const n = name.trim().toLowerCase().replace(/-/g, ' ')
  return SRD_FEATS.find((f) => f.name.toLowerCase().replace(/-/g, ' ') === n)
}

export type FeatSlotKind = 'origin' | 'asi' | 'fightingStyle' | 'epicBoon'

export interface FeatSlot {
  /** Stable id, e.g. "background", "species", "asi-4", "fighting-style-1", "epic-19". */
  id: string
  kind: FeatSlotKind
  /** Class level the slot comes at (1 for background/species). */
  level: number
  /** Thai label for the edit page. */
  label: string
}

const ASI_LEVELS: Record<ClassName, number[]> = {
  Barbarian: [4, 8, 12, 16], Bard: [4, 8, 12, 16], Cleric: [4, 8, 12, 16], Druid: [4, 8, 12, 16],
  Fighter: [4, 6, 8, 12, 14, 16], Monk: [4, 8, 12, 16], Paladin: [4, 8, 12, 16], Ranger: [4, 8, 12, 16],
  Rogue: [4, 8, 10, 12, 16], Sorcerer: [4, 8, 12, 16], Warlock: [4, 8, 12, 16], Wizard: [4, 8, 12, 16],
}
const FIGHTING_STYLE_LEVEL: Partial<Record<ClassName, number>> = { Fighter: 1, Paladin: 2, Ranger: 2 }

/** Every feat slot a character has up to their level. Humans get a second Origin feat (Versatile). */
export function featSlots(c: { className: ClassName; subclass: string; level: number; species: string }): FeatSlot[] {
  const slots: FeatSlot[] = [{ id: 'background', kind: 'origin', level: 1, label: 'Origin Feat จาก Background' }]
  if (c.species.toLowerCase().startsWith('human')) slots.push({ id: 'species', kind: 'origin', level: 1, label: 'Origin Feat จาก Human (Versatile)' })
  const fs = FIGHTING_STYLE_LEVEL[c.className]
  if (fs !== undefined && c.level >= fs) slots.push({ id: `fighting-style-${fs}`, kind: 'fightingStyle', level: fs, label: `Fighting Style (Level ${fs})` })
  if (c.className === 'Fighter' && /champion/i.test(c.subclass) && c.level >= 7) {
    slots.push({ id: 'fighting-style-7', kind: 'fightingStyle', level: 7, label: 'Additional Fighting Style (Champion 7)' })
  }
  for (const l of ASI_LEVELS[c.className]) if (c.level >= l) slots.push({ id: `asi-${l}`, kind: 'asi', level: l, label: `Ability Score Improvement (Level ${l})` })
  if (c.level >= 19) slots.push({ id: 'epic-19', kind: 'epicBoon', level: 19, label: 'Epic Boon (Level 19)' })
  return slots.sort((a, b) => a.level - b.level)
}

/** The slots that open exactly at this level (for the Level Up screen). */
export function featSlotsAt(c: Parameters<typeof featSlots>[0]): FeatSlot[] {
  return featSlots(c).filter((s) => s.level === c.level && s.kind !== 'origin')
}

/**
 * SRD feats a slot may take. Origin: Origin feats. ASI: Ability Score Improvement or any feat the character
 * qualifies for (Origin and General from level 4; Fighting Style only with the Fighting Style feature).
 * Fighting Style: Fighting Style feats. Epic Boon: Epic Boons or any other feat they qualify for.
 */
export function featsForSlot(kind: FeatSlotKind, c: { className: ClassName; level: number }): SrdFeat[] {
  const hasFightingStyle = FIGHTING_STYLE_LEVEL[c.className] !== undefined
  const allowed = (cats: FeatCategory[]) => SRD_FEATS.filter((f) => cats.includes(f.category))
  if (kind === 'origin') return allowed(['Origin'])
  if (kind === 'fightingStyle') return allowed(['Fighting Style'])
  const cats: FeatCategory[] = ['Origin', 'General', ...(hasFightingStyle ? ['Fighting Style' as const] : []), ...(kind === 'epicBoon' || c.level >= 19 ? ['Epic Boon' as const] : [])]
  return allowed(cats)
}
