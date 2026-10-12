import 'fake-indexeddb/auto'
import { beforeEach, describe, expect, it } from 'vitest'
import { createCharacter } from '../model/character'
import { combatantFromCharacter, createEncounter } from '../model/encounter'
import { getCharacter, saveCharacter } from './characters'
import { db } from './db'
import { listLog } from './log'
import { playAction, restParty } from './play'

beforeEach(async () => {
  await db.characters.clear()
  await db.encounters.clear()
  await db.settings.clear()
})

const wizard = () => saveCharacter(createCharacter({
  name: 'Nyx', className: 'Wizard', level: 1,
  spellSlots: [{ max: 2, used: 0 }, ...Array.from({ length: 8 }, () => ({ max: 0, used: 0 }))],
}))

async function inFight(c: Awaited<ReturnType<typeof wizard>>, round: number) {
  const e = { ...createEncounter('Ambush'), status: 'active' as const, round, combatants: [combatantFromCharacter(c)] }
  await db.encounters.put(e)
  return e
}

describe('playAction', () => {
  it('a player may spend but a give-back is refused and nothing is saved', async () => {
    const c = await wizard()
    expect((await playAction(c.id, { type: 'setSlotUsed', level: 0, used: 1 }, 'player')).refused).toBeNull()
    const spent = await getCharacter(c.id)
    const r = await playAction(c.id, { type: 'setSlotUsed', level: 0, used: 0 }, 'player')
    expect(r.refused).toMatch(/DM/)
    expect(await getCharacter(c.id)).toEqual(spent) // same revision, same slots
    expect((await playAction(c.id, { type: 'longRest' }, 'player')).refused).not.toBeNull()
  })

  it('the DM may give back a use in the same round only', async () => {
    const c = await wizard()
    const fight = await inFight(c, 2)
    await playAction(c.id, { type: 'setSlotUsed', level: 0, used: 2 }, 'dm')
    expect((await playAction(c.id, { type: 'setSlotUsed', level: 0, used: 1 }, 'dm')).refused).toBeNull()
    await db.encounters.put({ ...fight, round: 3 })
    const later = await playAction(c.id, { type: 'setSlotUsed', level: 0, used: 0 }, 'dm')
    expect(later.refused).toMatch(/รอบที่ 3/)
    expect((await getCharacter(c.id))?.spellSlots[0].used).toBe(1)
  })

  it('outside a fight the DM may give back any time; the app itself is never refused', async () => {
    const c = await wizard()
    await playAction(c.id, { type: 'setSlotUsed', level: 0, used: 2 }, 'dm')
    expect((await playAction(c.id, { type: 'setSlotUsed', level: 0, used: 0 }, 'dm')).refused).toBeNull()
    await playAction(c.id, { type: 'setActionUsed', kind: 'action', used: true }, 'player')
    await inFight(c, 5)
    expect((await playAction(c.id, { type: 'resetTurn' }, 'system')).refused).toBeNull()
    expect((await getCharacter(c.id))?.turn.action).toBe(false)
  })
})

describe('playAction: Action on my turn only (players)', () => {
  it('uses the fight on this device (the DM\'s) to know whose turn it is', async () => {
    const c = await wizard()
    const e = await inFight(c, 1)
    const someoneElse = { ...e, activeId: 'goblin' }
    await db.encounters.put(someoneElse)
    expect((await playAction(c.id, { type: 'setActionUsed', kind: 'action', used: true }, 'player')).refused).toMatch(/ตาของตัวเอง/)
    expect((await playAction(c.id, { type: 'setActionUsed', kind: 'reaction', used: true }, 'player')).refused).toBeNull()
    await db.encounters.put({ ...e, activeId: e.combatants[0].id })
    expect((await playAction(c.id, { type: 'setActionUsed', kind: 'action', used: true }, 'player')).refused).toBeNull()
  })

  it('a phone passes where it is in the fight (it has no copy of the fight)', async () => {
    const c = await wizard()
    expect((await playAction(c.id, { type: 'setActionUsed', kind: 'bonusAction', used: true }, 'player', { inFight: true, myTurn: false })).refused).not.toBeNull()
    expect((await playAction(c.id, { type: 'setActionUsed', kind: 'bonusAction', used: true }, 'player', { inFight: false })).refused).toBeNull()
  })
})

describe('restParty', () => {
  it('rests everyone it can, logs it, and lists who could not (Long Rest at 0 HP)', async () => {
    const a = await saveCharacter(createCharacter({ name: 'A', hp: { max: 10, current: 3, temp: 0 } }))
    const b = await saveCharacter(createCharacter({ name: 'B', hp: { max: 10, current: 0, temp: 0 } }))
    const r = await restParty([a.id, b.id, 'missing'], 'longRest')
    expect(r).toEqual({ rested: ['A'], skipped: ['B'] })
    expect((await getCharacter(a.id))?.hp.current).toBe(10)
    expect((await listLog(a.id))[0].text).toMatch(/Long Rest/)
  })
})
