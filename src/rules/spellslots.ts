// Spell slots per class level (2024 rules). Index 0 = 1st-level slots … index 8 = 9th.
import { assertIntInRange } from './validate'
import type { ClassName } from './types'

// Full caster table, rows = character level 1..20.
const FULL: number[][] = [
  [2], [3], [4, 2], [4, 3], [4, 3, 2], [4, 3, 3], [4, 3, 3, 1], [4, 3, 3, 2], [4, 3, 3, 3, 1], [4, 3, 3, 3, 2],
  [4, 3, 3, 3, 2, 1], [4, 3, 3, 3, 2, 1], [4, 3, 3, 3, 2, 1, 1], [4, 3, 3, 3, 2, 1, 1], [4, 3, 3, 3, 2, 1, 1, 1],
  [4, 3, 3, 3, 2, 1, 1, 1], [4, 3, 3, 3, 2, 1, 1, 1, 1], [4, 3, 3, 3, 3, 1, 1, 1, 1], [4, 3, 3, 3, 3, 2, 1, 1, 1],
  [4, 3, 3, 3, 3, 2, 2, 1, 1],
]

const FULL_CASTERS: ClassName[] = ['Bard', 'Cleric', 'Druid', 'Sorcerer', 'Wizard']
const HALF_CASTERS: ClassName[] = ['Paladin', 'Ranger']

/** Warlock Pact Magic: [number of slots, slot level] by Warlock level. */
export function pactMagic(level: number): { slots: number; slotLevel: number } {
  assertIntInRange('level', level, 1, 20)
  const slots = level === 1 ? 1 : level < 11 ? 2 : level < 17 ? 3 : 4
  const slotLevel = Math.min(5, Math.ceil(level / 2))
  return { slots, slotLevel }
}

/** Max spell slots for each spell level 1–9 (always 9 numbers). Warlocks get their Pact slots. */
export function spellSlotsFor(className: ClassName, level: number): number[] {
  assertIntInRange('level', level, 1, 20)
  let row: number[] = []
  if (FULL_CASTERS.includes(className)) row = FULL[level - 1]
  // 2024 Paladins and Rangers cast from level 1, using the full table at half their level (rounded up).
  else if (HALF_CASTERS.includes(className)) row = FULL[Math.ceil(level / 2) - 1]
  else if (className === 'Warlock') {
    const { slots, slotLevel } = pactMagic(level)
    row = Array.from({ length: slotLevel }, (_, i) => (i === slotLevel - 1 ? slots : 0))
  }
  return Array.from({ length: 9 }, (_, i) => row[i] ?? 0)
}

/** Warlock Pact Magic slots come back on a Short Rest; everyone else's on a Long Rest. */
export function slotsRechargeOnShortRest(className: ClassName): boolean {
  return className === 'Warlock'
}
