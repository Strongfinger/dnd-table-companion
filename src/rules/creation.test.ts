import { describe, expect, it } from 'vitest'
import { applyBonus, checkBackgroundBonus, pointBuyCost, pointBuyTotal, POINT_BUY_START, suggestedMaxHp } from './creation'
import { petchyom } from './fixtures/characters'

describe('Point Buy', () => {
  it.each([[8, 0], [9, 1], [10, 2], [11, 3], [12, 4], [13, 5], [14, 7], [15, 9]])('score %i costs %i', (score, cost) => {
    expect(pointBuyCost(score)).toBe(cost)
  })

  it('rejects scores outside 8–15', () => {
    expect(() => pointBuyCost(7)).toThrow(RangeError)
    expect(() => pointBuyCost(16)).toThrow(RangeError)
  })

  it('the standard array 15,14,13,12,10,8 costs exactly 27', () => {
    expect(pointBuyTotal({ str: 15, dex: 14, con: 13, int: 12, wis: 10, cha: 8 })).toBe(27)
    expect(pointBuyTotal(POINT_BUY_START)).toBe(0)
  })
})

describe('background ability bonus', () => {
  const soldier = ['str', 'dex', 'con'] as const

  it('allows +2/+1 and +1/+1/+1 on the background abilities', () => {
    expect(checkBackgroundBonus({ str: 2, con: 1 }, soldier)).toBeNull()
    expect(checkBackgroundBonus({ str: 1, dex: 1, con: 1 }, soldier)).toBeNull()
  })

  it('rejects other shapes and other abilities', () => {
    expect(checkBackgroundBonus({ str: 2 }, soldier)).not.toBeNull()
    expect(checkBackgroundBonus({ str: 2, dex: 2 }, soldier)).not.toBeNull()
    expect(checkBackgroundBonus({ str: 1, dex: 1 }, soldier)).not.toBeNull()
    expect(checkBackgroundBonus({ str: 2, cha: 1 }, soldier)).not.toBeNull()
    expect(checkBackgroundBonus({}, soldier)).not.toBeNull()
  })

  it('applies the bonus and caps at 20', () => {
    const base = { str: 15, dex: 14, con: 13, int: 12, wis: 10, cha: 8 }
    expect(applyBonus(base, { str: 2, con: 1 })).toEqual({ ...base, str: 17, con: 14 })
    expect(applyBonus({ ...base, str: 20 }, { str: 2 }).str).toBe(20)
  })
})

describe('suggestedMaxHp', () => {
  it('adds Dwarven Toughness: PetchYom (Dwarf Cleric 1, Con 15) = 11', () => {
    expect(suggestedMaxHp(petchyom)).toBe(11)
  })

  it('no species bonus for other or homebrew species', () => {
    expect(suggestedMaxHp({ ...petchyom, species: 'Human' })).toBe(10)
    expect(suggestedMaxHp({ ...petchyom, species: 'Hill Dwarf (2014)' })).toBe(10)
  })
})
