import { describe, expect, it } from 'vitest'
import { addKicked, addRecentHosted, roomForCode, isDm, joinLink, lastHostedRoom, MAX_RECENT_HOSTED, recentHostedRooms, parseKick, parseLobbySession, rollerName, visibleMembers } from './lobby'
import type { Member } from './transport'

const member = (deviceId: string, name: string, role: Member['role'], online = true): Member =>
  ({ deviceId, name, role, characterId: null, characterName: null, online })

describe('parseLobbySession', () => {
  it('accepts a saved session and fills missing fields', () => {
    expect(parseLobbySession({ code: 'K7QX4M', role: 'player', characterId: 'c1' })).toEqual({
      code: 'K7QX4M', role: 'player', campaignId: null, characterId: 'c1', characterName: null, local: false, kicked: [], shortRestSince: null, grants: [],
    })
  })

  it('keeps the DM\'s handed-over characters, drops broken ones', () => {
    const s = parseLobbySession({ code: 'K7QX4M', role: 'dm', grants: [{ characterId: 'gob', deviceId: 'p1' }, { characterId: 5 }] })
    expect(s?.grants).toEqual([{ characterId: 'gob', deviceId: 'p1' }])
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

  it("on a player's phone, hides a kicked device only while it is offline", () => {
    const withKicked = [...list, member('p9', 'โดนเตะ', 'player', false)]
    const kicked = [{ deviceId: 'p9', name: 'โดนเตะ' }]
    expect(visibleMembers(withKicked, kicked, 'player').some((m) => m.deviceId === 'p9')).toBe(false)
    // Let back in by the DM (players aren't told) and online again: shown.
    const back = [...list, member('p9', 'โดนเตะ', 'player', true)]
    expect(visibleMembers(back, kicked, 'player').some((m) => m.deviceId === 'p9')).toBe(true)
    // The DM's device always hides it.
    expect(visibleMembers(back, kicked).some((m) => m.deviceId === 'p9')).toBe(false)
  })

  it('shows a device listed twice once, preferring the online entry', () => {
    const twice = [member('p1', 'old', 'player', false), member('p1', 'new', 'player', true), member('p1', 'older', 'player', false)]
    expect(visibleMembers(twice, [])).toEqual([member('p1', 'new', 'player', true)])
  })
})

describe('addKicked', () => {
  it('adds a device once', () => {
    const one = addKicked([], 'p1', 'มุก')
    expect(one).toEqual([{ deviceId: 'p1', name: 'มุก' }])
    expect(addKicked(one, 'p1', 'อื่น')).toBe(one)
  })

  it('keeps the newest 50', () => {
    let kicked: ReturnType<typeof addKicked> = []
    for (let i = 0; i < 60; i++) kicked = addKicked(kicked, `d${i}`, '')
    expect(kicked).toHaveLength(50)
    expect(kicked[0].deviceId).toBe('d10')
  })
})

describe('rollerName', () => {
  const list = [member('dm', 'ต้น', 'dm'), { ...member('p1', 'มุก', 'player'), characterName: 'Nyx' }, member('p2', 'บอส', 'player')]
  it('uses DM, the character name, or the device name', () => {
    expect(rollerName(list, 'dm', '?')).toBe('DM')
    expect(rollerName(list, 'p1', '?')).toBe('Nyx')
    expect(rollerName(list, 'p2', '?')).toBe('บอส')
    expect(rollerName(list, 'gone', 'เครื่องเก่า')).toBe('เครื่องเก่า')
  })
})

describe('lastHostedRoom', () => {
  const hosted = {
    code: 'K7QX4M', role: 'dm', campaignId: 'camp1', characterId: null, characterName: null, local: false,
    kicked: [{ deviceId: 'd9', name: 'Spam' }], shortRestSince: 123, grants: [{ characterId: 'm1', deviceId: 'd2' }],
  }

  it('keeps the code, campaign, removed players and handed-over characters; the short rest is over', () => {
    expect(lastHostedRoom(hosted)).toEqual({ ...hosted, shortRestSince: null })
  })

  it('only for a DM, and only a valid saved room', () => {
    expect(lastHostedRoom({ ...hosted, role: 'player' })).toBeNull()
    expect(lastHostedRoom({ ...hosted, code: 'nope' })).toBeNull()
    expect(lastHostedRoom(null)).toBeNull()
  })
})

describe('recent hosted rooms (DM goes back to any of the last rooms)', () => {
  const room = (code: string, campaignId = 'camp1') => ({
    code, role: 'dm' as const, campaignId, characterId: null, characterName: null, local: false, kicked: [], shortRestSince: null, grants: [],
  })

  it('leaving a second room keeps the first one (the bug: lobby2 replaced lobby1)', () => {
    let rooms = addRecentHosted([], room('AAAAAA'))
    rooms = addRecentHosted(rooms, room('BBBBBB', 'camp2'))
    expect(rooms.map((r) => r.code)).toEqual(['BBBBBB', 'AAAAAA'])
  })

  it('leaving a room again moves it first with its newest state, without a duplicate', () => {
    const rooms = addRecentHosted([room('BBBBBB'), room('AAAAAA')], { ...room('AAAAAA', 'camp3'), shortRestSince: 99 })
    expect(rooms.map((r) => r.code)).toEqual(['AAAAAA', 'BBBBBB'])
    expect(rooms[0]).toEqual(room('AAAAAA', 'camp3'))
  })

  it('keeps only the newest few rooms', () => {
    let rooms: ReturnType<typeof recentHostedRooms> = []
    for (const c of ['AAAAAA', 'BBBBBB', 'CCCCCC', 'DDDDDD', 'EEEEEE', 'FFFFFF']) rooms = addRecentHosted(rooms, room(c))
    expect(rooms).toHaveLength(MAX_RECENT_HOSTED)
    expect(rooms[0].code).toBe('FFFFFF')
    expect(rooms.some((r) => r.code === 'AAAAAA')).toBe(false)
  })

  it('a player session is never added', () => {
    expect(addRecentHosted([room('AAAAAA')], { ...room('BBBBBB'), role: 'player' })).toEqual([room('AAAAAA')])
  })

  it('reads a saved list, skipping bad entries and duplicates', () => {
    expect(recentHostedRooms([room('AAAAAA'), { code: 'bad' }, room('AAAAAA', 'other'), room('BBBBBB')]).map((r) => r.code)).toEqual(['AAAAAA', 'BBBBBB'])
    expect(recentHostedRooms(null)).toEqual([])
    expect(recentHostedRooms('junk')).toEqual([])
  })

  it('reads the single room an older version saved', () => {
    expect(recentHostedRooms({ ...room('AAAAAA'), shortRestSince: 5 })).toEqual([room('AAAAAA')])
  })
})

describe('roomForCode (DM opens a room again by typing its code)', () => {
  const recent = [{
    code: 'K7QX4M', role: 'dm' as const, campaignId: 'old', characterId: null, characterName: null, local: false,
    kicked: [{ deviceId: 'd9', name: 'Spam' }], shortRestSince: null, grants: [{ characterId: 'm1', deviceId: 'd2' }],
  }]

  it('a code not on the recent list opens a fresh DM room with that code and campaign', () => {
    expect(roomForCode('AB23CD', 'camp1', false, recent)).toEqual({
      code: 'AB23CD', role: 'dm', campaignId: 'camp1', characterId: null, characterName: null, local: false, kicked: [], shortRestSince: null, grants: [],
    })
  })

  it('a code on the recent list keeps its removed players and handed-over characters, with the campaign picked now', () => {
    expect(roomForCode('K7QX4M', 'camp2', false, recent)).toEqual({ ...recent[0], campaignId: 'camp2' })
  })

  it('an invalid code gives nothing', () => {
    expect(roomForCode('K7QX4', 'camp1', false, recent)).toBeNull()
    expect(roomForCode('K7QX4O', 'camp1', false, recent)).toBeNull()
  })
})
