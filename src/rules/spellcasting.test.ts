import { describe, expect, it } from 'vitest'
import { spellAttackBonus, spellSaveDC } from './spellcasting'

describe('spellcasting', () => {
  it('level 1 Wizard with Int 16 (+3): DC 13, attack +5', () => {
    expect(spellSaveDC(2, 3)).toBe(13)
    expect(spellAttackBonus(2, 3)).toBe(5)
  })

  it('level 17 Cleric with Wis 20 (+5): DC 19, attack +11', () => {
    expect(spellSaveDC(6, 5)).toBe(19)
    expect(spellAttackBonus(6, 5)).toBe(11)
  })

  it('works with a negative casting modifier', () => {
    expect(spellSaveDC(2, -1)).toBe(9)
    expect(spellAttackBonus(2, -1)).toBe(1)
  })
})
