import 'fake-indexeddb/auto'
import { beforeEach, describe, expect, it } from 'vitest'
import { createEncounter, createMonsters } from '../model/encounter'
import { db } from './db'
import { getEncounter } from './encounters'
import { listEncounterLog } from './log'
import { addMonstersToFight, advanceTurn } from './turns'

beforeEach(async () => {
  await db.encounters.clear()
  await db.log.clear()
})

describe('addMonstersToFight', () => {
  it('adds numbered copies after the ones already there, and logs them for everyone', async () => {
    const e = { ...createEncounter('Ambush'), combatants: createMonsters({ name: 'Goblin', ac: 15, hpMax: 7, initBonus: 2 }, 1) }
    await db.encounters.put(e)
    const names = await addMonstersToFight(e.id, { name: 'Goblin', ac: 15, hpMax: 7, initBonus: 2 }, 2)
    expect(names).toEqual(['Goblin 2', 'Goblin 3'])
    expect((await getEncounter(e.id))?.combatants).toHaveLength(3)
    const log = await listEncounterLog(e.id)
    expect(log.map((l) => [l.text, l.forPlayers])).toEqual([['➕ Goblin 2 เข้าร่วมการต่อสู้', true], ['➕ Goblin 3 เข้าร่วมการต่อสู้', true]])
  })

  it('does nothing for a missing fight', async () => {
    expect(await addMonstersToFight('nope', { name: 'Goblin', ac: 15, hpMax: 7, initBonus: 2 }, 1)).toEqual([])
  })
})

describe('advanceTurn', () => {
  it('moves to the next combatant and logs the turn', async () => {
    const [a, b] = createMonsters({ name: 'Goblin', ac: 15, hpMax: 7, initBonus: 2 }, 2)
    const e = { ...createEncounter('Ambush'), status: 'active' as const, round: 1, activeId: a.id, combatants: [{ ...a, initiative: 15 }, { ...b, initiative: 10 }] }
    await db.encounters.put(e)
    expect(await advanceTurn(e.id, { activeId: b.id, round: 1 })).toBe(false) // not b's turn: nothing happens
    expect(await advanceTurn(e.id)).toBe(true)
    expect((await getEncounter(e.id))?.activeId).toBe(b.id)
    expect((await listEncounterLog(e.id)).map((l) => l.text)).toContain('ตาของ Goblin 2')
  })
})
