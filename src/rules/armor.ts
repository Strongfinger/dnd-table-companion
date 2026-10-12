// Armor Class from worn armor and Shield (2024 rules, SRD 5.2.1), with armor training and its drawbacks.
import type { Ability, ClassName } from './types'

export type ArmorCategory = 'Light' | 'Medium' | 'Heavy'

/** The armor table fields the rules need (the SRD data file has more). */
export interface ArmorStats {
  name: string
  category: ArmorCategory
  base: number
  /** null = full DEX modifier, 0 = no DEX, 2 = DEX up to +2. */
  dexCap: number | null
  strMin: number
  stealthDisadvantage: boolean
}

/** Armor training of each class at level 1 (the class tables' "Armor Training" line). */
const CLASS_ARMOR: Record<ClassName, { armor: ArmorCategory[]; shield: boolean }> = {
  Barbarian: { armor: ['Light', 'Medium'], shield: true },
  Bard: { armor: ['Light'], shield: false },
  Cleric: { armor: ['Light', 'Medium'], shield: true },
  Druid: { armor: ['Light'], shield: true },
  Fighter: { armor: ['Light', 'Medium', 'Heavy'], shield: true },
  Monk: { armor: [], shield: false },
  Paladin: { armor: ['Light', 'Medium', 'Heavy'], shield: true },
  Ranger: { armor: ['Light', 'Medium'], shield: true },
  Rogue: { armor: ['Light'], shield: false },
  Sorcerer: { armor: [], shield: false },
  Warlock: { armor: ['Light'], shield: false },
  Wizard: { armor: [], shield: false },
}

export function classArmorTraining(className: ClassName): { armor: ArmorCategory[]; shield: boolean } {
  return CLASS_ARMOR[className]
}

export interface ArmorClassInput {
  className: ClassName
  subclass: string
  level: number
  modifiers: Record<Ability, number>
  strScore: number
  feats: string[]
  /** The worn suit of armor, or null. */
  armor: ArmorStats | null
  /** Holding a Shield (+2). */
  shield: boolean
  /** A creature from a stat block: trained with any armor. */
  monster?: boolean
  /** Other flat bonuses the player adds (magic items like a Ring of Protection, +1 armor…). */
  bonus?: number
}

export interface ArmorClassResult {
  ac: number
  /** How it was worked out, e.g. "Leather Armor 11 + DEX 3 + Shield 2". */
  formula: string
  /** Speed lost because the armor's Strength requirement isn't met (0 or 10). */
  speedPenalty: number
  stealthDisadvantage: boolean
  /** Armor worn without training: Disadvantage on STR/DEX D20 Tests and no spellcasting. */
  untrainedArmor: boolean
  /** Shield held without training: it gives no AC. */
  untrainedShield: boolean
}

const sign = (n: number) => (n < 0 ? `− ${-n}` : `+ ${n}`)

/**
 * Base AC: worn armor, or without armor the best of 10 + DEX, Unarmored Defense (Barbarian: + CON, Shield
 * allowed; Monk: + WIS, no Shield) and Draconic Resilience (Draconic Sorcery level 3+: + CHA).
 * Then a trained Shield (+2), Defense (+1 while wearing armor) and other bonuses.
 */
export function armorClass(i: ArmorClassInput): ArmorClassResult {
  const m = i.modifiers
  const training = i.monster ? { armor: ['Light', 'Medium', 'Heavy'] as ArmorCategory[], shield: true } : CLASS_ARMOR[i.className]
  const parts: string[] = []
  let ac: number
  if (i.armor) {
    const dex = i.armor.dexCap === null ? m.dex : Math.min(m.dex, i.armor.dexCap)
    ac = i.armor.base + dex
    parts.push(`${i.armor.name} ${i.armor.base}`)
    if (i.armor.dexCap !== 0) parts.push(`DEX ${sign(dex)}`)
  } else {
    const options: [number, string][] = [[10 + m.dex, `10 DEX ${sign(m.dex)}`]]
    if (!i.monster && i.className === 'Barbarian') options.push([10 + m.dex + m.con, `Unarmored Defense 10 DEX ${sign(m.dex)} CON ${sign(m.con)}`])
    if (!i.monster && i.className === 'Monk' && !i.shield) options.push([10 + m.dex + m.wis, `Unarmored Defense 10 DEX ${sign(m.dex)} WIS ${sign(m.wis)}`])
    if (!i.monster && i.className === 'Sorcerer' && i.level >= 3 && /draconic/i.test(i.subclass)) {
      options.push([10 + m.dex + m.cha, `Draconic Resilience 10 DEX ${sign(m.dex)} CHA ${sign(m.cha)}`])
    }
    const best = options.reduce((a, b) => (b[0] > a[0] ? b : a))
    ac = best[0]
    parts.push(best[1])
  }
  const untrainedShield = i.shield && !training.shield
  if (i.shield && !untrainedShield) {
    ac += 2
    parts.push('Shield + 2')
  }
  if (i.armor && i.feats.some((f) => /^defense$/i.test(f))) {
    ac += 1
    parts.push('Defense + 1')
  }
  if (i.bonus) {
    ac += i.bonus
    parts.push(`โบนัส ${sign(i.bonus)}`)
  }
  return {
    ac,
    formula: parts.join(' '),
    speedPenalty: i.armor && i.armor.strMin > i.strScore ? 10 : 0,
    stealthDisadvantage: !!i.armor?.stealthDisadvantage,
    untrainedArmor: !!i.armor && !training.armor.includes(i.armor.category),
    untrainedShield,
  }
}
