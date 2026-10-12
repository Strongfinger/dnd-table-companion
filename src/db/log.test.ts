import 'fake-indexeddb/auto'
import { beforeEach, describe, expect, it } from 'vitest'
import { createCharacter } from '../model/character'
import { deleteCharacter, saveCharacter } from './characters'
import { db } from './db'
import { createEncounter } from '../model/encounter'
import { addLog, clearLog, deleteLog, listEncounterLog, listLog, logCharacterEvent, logSharedRoll } from './log'

beforeEach(async () => {
  await db.characters.clear()
  await db.log.clear()
  await db.encounters.clear()
})

describe('play log', () => {
  it('lists a character\'s entries newest first', async () => {
    await addLog('a', 'first')
    await new Promise((r) => setTimeout(r, 5))
    await addLog('a', 'second')
    await addLog('b', 'other character')
    expect((await listLog('a')).map((e) => e.text)).toEqual(['second', 'first'])
  })

  it('entries written in the same moment keep their order', async () => {
    await Promise.all(['a1', 'a2', 'a3', 'a4'].map((t) => addLog('a', t)))
    expect((await listLog('a')).map((e) => e.text)).toEqual(['a4', 'a3', 'a2', 'a1'])
  })

  it('limits and clears', async () => {
    for (let i = 0; i < 5; i++) await addLog('a', `e${i}`)
    expect(await listLog('a', 3)).toHaveLength(3)
    await clearLog('a')
    expect(await listLog('a')).toEqual([])
  })

  it('deleting a character deletes its log', async () => {
    const c = await saveCharacter(createCharacter({ name: 'X' }))
    await addLog(c.id, 'hit')
    await deleteCharacter(c.id)
    expect(await listLog(c.id)).toEqual([])
  })
})

describe('fight-aware logging and deleting', () => {
  it('a character in a running fight also logs into that fight with the round', async () => {
    const fight = { ...createEncounter('Ambush'), status: 'active' as const, round: 3, combatants: [{ characterId: 'boom' } as never] }
    await db.encounters.put(fight)
    await logCharacterEvent('boom', 'Boom ใช้ Action: Dash')
    expect((await listEncounterLog(fight.id))[0]).toMatchObject({ text: 'Boom ใช้ Action: Dash', round: 3, characterId: 'boom' })
    await logCharacterEvent('nyx', 'not in the fight')
    expect(await listEncounterLog(fight.id)).toHaveLength(1)
  })

  it('deletes a single line', async () => {
    const id = await addLog('a', 'oops')
    await addLog('a', 'keep')
    await deleteLog(id)
    expect((await listLog('a')).map((e) => e.text)).toEqual(['keep'])
  })
})

describe('logSharedRoll (live lobby)', () => {
  it('goes into the running fight, and the sheet log of a known character', async () => {
    const nyx = await saveCharacter(createCharacter({ name: 'Nyx' }))
    const fight = { ...createEncounter('Ambush', 'camp'), status: 'active' as const, round: 3 }
    await db.encounters.put(fight)
    await logSharedRoll('🎲 Nyx: 1d20+5 = 17', nyx.id, 'camp')
    await logSharedRoll('🎲 Stranger: 1d6 = 4', 'not-here', 'camp')
    expect((await listEncounterLog(fight.id)).map((e) => [e.text, e.round])).toEqual([['🎲 Nyx: 1d20+5 = 17', 3], ['🎲 Stranger: 1d6 = 4', 3]])
    expect((await listLog(nyx.id)).map((e) => e.text)).toEqual(['🎲 Nyx: 1d20+5 = 17'])
  })

  it('without a running fight: only a known character\'s sheet log', async () => {
    const nyx = await saveCharacter(createCharacter({ name: 'Nyx' }))
    await logSharedRoll('roll A', nyx.id, null)
    await logSharedRoll('roll B', null, null)
    expect((await db.log.toArray()).map((e) => e.text)).toEqual(['roll A'])
  })
})
