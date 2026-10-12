import { describe, expect, it } from 'vitest'
import { createEncounter } from '../model/encounter'
import { fightsForPlayers, mergeLog, parseFights, parseLogBody } from './fights'

const fight = (id: string, status: 'setup' | 'active' | 'ended', updatedAt: number, campaignId: string | null = 'camp') =>
  ({ ...createEncounter(id, campaignId), id, status, updatedAt, round: 2 })

describe('fightsForPlayers', () => {
  it('lists started fights of the campaign, newest first', () => {
    const list = [fight('a', 'ended', 1), fight('b', 'active', 5), fight('c', 'setup', 9), fight('d', 'active', 7, 'other')]
    expect(fightsForPlayers(list, 'camp').map((f) => f.id)).toEqual(['b', 'a'])
    expect(fightsForPlayers(list, null).map((f) => f.id)).toEqual(['d', 'b', 'a'])
    // The running fight players see is listed even when filed under another campaign.
    expect(fightsForPlayers([fight('x', 'active', 3, 'other'), fight('a', 'ended', 1)], 'camp').map((f) => f.id)).toEqual(['x', 'a'])
  })
})

describe('parsing', () => {
  it('accepts a real list and log, rejects junk', () => {
    const fights = fightsForPlayers([fight('a', 'active', 1)], 'camp')
    expect(parseFights(JSON.parse(JSON.stringify({ fights })))).toEqual(fights)
    expect(parseFights({ fights: [{ ...fights[0], status: 'setup' }] })).toBeNull()
    const entries = [{ id: 'l1', at: 5, round: 1, text: 'ตาของ Boom' }]
    expect(parseLogBody({ encounterId: 'a', entries })).toEqual({ encounterId: 'a', entries })
    expect(parseLogBody({ encounterId: 'a', entries: [{ id: 'l1', text: 'x' }] })).toBeNull()
  })
})

describe('mergeLog', () => {
  it('adds new lines once, in time order', () => {
    const a = { id: 'a', at: 2, round: 1, text: 'A' }
    const b = { id: 'b', at: 1, round: 1, text: 'B' }
    expect(mergeLog([a], [b, a])).toEqual([b, a])
  })
})
