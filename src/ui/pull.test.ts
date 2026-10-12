import { describe, expect, it } from 'vitest'
import { PULL_TRIGGER, pullAmount } from './pull'

describe('pullAmount', () => {
  it('follows the finger at half speed, never up, capped', () => {
    expect(pullAmount(-30)).toBe(0)
    expect(pullAmount(100)).toBe(50)
    expect(pullAmount(1000)).toBe(110)
  })
  it('a deliberate pull (about 140 px) reaches the trigger; a small scroll bounce does not', () => {
    expect(pullAmount(140)).toBeGreaterThanOrEqual(PULL_TRIGGER)
    expect(pullAmount(60)).toBeLessThan(PULL_TRIGGER)
  })
})
