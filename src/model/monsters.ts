// SRD 5.2.1 monsters for quick-add in the combat tracker (data: src/data/srd-monsters.json).
import { abilityModifier, parseDice, rollDice } from '../rules'
import type { MonsterInput } from './encounter'

export interface SrdMonster {
  id: string
  name: string
  size: string
  type: string
  /** Challenge Rating: 0, 0.125, 0.25, 0.5, 1 … 30 */
  cr: number
  xp: number
  ac: number
  /** Average HP from the stat block. */
  hp: number
  /** HP dice, e.g. "3d6" or "9d8 + 18". */
  hpRoll: string
  speed: string
  /** STR, DEX, CON, INT, WIS, CHA */
  scores: [number, number, number, number, number, number]
}

/** Loaded only when the monster picker opens, so the rest of the app stays small. */
export async function loadSrdMonsters(): Promise<SrdMonster[]> {
  const mod = await import('../data/srd-monsters.json')
  return mod.default as SrdMonster[]
}

/** 0.125 → "1/8", 0.25 → "1/4", 0.5 → "1/2", 5 → "5". */
export function formatCR(cr: number): string {
  if (cr === 0.125) return '1/8'
  if (cr === 0.25) return '1/4'
  if (cr === 0.5) return '1/2'
  return String(cr)
}

/** Search by name or type (case-insensitive), optionally limited to a CR range. Lower CR first. */
export function searchMonsters(list: SrdMonster[], query: string, crMax = 30): SrdMonster[] {
  const q = query.trim().toLowerCase()
  return list
    .filter((m) => m.cr <= crMax && (!q || m.name.toLowerCase().includes(q) || m.type.toLowerCase().includes(q)))
    .sort((a, b) => a.cr - b.cr || a.name.localeCompare(b.name))
}

/** Turn a stat block into tracker input. Initiative bonus = DEX modifier (the data has no initiative). */
export function monsterInput(m: SrdMonster): MonsterInput {
  const dex = abilityModifier(m.scores[1])
  return { name: m.name, ac: m.ac, hpMax: m.hp, initBonus: dex, dexMod: dex }
}

/** Roll HP from the stat block's dice ("9d8 + 18"), at least 1. Falls back to the average. */
export function rollMonsterHp(m: SrdMonster, rng?: () => number): number {
  const e = parseDice(m.hpRoll)
  if (!e) return m.hp
  return Math.max(1, rollDice(e, 'normal', rng).total)
}
