import 'fake-indexeddb/auto'
import { beforeEach, describe, expect, it } from 'vitest'
import { createEncounter, createMonsters } from '../model/encounter'
import { db } from './db'
import { deleteEncounter, getEncounter, listEncounters, saveEncounter } from './encounters'
import { addLog, listEncounterLog, listLog } from './log'

beforeEach(async () => {
  await db.encounters.clear()
  await db.log.clear()
})

describe('encounter storage', () => {
  it('saves and loads an encounter with combatants', async () => {
    const e = { ...createEncounter('Goblin ambush'), combatants: createMonsters({ name: 'Goblin', ac: 15, hpMax: 7, initBonus: 2 }, 2) }
    const saved = await saveEncounter(e)
    expect(await getEncounter(e.id)).toEqual(saved)
    expect(await listEncounters()).toHaveLength(1)
  })

  it('fight log is oldest first; deleting the fight keeps PC sheet entries', async () => {
    const e = await saveEncounter(createEncounter('Fight'))
    await addLog('', 'Goblin 1 โดน 5', { encounterId: e.id, round: 1 })
    await new Promise((r) => setTimeout(r, 5))
    await addLog('boom-id', 'Boom โดน 3', { encounterId: e.id, round: 1 })
    expect((await listEncounterLog(e.id)).map((x) => x.text)).toEqual(['Goblin 1 โดน 5', 'Boom โดน 3'])

    await deleteEncounter(e.id)
    expect(await getEncounter(e.id)).toBeUndefined()
    expect((await listLog('boom-id')).map((x) => x.text)).toEqual(['Boom โดน 3'])
  })
})
