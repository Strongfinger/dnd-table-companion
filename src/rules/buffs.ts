// Temporary effects the DM puts on a character outside the fight tracker's round counts:
// a spell like Longstrider (+10 ft. Speed) or a homebrew blessing (+1 to skill checks until a Long Rest).
// Flat numbers are added into the sheet's numbers by deriveSheet(); anything else (e.g. Bless's 1d4)
// is written in the note and only shown.

/** What a buff can add a flat number to. */
export const BUFF_TARGETS = ['ac', 'speed', 'attack', 'saves', 'skills', 'initiative'] as const
export type BuffTarget = (typeof BUFF_TARGETS)[number]

/** When it ends: the next Short Rest (a Long Rest also ends it), the next Long Rest, or only when removed. */
export type BuffEnds = 'shortRest' | 'longRest' | 'manual'
export const BUFF_ENDS: readonly BuffEnds[] = ['shortRest', 'longRest', 'manual']

export interface Buff {
  id: string
  name: string
  /** Free text, e.g. "+1d4 Attack rolls และ Saving Throws". */
  note: string
  /** Flat bonuses (negative = penalty). Missing = 0. */
  mods: Partial<Record<BuffTarget, number>>
  ends: BuffEnds
}

/** Largest bonus or penalty one buff may give to one number (speed in feet). */
export const BUFF_LIMIT: Record<BuffTarget, number> = { ac: 10, speed: 120, attack: 10, saves: 10, skills: 10, initiative: 10 }

export type BuffTotals = Record<BuffTarget, number>

const sameName = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase()

/**
 * Total bonus per number. 2024 "Combining Game Effects": different effects add up, but the same effect
 * twice doesn't (only the most potent counts), so same-named buffs give their highest value per number.
 */
export function buffTotals(buffs: readonly Buff[] = []): BuffTotals {
  const best = new Map<string, Partial<Record<BuffTarget, number>>>()
  for (const b of buffs) {
    const key = b.name.trim().toLowerCase()
    const prev = best.get(key)
    if (!prev) best.set(key, { ...b.mods })
    else for (const t of BUFF_TARGETS) if (b.mods[t] !== undefined) prev[t] = Math.max(prev[t] ?? -Infinity, b.mods[t]!)
  }
  const out = Object.fromEntries(BUFF_TARGETS.map((t) => [t, 0])) as BuffTotals
  for (const mods of best.values()) for (const t of BUFF_TARGETS) out[t] += mods[t] ?? 0
  return out
}

/** Add a buff; one with the same name is replaced (cast again = fresh duration, no stacking). */
export function addBuff(buffs: readonly Buff[], buff: Buff): Buff[] {
  return [...buffs.filter((b) => !sameName(b.name, buff.name)), buff]
}

/** Buffs left after a rest: a Short Rest ends "shortRest" buffs, a Long Rest ends those and "longRest" ones. */
export function buffsAfterRest(buffs: readonly Buff[], rest: 'short' | 'long'): Buff[] {
  return buffs.filter((b) => b.ends === 'manual' || (rest === 'short' && b.ends === 'longRest'))
}

/** AC shown at the table: the sheet's AC plus AC buffs (kept 1–40 like the stored value). */
export function buffedArmorClass(ac: number, buffs: readonly Buff[] = []): number {
  return Math.min(40, Math.max(1, ac + buffTotals(buffs).ac))
}
