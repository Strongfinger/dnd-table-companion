import { describe, expect, it } from 'vitest'
import { DATA_VERSION } from '../model/sync'
import { Deduper, makeEnvelope, MAX_MESSAGE_BYTES, parseEnvelope, RateLimiter } from './envelope'
import { isValidRoomCode, newRoomCode, normalizeRoomCode, ROOM_CODE_LENGTH } from './roomCode'

describe('room codes', () => {
  it('are 6 characters without look-alikes', () => {
    for (let i = 0; i < 200; i++) {
      const code = newRoomCode()
      expect(code).toHaveLength(ROOM_CODE_LENGTH)
      expect(code).not.toMatch(/[01OIL]/)
      expect(isValidRoomCode(code)).toBe(true)
    }
  })

  it('typed codes are cleaned; wrong ones are rejected', () => {
    expect(normalizeRoomCode(' k7q-x4m ')).toBe('K7QX4M')
    expect(isValidRoomCode('K7QX4M')).toBe(true)
    expect(isValidRoomCode('K7QX4')).toBe(false)
    expect(isValidRoomCode('K7QX4O')).toBe(false) // O is never used
  })
})

describe('envelope', () => {
  const me = { id: 'dm-laptop', name: 'DM' }

  it('round-trips through JSON', () => {
    const e = makeEnvelope('roll', { total: 17 }, me, 5)
    const r = parseEnvelope(JSON.stringify(e))
    expect(r).toEqual({ ok: true, envelope: e })
  })

  it('the connection decides who sent it, not the message', () => {
    const forged = { ...makeEnvelope('action', {}, { id: 'boom-phone', name: 'Boom' }), from: 'dm-laptop', fromName: 'DM' }
    const r = parseEnvelope(forged, { id: 'boom-phone', name: 'Boom' })
    expect(r.ok && r.envelope.from).toBe('boom-phone')
  })

  it('rejects garbage, other versions and huge messages', () => {
    expect(parseEnvelope('not json')).toEqual({ ok: false, reason: 'invalid' })
    expect(parseEnvelope({ ...makeEnvelope('ping', null, me), v: DATA_VERSION + 1 })).toEqual({ ok: false, reason: 'version' })
    expect(parseEnvelope({ ...makeEnvelope('ping', null, me), kind: 'hack' })).toEqual({ ok: false, reason: 'invalid' })
    expect(parseEnvelope({ ...makeEnvelope('ping', null, me), id: '<x>' })).toEqual({ ok: false, reason: 'invalid' })
    expect(parseEnvelope(makeEnvelope('state', 'x'.repeat(MAX_MESSAGE_BYTES), me))).toEqual({ ok: false, reason: 'too-big' })
  })

  it('Deduper drops repeats and forgets very old ids', () => {
    const d = new Deduper(2)
    expect(d.firstTime('a')).toBe(true)
    expect(d.firstTime('a')).toBe(false)
    d.firstTime('b')
    d.firstTime('c') // 'a' is forgotten now
    expect(d.firstTime('a')).toBe(true)
  })
})

describe('RateLimiter', () => {
  it('allows up to the limit per sender in the window, then recovers', () => {
    const limit = new RateLimiter(3, 1000)
    expect([0, 10, 20, 30].map((t) => limit.allow('a', t))).toEqual([true, true, true, false])
    expect(limit.allow('b', 30)).toBe(true) // other senders are counted separately
    expect(limit.allow('a', 1005)).toBe(true) // the first message left the window
  })
})
