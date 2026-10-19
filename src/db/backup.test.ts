// Runs against an in-memory IndexedDB, so it works in Node without a browser.
import 'fake-indexeddb/auto'
import { beforeEach, describe, expect, it } from 'vitest'
import { createCampaign } from '../model/campaign'
import { createCharacter } from '../model/character'
import { createEncounter } from '../model/encounter'
import { parseBackup } from '../model/backup'
import { backupThisDevice, restoreBackup } from './backup'
import { db } from './db'
import { getSetting } from './device'

beforeEach(async () => {
  await Promise.all([db.campaigns.clear(), db.characters.clear(), db.encounters.clear(), db.notes.clear(), db.log.clear(), db.settings.clear()])
})

async function seed() {
  await db.campaigns.put({ ...createCampaign('Icespire', 'dm-1'), id: 'doip' })
  await db.characters.put({ ...createCharacter({ name: 'Boom', className: 'Fighter' }), id: 'boom', campaignId: 'doip' })
  await db.encounters.put({ ...createEncounter('Goblins', 'doip'), id: 'f1' })
  await db.log.put({ id: 'l1', characterId: 'boom', at: 1, text: 'hit' })
}

describe('backup on this device', () => {
  it('a reset device gets everything back', async () => {
    await seed()
    await db.settings.put({ key: 'currentCampaignId', value: 'doip' })
    const text = JSON.stringify(await backupThisDevice(null))
    await Promise.all([db.campaigns.clear(), db.characters.clear(), db.encounters.clear(), db.log.clear(), db.settings.clear()])

    const r = parseBackup(text)
    if (!r.ok) throw new Error(r.error)
    const plan = await restoreBackup(r.file, 'merge', false)
    expect(plan.counts.characters.added).toBe(1)
    expect((await db.characters.get('boom'))?.name).toBe('Boom')
    expect(await db.encounters.count()).toBe(1)
    expect(await db.log.count()).toBe(1)
    expect(await getSetting('currentCampaignId')).toBe('doip')
  })

  it('replace deletes what was added after the backup', async () => {
    await seed()
    const r = parseBackup(JSON.stringify(await backupThisDevice('doip')))
    if (!r.ok) throw new Error(r.error)
    await db.characters.put({ ...createCharacter({ name: 'Later' }), id: 'later', campaignId: 'doip' })
    await db.characters.put({ ...createCharacter({ name: 'Elsewhere' }), id: 'else', campaignId: null })

    await restoreBackup(r.file, 'merge', false)
    expect(await db.characters.count()).toBe(3)
    await restoreBackup(r.file, 'replace', false)
    expect((await db.characters.toArray()).map((c) => c.id).sort()).toEqual(['boom', 'else'])
  })
})
