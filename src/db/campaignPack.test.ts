import 'fake-indexeddb/auto'
import { beforeEach, describe, expect, it } from 'vitest'
import { PACK_FORMAT, parseCampaignPack } from '../model/campaignPack'
import { applyPack, planPackImport } from './campaignPack'
import { db } from './db'
import { getSetting } from './device'

const file = JSON.stringify({
  format: PACK_FORMAT,
  campaign: { id: 'doip', name: 'Dragon of Icespire Peak' },
  pages: [{ id: 'p', kind: 'place', title: 'Phandalin' }],
  fights: [{ id: 'f', name: 'Orcs', monsters: [{ name: 'Orc', ac: 13, hp: 15 }] }],
})
const parsed = () => {
  const r = parseCampaignPack(file)
  if (!r.ok) throw new Error(r.error)
  return r.pack
}

beforeEach(async () => {
  await Promise.all([db.campaigns.clear(), db.notes.clear(), db.encounters.clear()])
})

describe('applyPack', () => {
  it('creates the campaign, pages and fights, and selects the campaign', async () => {
    await applyPack(parsed(), 'replace')
    expect((await db.campaigns.get('doip'))?.name).toBe('Dragon of Icespire Peak')
    expect((await db.notes.get('doip-p'))?.title).toBe('Phandalin')
    expect((await db.encounters.get('doip-f'))?.combatants).toHaveLength(1)
    expect(await getSetting('currentCampaignId')).toBe('doip')
  })

  it('a second import updates instead of copying; addOnly keeps the DM\'s edits', async () => {
    await applyPack(parsed(), 'replace')
    await db.notes.update('doip-p', { title: 'แก้เอง' })
    await applyPack(parsed(), 'addOnly')
    expect((await db.notes.get('doip-p'))?.title).toBe('แก้เอง')
    const plan = await planPackImport(parsed())
    expect(plan).toMatchObject({ campaignExists: true, newNotes: 0, existingNotes: 1, newFights: 0, existingFights: 1 })
    await applyPack(parsed(), 'replace')
    const note = await db.notes.get('doip-p')
    expect(note?.title).toBe('Phandalin')
    expect(note?.rev).toBe(2)
    expect(await db.notes.count()).toBe(1)
  })

  it('never replaces a fight that has started', async () => {
    await applyPack(parsed(), 'replace')
    await db.encounters.update('doip-f', { status: 'active', round: 3 })
    await applyPack(parsed(), 'replace')
    expect((await db.encounters.get('doip-f'))?.round).toBe(3)
    expect((await planPackImport(parsed())).startedFights).toBe(1)
  })
})
