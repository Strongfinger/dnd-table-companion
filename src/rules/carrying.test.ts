import { describe, expect, it } from 'vitest'
import { carryingCapacity, coinWeight, dragLiftPushLimit, loadState } from './carrying'

describe('carrying capacity (SRD 5.2.1)', () => {
  it('is Strength × 15 lb for Small and Medium characters', () => {
    expect(carryingCapacity(10)).toBe(150)
    expect(carryingCapacity(15, 'Medium')).toBe(225)
    expect(carryingCapacity(8, 'Small')).toBe(120)
  })

  it('follows the size table', () => {
    expect(carryingCapacity(10, 'Tiny')).toBe(75)
    expect(carryingCapacity(10, 'Large')).toBe(300)
    expect(carryingCapacity(10, 'Huge')).toBe(600)
    expect(carryingCapacity(10, 'Gargantuan')).toBe(1200)
  })

  it('counts one size larger with Powerful Build (Goliath)', () => {
    expect(carryingCapacity(16, 'Medium', true)).toBe(480)
    expect(carryingCapacity(10, 'Gargantuan', true)).toBe(1200)
  })

  it('lets a character drag, lift or push twice that', () => {
    expect(dragLiftPushLimit(carryingCapacity(10))).toBe(300)
  })

  it('weighs 50 coins of any kind as 1 lb', () => {
    expect(coinWeight({ cp: 20, sp: 10, ep: 0, gp: 15, pp: 5 })).toBe(1)
    expect(coinWeight({ cp: 0, sp: 0, ep: 0, gp: 0, pp: 0 })).toBe(0)
  })

  it('tells within capacity, over it, and too heavy to move', () => {
    expect(loadState(150, 150)).toBe('ok')
    expect(loadState(151, 150)).toBe('over')
    expect(loadState(300, 150)).toBe('over')
    expect(loadState(301, 150)).toBe('tooHeavy')
  })
})
