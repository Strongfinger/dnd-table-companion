import { describe, expect, it } from 'vitest'
import { pactMagic, slotsRechargeOnShortRest, spellSlotsFor } from './spellslots'

const slots = (row: number[]) => [...row, ...Array(9 - row.length).fill(0)]

describe('spellSlotsFor', () => {
  it('full casters follow the table', () => {
    expect(spellSlotsFor('Wizard', 1)).toEqual(slots([2]))
    expect(spellSlotsFor('Cleric', 3)).toEqual(slots([4, 2]))
    expect(spellSlotsFor('Bard', 5)).toEqual(slots([4, 3, 2]))
    expect(spellSlotsFor('Druid', 9)).toEqual(slots([4, 3, 3, 3, 1]))
    expect(spellSlotsFor('Sorcerer', 17)).toEqual([4, 3, 3, 3, 2, 1, 1, 1, 1])
    expect(spellSlotsFor('Wizard', 20)).toEqual([4, 3, 3, 3, 3, 2, 2, 1, 1])
  })

  it('PetchYom (Cleric 1) has 2 first-level slots, matching the sheet', () => {
    expect(spellSlotsFor('Cleric', 1)[0]).toBe(2)
  })

  it('2024 Paladins and Rangers have slots from level 1', () => {
    expect(spellSlotsFor('Paladin', 1)).toEqual(slots([2]))
    expect(spellSlotsFor('Ranger', 5)).toEqual(slots([4, 2]))
    expect(spellSlotsFor('Paladin', 9)).toEqual(slots([4, 3, 2]))
    expect(spellSlotsFor('Paladin', 20)).toEqual(slots([4, 3, 3, 3, 2]))
  })

  it('martial classes have none', () => {
    for (const c of ['Barbarian', 'Fighter', 'Monk', 'Rogue'] as const) expect(spellSlotsFor(c, 10)).toEqual(slots([]))
  })

  it('Warlock Pact Magic: all slots at one level', () => {
    expect(spellSlotsFor('Warlock', 1)).toEqual(slots([1]))
    expect(spellSlotsFor('Warlock', 2)).toEqual(slots([2]))
    expect(spellSlotsFor('Warlock', 3)).toEqual(slots([0, 2]))
    expect(spellSlotsFor('Warlock', 9)).toEqual(slots([0, 0, 0, 0, 2]))
    expect(spellSlotsFor('Warlock', 10)).toEqual(slots([0, 0, 0, 0, 2]))
    expect(spellSlotsFor('Warlock', 16)).toEqual(slots([0, 0, 0, 0, 3]))
    expect(spellSlotsFor('Warlock', 17)).toEqual(slots([0, 0, 0, 0, 4]))
    expect(spellSlotsFor('Warlock', 11)).toEqual(slots([0, 0, 0, 0, 3]))
    expect(spellSlotsFor('Warlock', 20)).toEqual(slots([0, 0, 0, 0, 4]))
  })

  it('pactMagic and recharge', () => {
    expect(pactMagic(7)).toEqual({ slots: 2, slotLevel: 4 })
    expect(slotsRechargeOnShortRest('Warlock')).toBe(true)
    expect(slotsRechargeOnShortRest('Wizard')).toBe(false)
  })
})
