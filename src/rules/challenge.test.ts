import { describe, expect, it } from 'vitest'
import { xpForCR, xpMatchesCR } from './challenge'

describe('xpForCR', () => {
  it('follows the table', () => {
    expect([0.125, 0.25, 0.5, 1, 2, 5, 10, 12, 14, 21, 30].map(xpForCR)).toEqual([25, 50, 100, 200, 450, 1800, 5900, 8400, 11500, 33000, 155000])
  })

  it('CR 0 is 0 or 10', () => {
    expect(xpMatchesCR(0, 0)).toBe(true)
    expect(xpMatchesCR(0, 10)).toBe(true)
    expect(xpMatchesCR(0, 25)).toBe(false)
  })

  it('rejects a non-CR', () => {
    expect(() => xpForCR(0.3)).toThrow(RangeError)
    expect(xpMatchesCR(12, 8000)).toBe(false)
  })
})
