// Buff play actions (add, remove, ended by rests), their checks over the network and in files, and who may use them.
import { describe, expect, it } from 'vitest'
import { mergeEdit } from '../sync/sheets'
import { createCharacter } from './character'
import { applyCharacterAction, parseBuff, parseCharacterAction } from './characterActions'
import { exportCharacter, parseCharacterImport } from './io'
import { playerMay } from './permissions'
import type { Buff } from '../rules'

const longstrider: Buff = { id: 'ls', name: 'Longstrider', note: '', mods: { speed: 10 }, ends: 'shortRest' }
const blessing: Buff = { id: 'bl', name: 'Blessing', note: 'จาก Tymora', mods: { skills: 1 }, ends: 'longRest' }
const sof: Buff = { id: 'sf', name: 'Shield of Faith', note: '', mods: { ac: 2 }, ends: 'manual' }
const hero = createCharacter({ name: 'Bo', hp: { max: 12, current: 12, temp: 0 } })

describe('buff actions', () => {
  it('adds a buff and logs what it gives', () => {
    const r = applyCharacterAction(hero, { type: 'addBuff', buff: longstrider })!
    expect(r.character.buffs).toEqual([longstrider])
    expect(r.text).toContain('Longstrider')
    expect(r.text).toContain('Speed +10 ft.')
  })

  it('removes a buff; removing a missing one does nothing', () => {
    const c = { ...hero, buffs: [longstrider, blessing] }
    expect(applyCharacterAction(c, { type: 'removeBuff', buffId: 'ls' })!.character.buffs).toEqual([blessing])
    expect(applyCharacterAction(c, { type: 'removeBuff', buffId: 'nope' })).toBeNull()
  })

  it('rests end buffs by their duration', () => {
    const c = { ...hero, buffs: [longstrider, blessing, sof] }
    const short = applyCharacterAction(c, { type: 'shortRest' })!
    expect(short.character.buffs).toEqual([blessing, sof])
    expect(short.text).toContain('หมด: Longstrider')
    expect(applyCharacterAction(c, { type: 'longRest' })!.character.buffs).toEqual([sof])
  })
})

describe('parseBuff / parseCharacterAction', () => {
  it('accepts a good buff and drops zero values', () => {
    expect(parseBuff({ ...longstrider, mods: { speed: 10, ac: 0 } })).toEqual(longstrider)
    expect(parseCharacterAction({ type: 'addBuff', buff: blessing })).toEqual({ type: 'addBuff', buff: blessing })
    expect(parseCharacterAction({ type: 'removeBuff', buffId: 'ls' })).toEqual({ type: 'removeBuff', buffId: 'ls' })
  })

  it('rejects bad buffs', () => {
    expect(parseBuff({ ...longstrider, mods: { speed: 500 } })).toBeNull()
    expect(parseBuff({ ...longstrider, mods: { ac: 1.5 } })).toBeNull()
    expect(parseBuff({ ...longstrider, ends: 'forever' })).toBeNull()
    expect(parseBuff({ ...longstrider, name: '  ' })).toBeNull()
    expect(parseBuff({ ...longstrider, id: 'bad id!' })).toBeNull()
    expect(parseCharacterAction({ type: 'removeBuff', buffId: '' })).toBeNull()
  })

  it('ignores unknown mod keys and cuts long text', () => {
    const b = parseBuff({ ...longstrider, name: 'x'.repeat(100), note: 'y'.repeat(300), mods: { speed: 10, hp: 5 } })!
    expect(b.mods).toEqual({ speed: 10 })
    expect(b.name).toHaveLength(60)
    expect(b.note).toHaveLength(200)
  })
})

describe('who may change buffs', () => {
  it('a player in a room may remove a buff but not add one', () => {
    const c = { ...hero, buffs: [longstrider] }
    expect(playerMay(c, { type: 'addBuff', buff: blessing }).ok).toBe(false)
    expect(playerMay(c, { type: 'removeBuff', buffId: 'ls' }).ok).toBe(true)
  })

  it("a player's edit-screen save keeps the DM's buffs", () => {
    const dm = { ...hero, buffs: [longstrider], rev: 5 }
    const edit = { ...hero, notes: 'new', buffs: [], rev: 4 }
    expect(mergeEdit(dm, edit).buffs).toEqual([longstrider])
  })
})

describe('buffs in exported files', () => {
  it('round-trip through export and import', () => {
    const c = { ...hero, buffs: [longstrider, blessing] }
    const r = parseCharacterImport(exportCharacter(c))
    expect(r.ok && r.character.buffs).toEqual([longstrider, blessing])
  })

  it('older files without buffs get none; broken buffs fall back with a warning', () => {
    const { buffs: _, ...old } = hero
    const r = parseCharacterImport(JSON.stringify(old))
    expect(r.ok && r.character.buffs).toEqual([])
    const bad = parseCharacterImport(JSON.stringify({ ...hero, buffs: [{ name: 'x' }] }))
    expect(bad.ok && bad.character.buffs).toEqual([])
    expect(bad.ok && bad.warnings.length).toBe(1)
  })
})
