import { describe, expect, it } from 'vitest'
import { attackBonus, initiativeBonus } from './combat'

describe('initiativeBonus', () => {
  it('is the Dex modifier by default', () => {
    expect(initiativeBonus(2)).toBe(2)
    expect(initiativeBonus(-1)).toBe(-1)
  })

  it('adds other bonuses such as Alert (+5)', () => {
    expect(initiativeBonus(1, 5)).toBe(6)
    expect(initiativeBonus(2, -5)).toBe(-3)
  })
})

describe('attackBonus', () => {
  it('adds proficiency only when proficient', () => {
    expect(attackBonus(3, 2, true)).toBe(5)
    expect(attackBonus(3, 2, false)).toBe(3)
    expect(attackBonus(-1, 2, true)).toBe(1)
  })
})
