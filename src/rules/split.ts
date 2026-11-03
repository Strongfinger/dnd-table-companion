// Split and copy a monster in the fight tracker.
// Split follows the SRD 5.2.1 "Split" reaction (Ochre Jelly, Black Pudding): the creature becomes
// two new creatures, and the original's current Hit Points are divided evenly between them (round down).
// The app doesn't track creature size, so the "Large or Medium" part is left to the DM.

/** Minimum Hit Points for the Split reaction to trigger (SRD: "has 10+ Hit Points"). */
export const SPLIT_MIN_HP = 10

/** Each new creature's Hit Points: half the original's current HP, rounded down. */
export function splitHitPoints(current: number): number {
  return Math.floor(Math.max(0, current) / 2)
}

/** The app can split only when each new creature gets at least 1 HP (current HP 2+). */
export function canSplit(current: number): boolean {
  return splitHitPoints(current) >= 1
}

/** Does the creature meet the Split trigger's Hit Point condition (10+ HP)? */
export function meetsSplitHp(current: number): boolean {
  return current >= SPLIT_MIN_HP
}

const LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'

/**
 * Names for the two halves: "Ochre Jelly" → "Ochre Jelly A" / "Ochre Jelly B".
 * Splitting a half again adds another letter: "Ochre Jelly A" → "Ochre Jelly AA" / "Ochre Jelly AB".
 * Letters already used by other combatants are skipped, so names never repeat.
 */
export function splitNames(name: string, taken: string[]): [string, string] {
  const trimmed = name.trim() || 'Monster'
  const stem = /\s[A-Z]+$/.test(trimmed) ? trimmed : `${trimmed} `
  const used = new Set(taken)
  const free: string[] = []
  for (let i = 0; free.length < 2; i++) {
    // After Z, fall back to numbers (A..Z, then 27, 28…) so it always ends.
    const candidate = `${stem}${i < LETTERS.length ? LETTERS[i] : i + 1}`
    if (!used.has(candidate)) free.push(candidate)
  }
  return [free[0], free[1]]
}

/**
 * Name for one more copy of a monster: the next free number after the same base name.
 * "Goblin" → "Goblin 2" (an unnumbered "Goblin" counts as 1), "Goblin 3" → the highest number + 1.
 */
export function copyName(name: string, taken: string[]): string {
  const base = name.trim().replace(/\s+\d+$/, '') || 'Monster'
  const escaped = base.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const numberOf = (n: string) => (n === base ? 1 : Number(n.match(new RegExp(`^${escaped} (\\d+)$`))?.[1] ?? 0))
  const highest = Math.max(1, ...taken.map(numberOf))
  return `${base} ${highest + 1}`
}

/**
 * The monster's name without copy numbers or split letters: "Goblin 3" → "Goblin",
 * "Ochre Jelly AB" → "Ochre Jelly", "Ochre Jelly A 2" → "Ochre Jelly". Used to find its stat block
 * (exact name is tried first) and to group copies. Note: a homebrew "Golem III" also becomes "Golem".
 */
export function monsterBaseName(name: string): string {
  return name.trim().replace(/(\s+(\d+|[A-Z]{1,3}))+$/, '')
}
