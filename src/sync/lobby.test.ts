import { describe, expect, it } from 'vitest'
import { isDm, joinLink, parseKick, parseLobbySession, visibleMembers } from './lobby'
import type { Member } from './transport'

const member = (deviceId: string, name: string, role: Member['role'], online = true): Member =>
  ({ deviceId, name, role, characterId: null, characterName: null, online })

describe('parseLobbySession', () => {
  it('accepts a saved session and fills missing fields', () => {
    expect(parseLobbySession({ code: 'K7QX4M', role: 'player', characterId: 'c1' })).toEqual({
      code: 'K7QX4M', role: 'player', campaignId: null, characterId: 'c1', characterName: null, local: false, kicked: [],
    })
  })

  it('rejects bad codes, roles and junk', () => {
    expect(parseLobbySession(null)).toBeNull()
    expect(parseLobbySession('K7QX4M')).toBeNull()
    expect(parseLobbySession({ code: 'K0QX4M', role: 'dm' })).toBeNull()
    expect(parseLobbySession({ code: 'K7QX4M', role: 'boss' })).toBeNull()
  })

  it('keeps only usable kicked ids', () => {
    const kicked = [{ deviceId: 'a', name: 'เอ' }, { deviceId: 'b' }, 'c', null, { deviceId: 'x'.repeat(65) }]
    expect(parseLobbySession({ code: 'K7QX4M', role: 'dm', kicked })?.kicked).toEqual([{ deviceId: 'a', name: 'เอ' }, { deviceId: 'b', name: '' }])
  })
})

describe('joinLink', () => {
  it('builds a hash link with the code', () => {
    expect(joinLink('https://dnd-table-companion.vercel.app/', 'K7QX4M')).toBe('https://dnd-table-companion.vercel.app/#/lobby/K7QX4M')
  })
})

describe('parseKick', () => {
  it('reads the device id', () => {
    expect(parseKick({ deviceId: 'p1' })).toEqual({ deviceId: 'p1' })
    expect(parseKick({ deviceId: '' })).toBeNull()
    expect(parseKick('p1')).toBeNull()
  })
})

describe('members', () => {
  const list = [member('p2', 'บี', 'player', false), member('p1', 'เอ', 'player'), member('dm', 'DM', 'dm'), member('p3', 'ซี', 'player')]

  it('finds the DM', () => {
    expect(isDm(list, 'dm')).toBe(true)
    expect(isDm(list, 'p1')).toBe(false)
  })

  it('sorts DM, online, offline and hides kicked devices', () => {
    expect(visibleMembers(list, [{ deviceId: 'p3', name: 'ซี' }]).map((m) => m.deviceId)).toEqual(['dm', 'p1', 'p2'])
  })

  it('shows a device listed twice once, preferring the online entry', () => {
    const twice = [member('p1', 'old', 'player', false), member('p1', 'new', 'player', true), member('p1', 'older', 'player', false)]
    expect(visibleMembers(twice, [])).toEqual([member('p1', 'new', 'player', true)])
  })
})
