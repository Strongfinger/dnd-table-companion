// Runs against an in-memory IndexedDB, so it works in Node without a browser.
import 'fake-indexeddb/auto'
import { beforeEach, describe, expect, it } from 'vitest'
import { createCharacter } from '../model/character'
import { ALL_FIXTURES } from '../rules/fixtures/characters'
import { deriveSheet } from '../rules'
import { deleteCharacter, getCharacter, listCharacters, saveCharacter } from './characters'
import { db } from './db'

beforeEach(async () => {
  await db.characters.clear()
})

describe('character storage', () => {
  it('saves and loads a character unchanged', async () => {
    const boom = createCharacter({ name: 'Boom', className: 'Fighter', level: 2, hp: { max: 19, current: 19, temp: 0 } })
    const saved = await saveCharacter(boom)
    expect(await getCharacter(boom.id)).toEqual(saved)
  })

  it('lists the most recently edited first', async () => {
    const a = await saveCharacter(createCharacter({ name: 'A', updatedAt: 0 }))
    await new Promise((r) => setTimeout(r, 5))
    const b = await saveCharacter(createCharacter({ name: 'B' }))
    expect((await listCharacters()).map((c) => c.id)).toEqual([b.id, a.id])
  })

  it('updates instead of duplicating', async () => {
    const c = await saveCharacter(createCharacter({ name: 'Old' }))
    await saveCharacter({ ...c, name: 'New' })
    const all = await listCharacters()
    expect(all).toHaveLength(1)
    expect(all[0].name).toBe('New')
  })

  it('deletes', async () => {
    const c = await saveCharacter(createCharacter())
    await deleteCharacter(c.id)
    expect(await getCharacter(c.id)).toBeUndefined()
  })

  it('round-trips the 4 real characters and they still derive the right numbers', async () => {
    for (const f of ALL_FIXTURES) {
      const { expected, hpRolls: _r, hpBonusPerLevel: _b, ...fields } = f
      const saved = await saveCharacter(createCharacter({ ...fields, hp: { max: expected.maxHp, current: expected.maxHp, temp: 0 }, ac: expected.ac }))
      const loaded = (await getCharacter(saved.id))!
      expect(deriveSheet(loaded).initiative, f.name).toBe(expected.initiative)
      expect(deriveSheet(loaded).saves, f.name).toEqual(expected.saves)
    }
    expect(await listCharacters()).toHaveLength(4)
  })
})
