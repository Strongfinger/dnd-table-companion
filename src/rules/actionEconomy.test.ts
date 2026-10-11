import { describe, expect, it } from 'vitest'
import { FRESH_TURN, startOfTurn, toggleAction } from './actionEconomy'

describe('action economy', () => {
  it('marks an action used and back', () => {
    const used = toggleAction(FRESH_TURN, 'bonusAction')
    expect(used).toEqual({ action: false, bonusAction: true, reaction: false })
    expect(toggleAction(used, 'bonusAction')).toEqual(FRESH_TURN)
  })

  it('everything comes back at the start of the turn, Reaction included', () => {
    expect(startOfTurn()).toEqual({ action: false, bonusAction: false, reaction: false })
  })
})

describe('action economy does not share or change objects', () => {
  it('toggleAction leaves its input and the other actions alone', () => {
    const before = { ...FRESH_TURN }
    const after = toggleAction(before, 'reaction')
    expect(before).toEqual(FRESH_TURN)
    expect(after).toEqual({ action: false, bonusAction: false, reaction: true })
    expect(toggleAction(FRESH_TURN, 'action')).toEqual({ action: true, bonusAction: false, reaction: false })
  })

  it('startOfTurn returns a new object each time', () => {
    expect(startOfTurn()).not.toBe(FRESH_TURN)
    expect(startOfTurn()).not.toBe(startOfTurn())
  })
})
