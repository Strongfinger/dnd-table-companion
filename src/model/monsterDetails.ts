// Full SRD 5.2.1 stat blocks for the lookup (data: src/data/srd-monster-details.json, built by
// scripts/srd/monster-details.mjs). Joined with the quick-add list (srd-monsters.json) by id.
import { abilityModifier, formatModifier, type Ability } from '../rules'
import { formatCR, loadSrdMonsters, type SrdMonster } from './monsters'

export interface StatBlockEntry {
  name: string
  /** "Recharge 5–6", "3/Day, or 4/Day in Lair"… */
  usage?: string
  text: string
  /** Spell lists a Spellcasting entry leaves out of its text, grouped like the book ("At Will", "1/Day Each"). */
  spells?: { usage: string; names: string[] }[]
}

export interface MonsterDetail {
  id: string
  alignment: string
  /** What the AC comes from, e.g. ["Leather Armor", "Shield"]. */
  acFrom: string[]
  /** Saving throw bonuses the monster is proficient in (others use the plain modifier). */
  saves: Partial<Record<Ability, number>>
  skills: { name: string; bonus: number }[]
  vulnerabilities: string[]
  resistances: string[]
  immunities: string[]
  conditionImmunities: string[]
  senses: string[]
  passivePerception: number
  languages: string
  /** Proficiency Bonus. */
  pb: number
  xpInLair?: number
  gear?: string
  traits: StatBlockEntry[]
  actions: StatBlockEntry[]
  bonusActions: StatBlockEntry[]
  reactions: StatBlockEntry[]
  legendaryActions: StatBlockEntry[]
  /** e.g. "3 (4 in Lair)" (from the SRD 5.2.1 PDF). */
  legendaryUses?: string
}

export type FullMonster = SrdMonster & MonsterDetail

/** Loaded only when the lookup opens (about 400 KB), so the rest of the app stays small. */
export async function loadFullMonsters(): Promise<FullMonster[]> {
  const [list, details] = await Promise.all([loadSrdMonsters(), import('../data/srd-monster-details.json')])
  const byId = new Map((details.default as MonsterDetail[]).map((d) => [d.id, d]))
  return list.flatMap((m) => {
    const d = byId.get(m.id)
    return d ? [{ ...m, ...d }] : []
  })
}

const ORDER: Ability[] = ['str', 'dex', 'con', 'int', 'wis', 'cha']

/** The six abilities as the 2024 stat block shows them: score, modifier and saving throw. */
export function abilityRows(m: Pick<FullMonster, 'scores' | 'saves'>): { ability: Ability; score: number; mod: string; save: string }[] {
  return ORDER.map((ability, i) => {
    const mod = abilityModifier(m.scores[i])
    return { ability, score: m.scores[i], mod: formatModifier(mod), save: formatModifier(m.saves[ability] ?? mod) }
  })
}

/** "Blindsight 60 ft., Darkvision 120 ft.; Passive Perception 23" */
export function sensesLine(m: Pick<FullMonster, 'senses' | 'passivePerception'>): string {
  return [m.senses.join(', '), `Passive Perception ${m.passivePerception}`].filter(Boolean).join('; ')
}

/** "1/4 (XP 50; PB +2)" or "17 (XP 18,000, or 20,000 in lair; PB +6)" */
export function challengeLine(m: Pick<FullMonster, 'cr' | 'xp' | 'xpInLair' | 'pb'>): string {
  const xp = m.xp.toLocaleString('en-US') + (m.xpInLair ? `, or ${m.xpInLair.toLocaleString('en-US')} in lair` : '')
  return `${formatCR(m.cr)} (XP ${xp}; PB ${formatModifier(m.pb)})`
}

/** Damage and condition immunities on one line, the 2024 way: "Fire, Poison; Charmed, Frightened". */
export function immunitiesLine(m: Pick<FullMonster, 'immunities' | 'conditionImmunities'>): string {
  return [m.immunities.join(', '), m.conditionImmunities.join(', ')].filter(Boolean).join('; ')
}

/**
 * The SRD monster a tracker combatant is, from its name: "Goblin Warrior 2" → Goblin Warrior.
 * Exact name first, then without the copy number. Renamed or homebrew monsters give undefined.
 */
export function findMonsterForCombatant<T extends { name: string }>(list: T[], combatantName: string): T | undefined {
  const name = combatantName.trim().toLowerCase()
  const base = name.replace(/\s+\d+$/, '')
  return list.find((m) => m.name.toLowerCase() === name) ?? list.find((m) => m.name.toLowerCase() === base)
}
