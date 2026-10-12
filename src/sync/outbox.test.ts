import { describe, expect, it } from 'vitest'
import { makeEnvelope } from './envelope'
import { dueForResend, MAX_TRIES, outboxFor, parseAck, removeAcked, resendRound, type OutboxItem } from './outbox'

const item = (sentAt: number, tries = 1): OutboxItem => ({ envelope: makeEnvelope('action', {}, { id: 'p1', name: 'P' }), sentAt, tries })

describe('outbox', () => {
  it('resends only items waiting long enough', () => {
    const items = [item(0), item(3000), item(5000)]
    expect(dueForResend(items, 7000)).toEqual([items[0], items[1]])
  })

  it('a retry round resends due items, counts tries and gives up after the limit', () => {
    const fresh = item(6000)
    const due = item(0, 3)
    const tooMany = item(0, MAX_TRIES)
    const r = resendRound([fresh, due, tooMany], 7000)
    expect(r.send.map((i) => i.envelope.id)).toEqual([due.envelope.id])
    expect(r.items).toEqual([fresh, { ...due, sentAt: 7000, tries: 4 }])
    expect(r.dropped).toBe(1)
  })

  it('drops confirmed items', () => {
    const items = [item(0), item(1)]
    expect(removeAcked(items, [items[0].envelope.id, 'other'])).toEqual([items[1]])
  })

  it('loads a saved outbox only for the same room', () => {
    const items = [item(0)]
    expect(outboxFor({ code: 'K7QX4M', items }, 'K7QX4M')).toEqual(items)
    expect(outboxFor({ code: 'AAAAAA', items }, 'K7QX4M')).toEqual([])
    expect(outboxFor(null, 'K7QX4M')).toEqual([])
  })

  it('reads acks', () => {
    expect(parseAck({ ids: ['a', 'b'] })).toEqual(['a', 'b'])
    expect(parseAck({ ids: [1] })).toBeNull()
    expect(parseAck('a')).toBeNull()
  })
})
