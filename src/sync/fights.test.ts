import { describe, expect, it } from 'vitest'
import { createEncounter } from '../model/encounter'
import { applyLogMessage, fightsForPlayers, fullLog, logDiff, mergeLog, parseFights, parseLogBody } from './fights'

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
    expect(parseLogBody({ encounterId: 'a', entries })).toEqual({ target: { kind: 'fight', id: 'a' }, entries, removed: [], from: null })
    expect(parseLogBody({ characterId: 'c1', entries: [], removed: ['l9'], from: 0 })).toEqual({ target: { kind: 'character', id: 'c1' }, entries: [], removed: ['l9'], from: 0 })
    expect(parseLogBody({ encounterId: 'a', entries: [{ id: 'l1', text: 'x' }] })).toBeNull()
    expect(parseLogBody({ entries })).toBeNull()
  })
})

describe('mergeLog', () => {
  it('adds new lines once, in time order', () => {
    const a = { id: 'a', at: 2, round: 1, text: 'A' }
    const b = { id: 'b', at: 1, round: 1, text: 'B' }
    expect(mergeLog([a], [b, a])).toEqual([b, a])
  })
})

const line = (id: string, at: number) => ({ id, at, round: 1, text: id })

describe('logDiff', () => {
  it('finds new and deleted lines', () => {
    const sent = new Map([['a', 1], ['b', 2]])
    expect(logDiff(sent, [line('a', 1), line('c', 3)])).toEqual({ added: [line('c', 3)], removed: ['b'] })
  })

  it('a line that only fell out of the newest window is not deleted', () => {
    const sent = new Map([['a', 1], ['b', 2], ['c', 3]])
    expect(logDiff(sent, [line('b', 2), line('c', 3)], 2)).toEqual({ added: [], removed: [] })
  })
})

describe('fullLog / applyLogMessage', () => {
  it('keeps the newest lines that fit, and says from when', () => {
    const all = [line('a', 1), line('b', 2), line('c', 3)]
    expect(fullLog(all)).toEqual({ entries: all, from: 0 })
    const one = JSON.stringify(line('c', 3)).length + 1
    expect(fullLog(all, one)).toEqual({ entries: [line('c', 3)], from: 3 })
  })

  it('applies new lines, deletions and full copies', () => {
    const old = [line('a', 1), line('b', 2), line('c', 3)]
    expect(applyLogMessage(old, { entries: [line('d', 4)], removed: ['b'], from: null }).map((e) => e.id)).toEqual(['a', 'c', 'd'])
    // A full copy from time 2 on: 'a' (older) stays, 'b' and 'c' are replaced by what was sent.
    expect(applyLogMessage(old, { entries: [line('c', 3)], removed: [], from: 2 }).map((e) => e.id)).toEqual(['a', 'c'])
  })
})
