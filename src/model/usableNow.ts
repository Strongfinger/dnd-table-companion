// Pure grouping for the "ใช้ได้เลย" section on the sheet's combat tab: what the player can use right now.
// Slots left per level, limited-use features by recharge, spells by Action / Bonus Action / Reaction,
// and the 18 skills with their modifiers (the numbers come from deriveSheet; nothing is recalculated here).
import { SKILLS, SKILL_ABILITY, type Ability, type ActionKind, type FeatureRecharge, type FeatureUses, type ProficiencyLevel, type Skill } from '../rules'
import type { Character } from './character'
import { actionKindFor, castableSlotLevels } from './castSpell'
import type { CharacterSpell } from './characterSpells'
import { findSpellByName, type SrdSpell } from './spells'

export interface SlotRow {
  /** 1 to 9 */
  level: number
  max: number
  used: number
  left: number
  /** Nothing left at this level. */
  spent: boolean
}

/** One row per spell level that has slots. */
export function slotRows(c: Pick<Character, 'spellSlots'>): SlotRow[] {
  return c.spellSlots
    .map((s, i) => ({ level: i + 1, max: s.max, used: s.used, left: Math.max(0, s.max - s.used), spent: s.max > 0 && s.used >= s.max }))
    .filter((r) => r.max > 0)
}

export interface FeatureRow {
  feature: FeatureUses
  left: number
  /** Used up: shown dimmed with when it comes back. */
  spent: boolean
}

export interface FeatureGroup {
  /** "short" also holds the features that give back one use on a Short Rest. */
  recharge: Exclude<FeatureRecharge, 'shortOne'>
  items: FeatureRow[]
}

/** Limited-use features grouped by the rest that brings them back (Short Rest first). Empty groups are left out. */
export function featureGroups(features: FeatureUses[]): FeatureGroup[] {
  const rows = (kind: FeatureGroup['recharge']): FeatureRow[] =>
    features
      .filter((f) => (kind === 'long' ? f.recharge === 'long' : f.recharge !== 'long'))
      .map((f) => ({ feature: f, left: Math.max(0, f.max - f.used), spent: f.used >= f.max }))
  return (['short', 'long'] as const).map((recharge) => ({ recharge, items: rows(recharge) })).filter((g) => g.items.length > 0)
}

export type SpellGroupKind = ActionKind | 'other'

export interface SpellRow {
  spell: CharacterSpell
  /** The SRD entry, if the spell is in the SRD and the list has loaded. */
  info: SrdSpell | null
  /** Ready to cast: cantrips always, leveled spells when prepared. */
  ready: boolean
  /** A leveled spell with no slot left at its level or higher (still tappable: the app warns, never blocks). */
  noSlot: boolean
}

export interface SpellGroup {
  kind: SpellGroupKind
  items: SpellRow[]
}

const GROUP_ORDER: SpellGroupKind[] = ['action', 'bonusAction', 'reaction', 'other']

/**
 * The character's spells grouped by what the casting takes. Within a group: ready spells first, then by
 * level and name. While the SRD list is still loading (srd null), every spell sits under Action.
 * A spell not found in the SRD (homebrew) counts as an Action, like the cast panel does.
 */
export function spellGroups(c: Pick<Character, 'spells' | 'spellSlots' | 'className'>, srd: SrdSpell[] | null): SpellGroup[] {
  const groups = new Map<SpellGroupKind, SpellRow[]>()
  for (const spell of c.spells) {
    const info = srd ? findSpellByName(srd, spell.name) ?? null : null
    const kind: SpellGroupKind = info ? actionKindFor(info.castingTime) ?? 'other' : 'action'
    const ready = spell.level === 0 || spell.prepared
    // A Ritual needs no slot: prepared, or a Wizard casting from the spellbook (same rule as castPlan).
    const ritualOk = !!info?.ritual && (spell.prepared || c.className === 'Wizard')
    const row: SpellRow = {
      spell,
      info,
      ready,
      noSlot: spell.level > 0 && !ritualOk && castableSlotLevels(c, spell.level).length === 0,
    }
    groups.set(kind, [...(groups.get(kind) ?? []), row])
  }
  return GROUP_ORDER.filter((k) => groups.has(k)).map((kind) => ({
    kind,
    items: groups.get(kind)!.sort((a, b) => Number(b.ready) - Number(a.ready) || a.spell.level - b.spell.level || a.spell.name.localeCompare(b.spell.name)),
  }))
}

export interface SkillCell {
  skill: Skill
  ability: Ability
  bonus: number
  level: ProficiencyLevel
}

/** The 18 skills (alphabetical, as SKILLS) with the modifier from deriveSheet and the proficiency level. */
export function skillCells(c: Pick<Character, 'skills'>, bonuses: Record<Skill, number>): SkillCell[] {
  return SKILLS.map((skill) => ({ skill, ability: SKILL_ABILITY[skill], bonus: bonuses[skill], level: c.skills[skill] ?? 'none' }))
}
