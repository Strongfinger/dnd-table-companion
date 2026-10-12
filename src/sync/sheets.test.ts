import { describe, expect, it } from 'vitest'
import { createCharacter } from '../model/character'
import { isEditHello, mayChange, parseControl, parseEndTurn, mergeEdit, parseActionBody, parseSheetBody, playedCharacterIds, takeDmState, takeIncomingSheet } from './sheets'
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

describe('mergeEdit', () => {
  const dm = { ...nyx, hp: { max: 20, current: 6, temp: 3 }, conditions: ['Prone' as const], hitDiceSpent: 2, rev: 12, campaignId: 'camp' }
  const edit = { ...nyx, notes: 'levelled up', level: 4, hp: { max: 27, current: 20, temp: 0 }, conditions: [], rev: 10, campaignId: 'theirs' }

  it('takes the build, keeps the DM play state', () => {
    const m = mergeEdit(dm, edit)
    expect(m.notes).toBe('levelled up')
    expect(m.level).toBe(4)
    expect(m.hp).toEqual({ max: 27, current: 6, temp: 3 })
    expect(m.conditions).toEqual(['Prone'])
    expect(m.hitDiceSpent).toBe(2)
    expect(m.campaignId).toBe('camp')
    expect(m.rev).toBe(12)
  })

  it('keeps the DM\'s slot and feature uses (no give-backs through the edit screen)', () => {
    const slots = (used: number, max = 3) => [{ max, used }, ...Array.from({ length: 8 }, () => ({ max: 0, used: 0 }))]
    const feat = (used: number) => [{ id: 'sw', name: 'Second Wind', max: 2, used, recharge: 'short' as const }]
    const m = mergeEdit({ ...dm, spellSlots: slots(2), features: feat(1) }, { ...edit, spellSlots: slots(0, 4), features: feat(0) })
    expect(m.spellSlots[0]).toEqual({ max: 4, used: 2 })
    expect(m.features[0].used).toBe(1)
  })

  it('keeps current HP within a lowered max', () => {
    expect(mergeEdit({ ...dm, hp: { max: 20, current: 20, temp: 0 } }, { ...edit, hp: { max: 15, current: 15, temp: 0 } }).hp.current).toBe(15)
  })

  it('tells edits from plain syncs', () => {
    expect(isEditHello({ character: {}, edit: true })).toBe(true)
    expect(isEditHello({ character: {} })).toBe(false)
  })
})

describe('parseEndTurn', () => {
  it('reads the fight, round and combatant', () => {
    expect(parseEndTurn({ encounterId: 'f1', round: 2, combatantId: 'c1' })).toEqual({ encounterId: 'f1', round: 2, combatantId: 'c1' })
    expect(parseEndTurn({ encounterId: 'f1', round: '2', combatantId: 'c1' })).toBeNull()
    expect(parseEndTurn(null)).toBeNull()
  })
})

describe('characters the DM hands to a player (grants)', () => {
  const members: Member[] = [
    { deviceId: 'dm', name: 'DM', role: 'dm', characterId: null, characterName: null, online: true },
    { deviceId: 'p1', name: 'A', role: 'player', characterId: 'c1', characterName: 'Nyx', online: true },
    { deviceId: 'p2', name: 'B', role: 'player', characterId: 'c2', characterName: 'Boom', online: true },
  ]
  const grants = [{ characterId: 'goblin', deviceId: 'p1' }]

  it('the player it was handed to may change it; nobody else', () => {
    expect(mayChange(members, 'p1', 'goblin', grants)).toBe(true)
    expect(mayChange(members, 'p1', 'c1', grants)).toBe(true) // still their own
    expect(mayChange(members, 'p2', 'goblin', grants)).toBe(false)
    expect(mayChange(members, 'dm', 'goblin', [{ characterId: 'goblin', deviceId: 'dm' }])).toBe(false)
  })

  it('handed-over characters are synced like played ones (not for removed devices)', () => {
    expect(playedCharacterIds(members, () => false, grants)).toEqual(['c1', 'c2', 'goblin'])
    expect(playedCharacterIds(members, (id) => id === 'p1', grants)).toEqual(['c2'])
  })

  it("a phone reads only its own grants from the 'control' message", () => {
    const body = { grants: [{ characterId: 'goblin', deviceId: 'p1' }, { characterId: 'wolf', deviceId: 'p2' }] }
    expect(parseControl(body, 'p1')).toEqual(['goblin'])
    expect(parseControl(body, 'p3')).toEqual([])
    expect(parseControl({ grants: 'x' }, 'p1')).toBeNull()
  })
})
