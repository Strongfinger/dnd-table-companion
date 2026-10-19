import { describe, expect, it } from 'vitest'
import { gainCoins, spendCoins, totalCopper, type Coins } from './coins'

const purse = (c: Partial<Coins>): Coins => ({ cp: 0, sp: 0, ep: 0, gp: 0, pp: 0, ...c })

describe('coins', () => {
  it('counts the purse in copper (1 PP = 10 GP = 20 EP = 100 SP = 1000 CP)', () => {
    expect(totalCopper(purse({ pp: 1 }))).toBe(1000)
    expect(totalCopper(purse({ gp: 1, ep: 1, sp: 1, cp: 1 }))).toBe(161)
  })

  it('gains whole coins only, up to the cap', () => {
    expect(gainCoins(purse({ gp: 3 }), 'gp', 12)).toEqual(purse({ gp: 15 }))
    expect(gainCoins(purse({}), 'sp', -5)).toEqual(purse({}))
    expect(gainCoins(purse({ cp: 9_999_990 }), 'cp', 50).cp).toBe(9_999_999)
  })

  it('pays with the same coin when there are enough', () => {
    expect(spendCoins(purse({ gp: 10, sp: 4 }), 'gp', 3)).toEqual(purse({ gp: 7, sp: 4 }))
  })

  it('refuses when the whole purse is worth less', () => {
    expect(spendCoins(purse({ gp: 1, sp: 9 }), 'gp', 2)).toBeNull()
  })

  it('uses smaller coins next, biggest first', () => {
    expect(spendCoins(purse({ gp: 2, sp: 25, cp: 30 }), 'gp', 4)).toEqual(purse({ cp: 30, sp: 5 }))
    expect(spendCoins(purse({ gp: 0, sp: 9, cp: 30 }), 'gp', 1)).toEqual(purse({ cp: 20 }))
  })

  it('breaks a bigger coin and gives change, biggest coins first', () => {
    expect(spendCoins(purse({ gp: 1 }), 'sp', 5)).toEqual(purse({ sp: 5 }))
    expect(spendCoins(purse({ pp: 1 }), 'gp', 3)).toEqual(purse({ gp: 7 }))
    expect(spendCoins(purse({ gp: 1 }), 'cp', 1)).toEqual(purse({ sp: 9, cp: 9 }))
  })

  it('gives change without EP unless paying in EP', () => {
    // 10 CP paid, 90 CP still owed: break the PP, 910 CP of change = 9 GP + 1 SP.
    expect(spendCoins(purse({ cp: 10, pp: 1 }), 'gp', 1)).toEqual(purse({ gp: 9, sp: 1 }))
    expect(spendCoins(purse({ pp: 1 }), 'ep', 1)).toEqual(purse({ gp: 9, ep: 1 }))
    expect(spendCoins(purse({ sp: 3, pp: 1 }), 'gp', 1)).toEqual(purse({ gp: 9, sp: 3 }))
  })

  it('never leaves a negative coin and keeps the value right', () => {
    const before = purse({ cp: 7, sp: 3, ep: 1, gp: 2, pp: 1 })
    for (const [coin, n] of [['cp', 500], ['sp', 37], ['ep', 5], ['gp', 9], ['pp', 1]] as const) {
      const after = spendCoins(before, coin, n)!
      expect(Object.values(after).every((x) => x >= 0)).toBe(true)
      expect(totalCopper(after)).toBe(totalCopper(before) - n * { cp: 1, sp: 10, ep: 50, gp: 100, pp: 1000 }[coin])
    }
  })

  it('ignores amounts that are not numbers', () => {
    expect(gainCoins(purse({ gp: 1 }), 'gp', NaN)).toEqual(purse({ gp: 1 }))
    expect(spendCoins(purse({ gp: 1 }), 'gp', NaN)).toBeNull()
    expect(spendCoins(purse({ gp: 1 }), 'gp', Infinity)).toBeNull()
  })
})
