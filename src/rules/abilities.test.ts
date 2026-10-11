import { describe, expect, it } from 'vitest'
import { abilityModifier, formatModifier } from './abilities'

describe('abilityModifier', () => {
  it.each([
    [1, -5], [2, -4], [3, -4], [8, -1], [9, -1], [10, 0], [11, 0],
    [12, 1], [15, 2], [18, 4], [20, 5], [30, 10],
  ])('score %i → %i', (score, mod) => {
    expect(abilityModifier(score)).toBe(mod)
  })

  it('rejects scores outside 1–30 and non-integers', () => {
    expect(() => abilityModifier(0)).toThrow(RangeError)
    expect(() => abilityModifier(31)).toThrow(RangeError)
    expect(() => abilityModifier(10.5)).toThrow(RangeError)
  })
})

describe('formatModifier', () => {
  it('adds a + sign to zero and positives', () => {
    expect(formatModifier(3)).toBe('+3')
    expect(formatModifier(0)).toBe('+0')
    expect(formatModifier(10)).toBe('+10')
    expect(formatModifier(-1)).toBe('-1')
  })
})
