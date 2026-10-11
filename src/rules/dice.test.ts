import { describe, expect, it } from 'vitest'
import { parseManualRoll } from './dice'

describe('parseManualRoll', () => {
  it('accepts whole numbers on the die', () => {
    expect(parseManualRoll('1', 20)).toBe(1)
    expect(parseManualRoll(' 20 ', 20)).toBe(20)
    expect(parseManualRoll('8', 8)).toBe(8)
  })

  it('rejects anything a die could not show', () => {
    expect(parseManualRoll('0', 20)).toBeNull()
    expect(parseManualRoll('21', 20)).toBeNull()
    expect(parseManualRoll('9', 8)).toBeNull()
    expect(parseManualRoll('2.5', 20)).toBeNull()
    expect(parseManualRoll('', 20)).toBeNull()
    expect(parseManualRoll('abc', 20)).toBeNull()
  })
})
