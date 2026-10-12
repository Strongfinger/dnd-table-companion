import { describe, expect, it } from 'vitest'
import { parseRollEvent, rollEventText } from './rollEvent'

const ok = { type: 'roll', by: 'Boom', expression: '1d20+5', mode: 'advantage', critical: false, total: 23, faces: [[18, 5]], natural: null }

describe('shared dice rolls', () => {
  it('accepts a valid roll and makes a log line', () => {
    const r = parseRollEvent({ ...ok, extra: 'dropped' })!
    expect(r).toEqual(ok)
    expect(rollEventText(r)).toBe('🎲 Boom: 1d20+5 (Advantage) = 23')
    expect(rollEventText({ ...r, faces: null, natural: 20, mode: 'normal' })).toBe('🎲 Boom: 1d20+5 (ทอยเอง) = 23 · Nat 20!')
    expect(rollEventText({ ...r, mode: 'normal', label: 'Rapier · โจมตี' })).toBe('🎲 Boom · Rapier · โจมตี: 1d20+5 = 23')
  })

  it('a natural 20 must match a d20 face (or be typed in)', () => {
    expect(parseRollEvent({ ...ok, natural: 20, faces: [[20, 5]] })).not.toBeNull()
    expect(parseRollEvent({ ...ok, natural: 20, faces: null })).not.toBeNull()
  })

  it('rejects malformed rolls', () => {
    const bad = [null, {}, { ...ok, type: 'chat' }, { ...ok, mode: 'super' }, { ...ok, total: 1.5 }, { ...ok, natural: 19 },
      { ...ok, faces: [[0]] }, { ...ok, faces: 'lots' }, { ...ok, by: 'x'.repeat(61) },
      { ...ok, expression: 'rm -rf' }, { ...ok, natural: 20 }, { ...ok, expression: '2d6', natural: 1, faces: [[1, 3]] }]
    for (const v of bad) expect(parseRollEvent(v), JSON.stringify(v)).toBeNull()
  })
})
