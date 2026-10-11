// Turns the stored character data into every number shown on the sheet.
// The UI never does its own math: it calls deriveSheet() and displays the result.

import { abilityModifier, formatModifier } from './abilities'
import { attackBonus, initiativeBonus } from './combat'
import { CLASS_HIT_DIE, maxHitPoints } from './hp'
import { proficiencyBonus } from './proficiency'
import { checkBonus, passiveScore, SKILL_ABILITY, SKILLS, type Skill } from './skills'
import { spellAttackBonus, spellSaveDC } from './spellcasting'
import { ABILITIES, type Ability, type ClassName, type ProficiencyLevel } from './types'

/** The parts of a character the rules need. The stored Character has these plus more. */
export interface SheetInput {
  className: ClassName
  level: number
  scores: Record<Ability, number>
  saveProficiencies: Ability[]
  skills: Partial<Record<Skill, ProficiencyLevel>>
  /** Alert feat (2024): add proficiency bonus to Initiative. */
  initiativeProficient: boolean
  /** Any other flat Initiative bonus or penalty. */
  initiativeMisc: number
  spellcastingAbility: Ability | null
  attacks: AttackInput[]
}

export interface AttackInput {
  id: string
  name: string
  ability: Ability
  proficient: boolean
  /** Damage dice like "2d6", or a flat number like "1" (Unarmed Strike). */
  damageDice: string
  damageType: string
  /** False for an off-hand (Light weapon) attack: it skips a positive modifier, but a negative one still applies. */
  addModToDamage: boolean
}

export interface DerivedAttack {
  id: string
  name: string
  hit: number
  damage: string
  damageType: string
}

export interface DerivedSheet {
  proficiencyBonus: number
  modifiers: Record<Ability, number>
  saves: Record<Ability, number>
  skills: Record<Skill, number>
  passivePerception: number
  passiveInsight: number
  passiveInvestigation: number
  initiative: number
  /**
   * Max HP using fixed values per level, ignoring rolls and extras like Dwarven Toughness.
   * Only a suggestion when creating a character; the sheet stores and shows the real max.
   */
  suggestedMaxHp: number
  spellSaveDC: number | null
  spellAttack: number | null
  attacks: DerivedAttack[]
}

/** "2d6" + 3 → "2d6+3"; "1d6" + 0 → "1d6"; a flat "1" + 3 → "4". */
export function formatDamage(dice: string, mod: number): string {
  if (/^\d+$/.test(dice)) return String(Math.max(0, Number(dice) + mod))
  return mod === 0 ? dice : `${dice}${formatModifier(mod)}`
}

export function deriveSheet(c: SheetInput): DerivedSheet {
  const prof = proficiencyBonus(c.level)
  const modifiers = Object.fromEntries(ABILITIES.map((a) => [a, abilityModifier(c.scores[a])])) as Record<Ability, number>

  const saves = Object.fromEntries(
    ABILITIES.map((a) => [a, checkBonus(modifiers[a], c.saveProficiencies.includes(a) ? 'proficient' : 'none', prof)]),
  ) as Record<Ability, number>

  const skills = Object.fromEntries(
    SKILLS.map((s) => [s, checkBonus(modifiers[SKILL_ABILITY[s]], c.skills[s] ?? 'none', prof)]),
  ) as Record<Skill, number>

  const castMod = c.spellcastingAbility ? modifiers[c.spellcastingAbility] : null

  return {
    proficiencyBonus: prof,
    modifiers,
    saves,
    skills,
    passivePerception: passiveScore(skills.Perception),
    passiveInsight: passiveScore(skills.Insight),
    passiveInvestigation: passiveScore(skills.Investigation),
    initiative: initiativeBonus(modifiers.dex, (c.initiativeProficient ? prof : 0) + c.initiativeMisc),
    suggestedMaxHp: maxHitPoints(CLASS_HIT_DIE[c.className], c.level, modifiers.con),
    spellSaveDC: castMod === null ? null : spellSaveDC(prof, castMod),
    spellAttack: castMod === null ? null : spellAttackBonus(prof, castMod),
    attacks: c.attacks.map((a) => ({
      id: a.id,
      name: a.name,
      hit: attackBonus(modifiers[a.ability], prof, a.proficient),
      damage: formatDamage(a.damageDice, a.addModToDamage ? modifiers[a.ability] : Math.min(0, modifiers[a.ability])),
      damageType: a.damageType,
    })),
  }
}
