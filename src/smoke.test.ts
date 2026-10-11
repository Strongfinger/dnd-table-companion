// Smoke test: proves Vitest is wired up. Real rules tests live next to src/rules/ (Phase 1).
import { describe, expect, it } from 'vitest'

describe('test setup', () => {
  it('runs', () => {
    expect(Math.floor(-1 / 2)).toBe(-1)
  })
})
