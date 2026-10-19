// Runs against an in-memory IndexedDB, so it works in Node without a browser.
import 'fake-indexeddb/auto'
import { beforeEach, describe, expect, it } from 'vitest'
import { sampleCharacters } from '../dev/sampleCharacters'
import { createCharacter } from '../model/character'
import { ALL_FIXTURES } from '../rules/fixtures/characters'
import { deriveSheet } from '../rules'
import { deleteCharacter, getCharacter, listCharacters, saveCharacter, moveToCampaign, saveReceivedCharacter, updateCharacter } from './characters'
import { db } from './db'
import { combatantFromCharacter, createEncounter } from '../model/encounter'
import { saveEncounter, getEncounter } from './encounters'

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
    const samples = sampleCharacters()
    for (const [i, f] of ALL_FIXTURES.entries()) {
      const saved = await saveCharacter(samples[i])
      const loaded = (await getCharacter(saved.id))!
      expect(deriveSheet(loaded).initiative, f.name).toBe(f.expected.initiative)
      expect(deriveSheet(loaded).saves, f.name).toEqual(f.expected.saves)
    }
    expect(await listCharacters()).toHaveLength(4)
  })
})

describe('updateCharacter', () => {
  it('two quick changes both survive (each starts from the newest copy)', async () => {
    const c = await saveCharacter(createCharacter({ name: 'Boom', hp: { max: 19, current: 19, temp: 0 } }))
    await Promise.all([
      updateCharacter(c.id, (x) => ({ character: { ...x, hp: { ...x.hp, current: x.hp.current - 5 } }, text: 'damage' })),
      updateCharacter(c.id, (x) => ({ character: { ...x, conditions: [...x.conditions, 'Prone'] }, text: 'prone' })),
    ])
    const after = (await getCharacter(c.id))!
    expect(after.hp.current).toBe(14)
    expect(after.conditions).toEqual(['Prone'])
  })

  it('returns null for a missing character', async () => {
    expect(await updateCharacter('nope', (x) => ({ character: x, text: '' }))).toBeNull()
  })
})

describe('saveReceivedCharacter (live lobby)', () => {
  it('stores a received sheet as sent, with the given campaign when new', async () => {
    const c = createCharacter({ name: 'Nyx', rev: 7, updatedBy: 'other', campaignId: 'theirs' })
    const r = await saveReceivedCharacter(c, () => true, 'mine')
    expect(r.saved).toBe(true)
    const stored = await getCharacter(c.id)
    expect(stored?.rev).toBe(7)
    expect(stored?.updatedBy).toBe('other')
    expect(stored?.campaignId).toBe('mine')
  })

  it('keeps this device\'s campaign, and keeps its copy when not accepted', async () => {
    const mine = await saveCharacter(createCharacter({ name: 'Nyx', campaignId: 'camp' }))
    await saveReceivedCharacter({ ...mine, name: 'Nyx 2', rev: mine.rev + 1, campaignId: 'x' }, () => true)
    expect((await getCharacter(mine.id))?.campaignId).toBe('camp')
    const r = await saveReceivedCharacter({ ...mine, name: 'Old' }, (stored) => stored!.rev < mine.rev)
    expect(r.saved).toBe(false)
    expect(r.stored.name).toBe('Nyx 2')
  })
})

describe('deleting a character that is in a fight', () => {
  it('the fight row keeps its last HP and AC (not the ones from when it joined)', async () => {
    const boom = await saveCharacter(createCharacter({ name: 'Boom', hp: { max: 19, current: 19, temp: 0 }, ac: 16 }))
    const fight = { ...createEncounter('Ambush'), combatants: [combatantFromCharacter(boom)] }
    await saveEncounter(fight)
    await updateCharacter(boom.id, (c) => ({ character: { ...c, hp: { ...c.hp, current: 4 }, ac: 18 }, text: '' }))
    await deleteCharacter(boom.id)
    const row = (await getEncounter(fight.id))!.combatants[0]
    expect(row).toMatchObject({ characterId: boom.id, hp: { current: 4, max: 19 }, ac: 18 })
  })
})

describe('moveToCampaign', () => {
  it('files the room\'s characters under its campaign, leaving others alone', async () => {
    await db.characters.clear()
    const a = { ...createCharacter({ name: 'A' }), campaignId: null }
    const b = { ...createCharacter({ name: 'B' }), campaignId: 'from-a-phone' }
    const c = { ...createCharacter({ name: 'C' }), campaignId: 'other' }
    await db.characters.bulkPut([a, b, c])
    await moveToCampaign([a.id, b.id], 'doip')
    expect((await db.characters.toArray()).map((x) => [x.name, x.campaignId, x.rev]).sort()).toEqual([
      ['A', 'doip', a.rev], ['B', 'doip', b.rev], ['C', 'other', c.rev],
    ])
  })
})
