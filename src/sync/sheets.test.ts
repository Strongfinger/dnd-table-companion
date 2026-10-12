import { describe, expect, it } from 'vitest'
import { createCharacter } from '../model/character'
import { mayChange, parseActionBody, parseSheetBody, playedCharacterIds, takeDmState, takeIncomingSheet } from './sheets'
import type { Member } from './transport'

const nyx = createCharacter({ name: 'Nyx', className: 'Rogue', level: 3, scores: { str: 8, dex: 17, con: 14, int: 12, wis: 10, cha: 13 }, rev: 7 })
const member = (deviceId: string, role: Member['role'], characterId: string | null): Member =>
  ({ deviceId, name: deviceId, role, characterId, characterName: null, online: true })

describe('parseSheetBody', () => {
  it('keeps a valid sheet with its id and revision', () => {
    const c = parseSheetBody(JSON.parse(JSON.stringify({ character: nyx })))
    expect(c?.id).toBe(nyx.id)
    expect(c?.rev).toBe(7)
    expect(c?.name).toBe('Nyx')
  })

  it('rejects junk, broken sheets and bad ids', () => {
    expect(parseSheetBody(null)).toBeNull()
    expect(parseSheetBody({ character: 'Nyx' })).toBeNull()
    expect(parseSheetBody({ character: { ...nyx, level: 99 } })).toBeNull()
    expect(parseSheetBody({ character: { ...nyx, id: 'bad id!' } })).toBeNull()
  })
})

describe('parseActionBody', () => {
  it('reads a character id and a checked action', () => {
    expect(parseActionBody({ characterId: 'c1', action: { type: 'heal', amount: 3 } })).toEqual({ characterId: 'c1', action: { type: 'heal', amount: 3 } })
    expect(parseActionBody({ characterId: 'c1', action: { type: 'explode' } })).toBeNull()
    expect(parseActionBody({ action: { type: 'heal', amount: 3 } })).toBeNull()
  })
})

describe('mayChange', () => {
  const members = [member('dm', 'dm', null), member('p1', 'player', 'c1'), member('p2', 'player', 'c2')]
  it('lets a player change only the character they picked', () => {
    expect(mayChange(members, 'p1', 'c1')).toBe(true)
    expect(mayChange(members, 'p1', 'c2')).toBe(false)
    expect(mayChange(members, 'stranger', 'c1')).toBe(false)
    expect(mayChange(members, 'dm', 'c1')).toBe(false)
  })
})

describe('which copy wins', () => {
  it('DM takes a player sheet only when it has newer changes', () => {
    expect(takeIncomingSheet(undefined, { rev: 0 })).toBe(true)
    expect(takeIncomingSheet({ rev: 5 }, { rev: 6 })).toBe(true)
    expect(takeIncomingSheet({ rev: 5 }, { rev: 5 })).toBe(false)
    expect(takeIncomingSheet({ rev: 5 }, { rev: 4 })).toBe(false)
  })

  it('player takes the DM copy unless it is an older message', () => {
    expect(takeDmState(undefined, { rev: 1 })).toBe(true)
    expect(takeDmState({ rev: 5 }, { rev: 5 })).toBe(true)
    expect(takeDmState({ rev: 5 }, { rev: 4 })).toBe(false)
  })
})

describe('playedCharacterIds', () => {
  it('lists picked characters once, without removed players', () => {
    const members = [member('dm', 'dm', null), member('p1', 'player', 'c2'), member('p2', 'player', 'c1'), member('p3', 'player', 'c1'), member('p4', 'player', null), member('p5', 'player', 'c9')]
    expect(playedCharacterIds(members, (id) => id === 'p5')).toEqual(['c1', 'c2'])
  })
})
