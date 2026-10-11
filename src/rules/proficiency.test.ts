import { describe, expect, it } from 'vitest'
import { proficiencyBonus, proficiencyContribution } from './proficiency'

describe('proficiencyBonus', () => {
  it.each([
    [1, 2], [4, 2], [5, 3], [8, 3], [9, 4], [12, 4], [13, 5], [16, 5], [17, 6], [20, 6],
  ])('level %i → +%i', (level, bonus) => {
    expect(proficiencyBonus(level)).toBe(bonus)
  })

  it('rejects levels outside 1–20', () => {
    expect(() => proficiencyBonus(0)).toThrow(RangeError)
    expect(() => proficiencyBonus(21)).toThrow(RangeError)
  })
})

describe('proficiencyContribution', () => {
  it('is 0, ×1 or ×2', () => {
    expect(proficiencyContribution('none', 3)).toBe(0)
    expect(proficiencyContribution('proficient', 3)).toBe(3)
    expect(proficiencyContribution('expertise', 3)).toBe(6)
  })
})
