// Guided level-up (owner decision 2026-10-13): one level at a time. The draft gets the new level, saves and
// spell slots from the class tables; the screen adds the subclass (level 3) and the new feat slot's pick on the
// draft; then finishLevelUp() works out the HP gain and adds the catalog features that just became available.
import {
  abilityModifier, CLASS_HIT_DIE, classSavesAtLevel, featSlotsAt, fixedHitDieValue, maxExpertise, spellSlotsFor, SUBCLASS_LEVEL,
  suggestedMaxHp, type FeatSlot,
} from '../rules'
import type { Character } from './character'
import { addNewlyAvailable, refreshCatalogFeatures } from './featureCatalog'
import type { SrdFeatureTexts } from './featureTexts'

/** The character one level up, before HP and features: level, saves, spell slots (used slots kept). */
export function levelUpDraft(c: Character): Character {
  const level = Math.min(20, c.level + 1)
  return {
    ...c,
    level,
    saveProficiencies: classSavesAtLevel(c.className, level),
    spellSlots: spellSlotsFor(c.className, level).map((max, i) => ({ max, used: Math.min(c.spellSlots[i]?.used ?? 0, max) })),
  }
}

export interface LevelUpInfo {
  hitDie: number
  /** The fixed value (half the die + 1) a player may take instead of rolling. */
  fixed: number
  needsSubclass: boolean
  /** Feat slots that open at the new level (Ability Score Improvement, Fighting Style, Epic Boon). */
  newSlots: FeatSlot[]
  /** Class/subclass features gained at the new level (names, from the SRD texts). */
  newFeatures: string[]
  /** More Expertise to choose (on the edit page). */
  expertiseGain: number
  /** Spell slots changed. */
  slotsChanged: boolean
}

export function levelUpInfo(before: Character, draft: Character, texts: SrdFeatureTexts | null): LevelUpInfo {
  const hitDie = CLASS_HIT_DIE[before.className]
  return {
    hitDie,
    fixed: fixedHitDieValue(hitDie),
    needsSubclass: draft.level >= SUBCLASS_LEVEL && !draft.subclass.trim(),
    newSlots: featSlotsAt(draft),
    newFeatures: (texts?.classFeatures ?? [])
      .filter((f) => f.className === before.className && f.level === draft.level && (!f.subclass || f.subclass.toLowerCase() === draft.subclass.trim().toLowerCase()))
      .map((f) => f.name),
    expertiseGain: maxExpertise(before.className, draft.level) - maxExpertise(before.className, before.level),
    slotsChanged: JSON.stringify(spellSlotsFor(before.className, before.level)) !== JSON.stringify(spellSlotsFor(before.className, draft.level)),
  }
}

/**
 * HP gained: the die (rolled or fixed) + CON modifier, at least 1, plus what else changes the class formula:
 * Dwarven Toughness / Draconic Resilience, and a higher CON modifier counting for every level (2024).
 */
export function hpGain(before: Character, after: Character, dieValue: number): number {
  const con = abilityModifier(after.scores.con)
  const base = Math.max(1, dieValue + con)
  const fixedBase = Math.max(1, fixedHitDieValue(CLASS_HIT_DIE[before.className]) + con)
  const extras = suggestedMaxHp(after) - suggestedMaxHp(before) - fixedBase
  return Math.max(1, base + extras)
}

/** Apply HP and features to the draft (with its subclass and feat picks) to get the leveled-up character. */
export function finishLevelUp(before: Character, draft: Character, dieValue: number): Character {
  const gain = hpGain(before, draft, dieValue)
  const withHp = { ...draft, hp: { ...draft.hp, max: Math.min(999, draft.hp.max + gain), current: Math.min(999, draft.hp.current + gain) } }
  return refreshCatalogFeatures(addNewlyAvailable(before, withHp))
}
