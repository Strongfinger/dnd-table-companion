import { describe, expect, it } from 'vitest'
import {
  canUseAdvantage, criticalDice, diceRange, formatDice, parseDice, rollDice, totalFromManualDice,
} from './diceExpr'

/** A fake random source that makes dice with `sides` show these faces in order. */
function faces(sides: number, ...values: number[]) {
  return dice(...values.map((v) => [sides, v] as [number, number]))
}

/** A fake random source for mixed dice: each [sides, face] pair is one roll, in order. */
function dice(...rolls: [number, number][]) {
  let i = 0
  return () => {
    const [sides, face] = rolls[i++]
    return (face - 1) / sides + 0.0001
  }
}

describe('parseDice', () => {
  it('reads common expressions', () => {
    expect(parseDice('2d6+3')).toEqual({ dice: [{ count: 2, sides: 6, sign: 1 }], modifier: 3 })
    expect(parseDice('d20')).toEqual({ dice: [{ count: 1, sides: 20, sign: 1 }], modifier: 0 })
    expect(parseDice(' 1D8 + 1d6 - 1 ')).toEqual({
      dice: [{ count: 1, sides: 8, sign: 1 }, { count: 1, sides: 6, sign: 1 }],
      modifier: -1,
    })
    expect(parseDice('5')).toEqual({ dice: [], modifier: 5 })
  })

  it('rejects nonsense and huge rolls', () => {
    for (const bad of ['', 'abc', '2d', 'd', '2d6+', '++3', '0d6', '2d1', '101d6', '1d1001', '2d6*2', '60d6+60d6']) {
      expect(parseDice(bad), bad).toBeNull()
    }
  })

  it('formats back', () => {
    expect(formatDice(parseDice('2d6+3')!)).toBe('2d6+3')
    expect(formatDice(parseDice('d20-1')!)).toBe('1d20-1')
    expect(formatDice(parseDice('1d8+1d6')!)).toBe('1d8+1d6')
    expect(formatDice(parseDice('4')!)).toBe('4')
  })
})

describe('rollDice', () => {
  it('sums dice and the modifier', () => {
    expect(rollDice(parseDice('2d6+3')!, 'normal', faces(6, 4, 5))).toEqual({ total: 12, rolls: [[4, 5]] })
  })

  it('subtracts negative dice terms', () => {
    // d8 shows 6, d4 shows 2: 6 − 2 = 4
    expect(rollDice(parseDice('1d8-1d4')!, 'normal', dice([8, 6], [4, 2])).total).toBe(4)
  })

  it('advantage keeps the higher d20, disadvantage the lower', () => {
    const e = parseDice('d20+5')!
    expect(rollDice(e, 'advantage', faces(20, 7, 15))).toEqual({ total: 20, rolls: [[7, 15]], kept: 15 })
    expect(rollDice(e, 'disadvantage', faces(20, 7, 15))).toEqual({ total: 12, rolls: [[7, 15]], kept: 7 })
  })

  it('ignores advantage for non-d20 rolls', () => {
    const r = rollDice(parseDice('2d6')!, 'advantage', faces(6, 1, 2))
    expect(r.rolls).toEqual([[1, 2]])
    expect(canUseAdvantage(parseDice('2d6')!)).toBe(false)
    expect(canUseAdvantage(parseDice('2d20')!)).toBe(false)
  })
})

describe('criticalDice', () => {
  it('doubles the dice, not the modifier', () => {
    expect(formatDice(criticalDice(parseDice('2d6+3')!))).toBe('4d6+3')
    expect(formatDice(criticalDice(parseDice('1d8+1d6+2')!))).toBe('2d8+2d6+2')
  })
})

describe('manual dice', () => {
  it('knows the possible range', () => {
    expect(diceRange(parseDice('2d6+3')!)).toEqual({ min: 2, max: 12 })
    expect(diceRange(parseDice('1d8-1d4')!)).toEqual({ min: -3, max: 7 })
  })

  it('adds the modifier to the typed dice sum, rejects impossible sums', () => {
    const e = parseDice('2d6+3')!
    expect(totalFromManualDice(e, 9)).toBe(12)
    expect(totalFromManualDice(e, 1)).toBeNull()
    expect(totalFromManualDice(e, 13)).toBeNull()
    expect(totalFromManualDice(e, 2.5)).toBeNull()
  })
})
