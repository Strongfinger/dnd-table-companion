import { describe, expect, it } from 'vitest'
import {
  addDie, addModifier, canBeCritical, canUseAdvantage, criticalDice, diceRange, formatDice, naturalD20, naturalFromManual, parseDice, resolveRollMode, rollDice,
  totalFromManualDice,
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

describe('dice roller helpers', () => {
  it('advantage and disadvantage cancel', () => {
    expect(resolveRollMode(true, false)).toBe('advantage')
    expect(resolveRollMode(false, true)).toBe('disadvantage')
    expect(resolveRollMode(true, true)).toBe('normal')
    expect(resolveRollMode(false, false)).toBe('normal')
  })

  it('quick dice buttons build the expression', () => {
    expect(addDie('', 20)).toBe('1d20')
    expect(addDie('1d6', 6)).toBe('2d6')
    expect(addDie('2d6+3', 8)).toBe('2d6+1d8+3')
    expect(addDie('nonsense', 4)).toBe('1d4')
  })

  it('modifier buttons', () => {
    expect(addModifier('1d20', 1)).toBe('1d20+1')
    expect(addModifier('1d20+1', -2)).toBe('1d20-1')
    expect(addModifier('', 2)).toBe('2')
  })

  it('spots natural 20s and 1s on a single d20', () => {
    const d20 = parseDice('d20+5')!
    expect(naturalD20(d20, { total: 25, rolls: [[20]] })).toBe(20)
    expect(naturalD20(d20, { total: 6, rolls: [[3, 1]], kept: 1 })).toBe(1)
    expect(naturalD20(d20, { total: 15, rolls: [[10]] })).toBeNull()
    expect(naturalD20(parseDice('2d20')!, { total: 40, rolls: [[20, 20]] })).toBeNull()
  })
})

describe('dice roller edge cases', () => {
  it('addDie: cap at 100, negative terms stay separate', () => {
    expect(addDie('100d6', 6)).toBe('100d6')
    expect(addDie('1d6-1d6', 6)).toBe('2d6-1d6')
  })

  it('addModifier back to zero and from empty', () => {
    expect(addModifier('1d20+1', -1)).toBe('1d20')
    expect(addModifier('', -1)).toBe('-1')
  })

  it('naturalD20 with a disadvantage kept 20', () => {
    expect(naturalD20(parseDice('d20')!, { total: 20, rolls: [[20, 20]], kept: 20 })).toBe(20)
  })

  it('naturalFromManual only for a single d20', () => {
    expect(naturalFromManual(parseDice('d20+5')!, 20)).toBe(20)
    expect(naturalFromManual(parseDice('d20+5')!, 1)).toBe(1)
    expect(naturalFromManual(parseDice('d20+5')!, 12)).toBeNull()
    expect(naturalFromManual(parseDice('2d10')!, 20)).toBeNull()
  })

  it('Critical only for damage dice, never a single d20', () => {
    expect(canBeCritical(parseDice('2d6+3')!)).toBe(true)
    expect(canBeCritical(parseDice('d20+5')!)).toBe(false)
    expect(canBeCritical(parseDice('5')!)).toBe(false)
  })
})
