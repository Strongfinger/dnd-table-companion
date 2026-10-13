import 'fake-indexeddb/auto'
import { beforeEach, describe, expect, it } from 'vitest'
import { PACK_FORMAT, parseCampaignPack } from '../model/campaignPack'
import { applyPack, planPackImport } from './campaignPack'
import { db } from './db'
import { getSetting } from './device'
import { addLog } from './log'

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
  await Promise.all([db.campaigns.clear(), db.notes.clear(), db.encounters.clear(), db.log.clear()])
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

  it('resets started or finished fights when asked: back to the prepared fight, its fight log cleared', async () => {
    await applyPack(parsed(), 'replace')
    await db.encounters.update('doip-f', { status: 'ended', round: 4 })
    await addLog('', 'Orc ล้ม', { encounterId: 'doip-f', round: 4 })
    await addLog('pc-1', 'Nyx โดน 5', { encounterId: 'doip-f', round: 4 }) // the PC sheet's own copy stays
    expect((await planPackImport(parsed())).startedFightNames).toEqual(['Orcs'])
    await applyPack(parsed(), 'addOnly', true) // addOnly never resets
    expect((await db.encounters.get('doip-f'))?.status).toBe('ended')
    await applyPack(parsed(), 'replace', true)
    const fight = await db.encounters.get('doip-f')
    expect([fight?.status, fight?.round]).toEqual(['setup', 0])
    expect((await db.log.where('encounterId').equals('doip-f').toArray()).map((l) => l.characterId)).toEqual(['pc-1'])
  })
})
