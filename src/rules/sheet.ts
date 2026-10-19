// Turns the stored character data into every number shown on the sheet.
// The UI never does its own math: it calls deriveSheet() and displays the result.

import { abilityModifier, formatModifier } from './abilities'
import { buffTotals, type Buff, type BuffTotals } from './buffs'
import { attackBonus, initiativeBonus } from './combat'
import { CLASS_HIT_DIE, maxHitPoints, monsterAverageHp } from './hp'
import { exhaustionPenalty } from './play'
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
  /** Exhaustion level 0–6 (optional so old data and test fixtures work). */
  exhaustion?: number
  /** Base Speed in feet before Exhaustion. */
  speed?: number
  /**
   * A creature from a stat block played as a character (e.g. a monster companion): it has no class
   * levels, so its Proficiency Bonus comes from its CR and its Hit Dice from its stat block.
   */
  monster?: { pb: number; hitDie: number }
  /** Temporary buffs from the DM (rules/buffs.ts): their flat bonuses are added into the numbers below. */
  buffs?: Buff[]
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
  /** Speed after Exhaustion, or null if no base speed was given. */
  speed: number | null
  /** Amount already subtracted from every D20 Test (Exhaustion). */
  d20Penalty: number
  /** Bonuses from buffs, already added above (AC and SRD weapon attacks add theirs where they are worked out). */
  buffs: BuffTotals
}

/** "2d6" + 3 → "2d6+3"; "1d6" + 0 → "1d6"; a flat "1" + 3 → "4". */
export function formatDamage(dice: string, mod: number): string {
  if (/^\d+$/.test(dice)) return String(Math.max(0, Number(dice) + mod))
  return mod === 0 ? dice : `${dice}${formatModifier(mod)}`
}

export function deriveSheet(c: SheetInput): DerivedSheet {
  const prof = c.monster ? c.monster.pb : proficiencyBonus(c.level)
  // Exhaustion lowers every D20 Test: saves, checks, attacks, Initiative (not the spell save DC).
  const penalty = exhaustionPenalty(c.exhaustion ?? 0)
  const d20 = penalty.d20
  const b = buffTotals(c.buffs)
  const modifiers = Object.fromEntries(ABILITIES.map((a) => [a, abilityModifier(c.scores[a])])) as Record<Ability, number>

  const saves = Object.fromEntries(
    ABILITIES.map((a) => [a, checkBonus(modifiers[a], c.saveProficiencies.includes(a) ? 'proficient' : 'none', prof) - d20 + b.saves]),
  ) as Record<Ability, number>

  // Buffs to skill checks also count for passive scores (10 + everything that adds to the check).
  const skillBonus = (s: Skill) => checkBonus(modifiers[SKILL_ABILITY[s]], c.skills[s] ?? 'none', prof) + b.skills
  const skills = Object.fromEntries(SKILLS.map((s) => [s, skillBonus(s) - d20])) as Record<Skill, number>

  const castMod = c.spellcastingAbility ? modifiers[c.spellcastingAbility] : null

  return {
    proficiencyBonus: prof,
    modifiers,
    saves,
    skills,
    // Passive scores involve no d20 roll, so Exhaustion's roll penalty doesn't apply.
    passivePerception: passiveScore(skillBonus('Perception')),
    passiveInsight: passiveScore(skillBonus('Insight')),
    passiveInvestigation: passiveScore(skillBonus('Investigation')),
    initiative: initiativeBonus(modifiers.dex, (c.initiativeProficient ? prof : 0) + c.initiativeMisc) - d20 + b.initiative,
    // Characters: the class formula. A creature from a stat block: its average (Hit Dice = level).
    suggestedMaxHp: c.monster
      ? monsterAverageHp(c.monster.hitDie, c.level, modifiers.con)
      : maxHitPoints(CLASS_HIT_DIE[c.className], c.level, modifiers.con),
    spellSaveDC: castMod === null ? null : spellSaveDC(prof, castMod),
    spellAttack: castMod === null ? null : spellAttackBonus(prof, castMod) - d20 + b.attack,
    attacks: c.attacks.map((a) => ({
      id: a.id,
      name: a.name,
      hit: attackBonus(modifiers[a.ability], prof, a.proficient) - d20 + b.attack,
      damage: formatDamage(a.damageDice, a.addModToDamage ? modifiers[a.ability] : Math.min(0, modifiers[a.ability])),
      damageType: a.damageType,
    })),
    speed: c.speed === undefined ? null : Math.max(0, c.speed - penalty.speed + b.speed),
    d20Penalty: d20,
    buffs: b,
  }
}
