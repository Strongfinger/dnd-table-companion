import { describe, expect, it } from 'vitest'
import { CLASS_HIT_DIE, fixedHitDieValue, maxHitPoints, maxHitPointsFromRolls } from './hp'

describe('CLASS_HIT_DIE', () => {
  it('matches the SRD for all 12 classes', () => {
    expect(CLASS_HIT_DIE).toEqual({
      Barbarian: 12, Bard: 8, Cleric: 8, Druid: 8, Fighter: 10, Monk: 8,
      Paladin: 10, Ranger: 10, Rogue: 8, Sorcerer: 6, Warlock: 8, Wizard: 6,
    })
  })
})

describe('fixedHitDieValue', () => {
  it.each([[6, 4], [8, 5], [10, 6], [12, 7]] as const)('d%i → %i', (die, value) => {
    expect(fixedHitDieValue(die)).toBe(value)
  })
})

describe('maxHitPoints', () => {
  it('level 1 = max hit die + Con mod', () => {
    expect(maxHitPoints(10, 1, 2)).toBe(12) // Fighter, Con 14
    expect(maxHitPoints(6, 1, 0)).toBe(6) // Wizard, Con 10
  })

  it('adds fixed value + Con mod per later level', () => {
    // Fighter 5, Con 14: 12 + 4 × (6 + 2) = 44
    expect(maxHitPoints(10, 5, 2)).toBe(44)
    // Barbarian 20, Con 20: 17 + 19 × (7 + 5) = 245
    expect(maxHitPoints(12, 20, 5)).toBe(245)
  })

  it('gives at least 1 HP per level with a big Con penalty', () => {
    // Wizard, Con 1 (−5): level 1 = max(1, 1) = 1, later levels = max(1, −1) = 1
    expect(maxHitPoints(6, 1, -5)).toBe(1)
    expect(maxHitPoints(6, 3, -5)).toBe(3)
    // Wizard, Con 5 (−3): level 1 = 3, later levels = max(1, 1) = 1 → level 3 = 5
    expect(maxHitPoints(6, 3, -3)).toBe(5)
  })

  it('rejects levels outside 1–20', () => {
    expect(() => maxHitPoints(8, 0, 0)).toThrow(RangeError)
  })

  it('rejects bad hit dice and Con modifiers (e.g. from imported JSON)', () => {
    expect(() => maxHitPoints(7 as 8, 1, 0)).toThrow(RangeError)
    expect(() => maxHitPoints(8, 1, 11)).toThrow(RangeError)
    expect(() => maxHitPoints(8, 1, 1.5)).toThrow(RangeError)
  })
})

describe('maxHitPointsFromRolls', () => {
  it('level 1 only = max hit die + Con mod', () => {
    expect(maxHitPointsFromRolls(10, 2, [])).toBe(12)
  })

  it('adds each roll + Con mod', () => {
    // Fighter 3, Con +2, rolled 5 and 9: 12 + 7 + 11 = 30
    expect(maxHitPointsFromRolls(10, 2, [5, 9])).toBe(30)
  })

  it('gives at least 1 HP per level', () => {
    // Wizard, Con −3, rolled 1 and 2: 3 + 1 + 1 = 5
    expect(maxHitPointsFromRolls(6, -3, [1, 2])).toBe(5)
  })

  it('rejects impossible rolls and too many levels', () => {
    expect(() => maxHitPointsFromRolls(8, 0, [9])).toThrow(RangeError)
    expect(() => maxHitPointsFromRolls(8, 0, [0])).toThrow(RangeError)
    expect(() => maxHitPointsFromRolls(8, 0, Array(20).fill(4))).toThrow(RangeError)
  })
})
