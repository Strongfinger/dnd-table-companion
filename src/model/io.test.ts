import { describe, expect, it } from 'vitest'
import { sampleCharacters } from '../dev/sampleCharacters'
import { deriveSheet } from '../rules'
import { createCharacter } from './character'
import { EXPORT_FORMAT, exportCharacter, exportFileName, parseCharacterImport } from './io'

const boom = sampleCharacters()[0]

function importOk(text: string) {
  const r = parseCharacterImport(text)
  if (!r.ok) throw new Error(r.error)
  return r
}

describe('export → import round trip', () => {
  it('gives back the same character for all 4 real sheets', () => {
    for (const c of sampleCharacters()) {
      const r = importOk(exportCharacter(c))
      expect(r.warnings).toEqual([])
      expect({ ...r.character, updatedAt: 0 }).toEqual({ ...c, updatedAt: 0 })
      expect(deriveSheet(r.character)).toEqual(deriveSheet(c))
    }
  })

  it('keeps play state: HP, slots, features, conditions', () => {
    const c = createCharacter({
      name: 'Cleric', className: 'Cleric', hp: { max: 10, current: 4, temp: 2 }, conditions: ['Poisoned'], exhaustion: 1,
      spellSlots: [{ max: 2, used: 1 }, ...Array.from({ length: 8 }, () => ({ max: 0, used: 0 }))],
      features: [{ id: 'cd', name: 'Channel Divinity', max: 2, used: 1, recharge: 'short' }],
    })
    const r = importOk(exportCharacter(c)).character
    expect(r.hp).toEqual({ max: 10, current: 4, temp: 2 })
    expect(r.spellSlots[0]).toEqual({ max: 2, used: 1 })
    expect(r.features[0].used).toBe(1)
    expect(r.conditions).toEqual(['Poisoned'])
  })

  it('accepts a bare character object without the wrapper', () => {
    expect(importOk(JSON.stringify(boom)).character.name).toBe('Boom')
  })
})

describe('exportFileName', () => {
  it('makes a safe name and keeps Thai letters', () => {
    expect(exportFileName({ name: 'Boom' })).toBe('Boom.json')
    expect(exportFileName({ name: 'บูม ผู้กล้า' })).toBe('บูม-ผู้กล้า.json')
    expect(exportFileName({ name: '../../etc/passwd' })).toBe('etc-passwd.json')
    expect(exportFileName({ name: '   ' })).toBe('character.json')
  })
})

describe('rejects bad files', () => {
  const wrap = (character: unknown, extra = {}) => JSON.stringify({ format: EXPORT_FORMAT, version: 1, character, ...extra })
  const error = (text: string) => {
    const r = parseCharacterImport(text)
    return r.ok ? null : r.error
  }

  it('not JSON, not an object, another app', () => {
    expect(error('hello')).toContain('JSON')
    expect(error('[1,2]')).not.toBeNull()
    expect(error(JSON.stringify({ format: 'something-else', character: boom }))).toContain('ไม่ใช่ไฟล์ตัวละคร')
  })

  it('a file from a newer app version', () => {
    expect(error(wrap(boom, { version: 99 }))).toContain('เวอร์ชันใหม่กว่า')
  })

  it('missing or impossible core fields', () => {
    expect(error(wrap({ ...boom, name: '' }))).toContain('ชื่อ')
    expect(error(wrap({ ...boom, className: 'Artificer' }))).toContain('Artificer')
    expect(error(wrap({ ...boom, level: 25 }))).toContain('Level')
    expect(error(wrap({ ...boom, scores: { ...boom.scores, str: 99 } }))).toContain('Ability Scores')
    expect(error(wrap({ ...boom, scores: { ...boom.scores, dex: '12' } }))).toContain('Ability Scores')
  })

  it('files over 1 MB', () => {
    expect(error(wrap({ ...boom, notes: 'x'.repeat(1_100_000) }))).toContain('1 MB')
  })
})

describe('cleans up bad optional fields', () => {
  const imp = (patch: Record<string, unknown>) => importOk(JSON.stringify({ ...boom, ...patch }))

  it('falls back to defaults with a warning', () => {
    const r = imp({ ac: 'sixteen', exhaustion: 9, skills: { Flying: 'proficient' } })
    expect(r.character.ac).toBe(10)
    expect(r.character.exhaustion).toBe(0)
    expect(r.character.skills).toEqual({})
    expect(r.warnings).toHaveLength(3)
  })

  it('keeps current HP within max and Hit Dice within level', () => {
    const r = imp({ hp: { max: 19, current: 500, temp: -3 }, hitDiceSpent: 9 })
    expect(r.character.hp).toEqual({ max: 19, current: 19, temp: 0 })
    expect(r.character.hitDiceSpent).toBe(0)
  })

  it('trims long text and drops unknown fields', () => {
    const r = imp({ name: 'N'.repeat(500), hacked: true, notes: 'n'.repeat(30000) })
    expect(r.character.name).toHaveLength(100)
    expect(r.character.notes).toHaveLength(20000)
    expect('hacked' in r.character).toBe(false)
  })

  it('replaces unsafe ids', () => {
    const r = imp({ id: '<script>' })
    expect(r.character.id).not.toBe('<script>')
    expect(r.character.id).toMatch(/^[\w-]+$/)
  })

  it('an old file without newer fields gets defaults and no warnings', () => {
    const { feats: _f, deathSaves: _d, features: _x, ...old } = boom
    const r = importOk(JSON.stringify(old))
    expect(r.character.feats).toEqual([])
    expect(r.character.deathSaves).toEqual({ successes: 0, failures: 0 })
    expect(r.warnings).toEqual([])
  })
})
