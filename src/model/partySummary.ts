// The party overview's summary and ordering (screens/PartyOverview.tsx). Pure functions.
// - "ต้องดูแลก่อน": who is dead, dying (0 HP, still rolling Death Saves), down but stable, or Bloodied, worst first.
// - Party totals: HP, lowest / highest Passive Perception, Spell Slots and Hit Dice left.
// - Sort: by name, by HP left (lowest share first, so whoever needs help is on top), or by Initiative bonus.
import { healthStatus } from './playerView'

/** Worst first: the order of the "ต้องดูแลก่อน" box. */
export type CareKind = 'dead' | 'dying' | 'stable' | 'bloodied'
const CARE_ORDER: CareKind[] = ['dying', 'dead', 'stable', 'bloodied']

export interface PartyMember {
  id: string
  name: string
  hp: { current: number; max: number }
  deathSaves?: { successes: number; failures: number }
  initiative?: number
  passivePerception?: number
  /** Spell Slots: left and total, all levels together. */
  slots?: { left: number; max: number }
  hitDice?: { left: number; max: number }
}

/** How much this member needs help, or null when they are fine (or only lightly hurt). */
export function careKind(m: PartyMember): CareKind | null {
  if (m.hp.current <= 0) {
    const saves = m.deathSaves ?? { successes: 0, failures: 0 }
    if (saves.failures >= 3) return 'dead'
    if (saves.successes >= 3) return 'stable'
    return 'dying'
  }
  return healthStatus(m.hp) === 'bloodied' ? 'bloodied' : null
}

/** Everyone who needs help, worst first (then lowest HP share). */
export function needsCare<T extends PartyMember>(party: T[]): { member: T; kind: CareKind }[] {
  return party
    .map((member) => ({ member, kind: careKind(member) }))
    .filter((x): x is { member: T; kind: CareKind } => x.kind !== null)
    .sort((a, b) => CARE_ORDER.indexOf(a.kind) - CARE_ORDER.indexOf(b.kind) || hpShare(a.member) - hpShare(b.member))
}

const hpShare = (m: PartyMember) => (m.hp.max > 0 ? m.hp.current / m.hp.max : 0)

export interface PartyTotals {
  hp: { current: number; max: number }
  /** Lowest and highest Passive Perception, with who has it (null when nobody has one). */
  lowestPerception: { name: string; value: number } | null
  highestPerception: { name: string; value: number } | null
  slots: { left: number; max: number }
  hitDice: { left: number; max: number }
}

export function partyTotals(party: PartyMember[]): PartyTotals {
  const add = (sum: { left: number; max: number }, x?: { left: number; max: number }) =>
    x ? { left: sum.left + x.left, max: sum.max + x.max } : sum
  let lowest: PartyTotals['lowestPerception'] = null
  let highest: PartyTotals['highestPerception'] = null
  for (const m of party) {
    const v = m.passivePerception
    if (v === undefined) continue
    if (!lowest || v < lowest.value) lowest = { name: m.name, value: v }
    if (!highest || v > highest.value) highest = { name: m.name, value: v }
  }
  return {
    hp: party.reduce((sum, m) => ({ current: sum.current + Math.max(0, m.hp.current), max: sum.max + m.hp.max }), { current: 0, max: 0 }),
    lowestPerception: lowest,
    highestPerception: highest,
    slots: party.reduce((sum, m) => add(sum, m.slots), { left: 0, max: 0 }),
    hitDice: party.reduce((sum, m) => add(sum, m.hitDice), { left: 0, max: 0 }),
  }
}

export type PartySort = 'name' | 'hp' | 'initiative'

export const PARTY_SORTS: { value: PartySort; label: string }[] = [
  { value: 'name', label: 'ชื่อ' },
  { value: 'hp', label: 'HP น้อยก่อน' },
  { value: 'initiative', label: 'Initiative' },
]

/** A sorted copy. Ties fall back to the name, so the order never jumps around. */
export function sortParty<T extends PartyMember>(party: T[], sort: PartySort): T[] {
  const byName = (a: T, b: T) => a.name.localeCompare(b.name)
  const compare = {
    name: byName,
    hp: (a: T, b: T) => hpShare(a) - hpShare(b) || byName(a, b),
    // Highest bonus first, like the order they would act in.
    initiative: (a: T, b: T) => (b.initiative ?? -99) - (a.initiative ?? -99) || byName(a, b),
  }[sort]
  return [...party].sort(compare)
}
