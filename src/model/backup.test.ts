import { describe, expect, it } from 'vitest'
import { createCampaign } from './campaign'
import { createCharacter } from './character'
import { createEncounter, combatantFromCharacter } from './encounter'
import { createNote } from './note'
import { backupFileName, campaignSlice, makeBackup, parseBackup, planRestore, type BackupData } from './backup'

function makeSample(): BackupData {
  const camp = { ...createCampaign('Icespire', 'dm-1', 1000), id: 'doip' }
  const other = { ...createCampaign('Other', 'dm-1', 1000), id: 'other' }
  const boom = { ...createCharacter({ name: 'Boom', className: 'Fighter', level: 3 }), id: 'boom', campaignId: 'doip', rev: 4, updatedAt: 5000 }
  const solo = { ...createCharacter({ name: 'Solo', className: 'Wizard' }), id: 'solo', campaignId: 'other' }
  const fight = { ...createEncounter('Goblins', 'doip'), id: 'f1', combatants: [combatantFromCharacter(boom)] }
  const note = { ...createNote('doip', 1000, 'npc', 'Harbin'), id: 'n1' }
  return {
    campaigns: [camp, other],
    characters: [boom, solo],
    encounters: [fight],
    notes: [note],
    log: [
      { id: 'l1', characterId: 'boom', at: 1, text: 'Boom โดน 5 damage' },
      { id: 'l2', characterId: '', at: 2, text: 'รอบที่ 2', encounterId: 'f1', round: 2 },
      { id: 'l3', characterId: 'solo', at: 3, text: 'Solo พัก' },
    ],
  }
}
/** The same data every call (deep copies), so two samples compare equal. */
const BASE = makeSample()
const sample = (): BackupData => structuredClone(BASE)
const opts = { deviceId: 'dm-1', deviceName: 'Tan DM', campaignId: null, currentCampaignId: 'doip' }
const parsed = (text: string) => {
  const r = parseBackup(text)
  if (!r.ok) throw new Error(r.error)
  return r
}

describe('backup file', () => {
  it('round-trips everything unchanged', () => {
    const data = sample()
    const r = parsed(JSON.stringify(makeBackup(data, opts)))
    expect(r.warnings).toEqual([])
    expect(r.file.characters).toEqual(data.characters)
    expect(r.file.encounters).toEqual(data.encounters)
    expect(r.file.notes).toEqual(data.notes)
    expect(r.file.campaigns).toEqual(data.campaigns)
    expect(r.file.log).toEqual(data.log)
    expect(r.file.currentCampaignId).toBe('doip')
    expect(r.file.deviceId).toBe('dm-1')
  })

  it('one campaign: only its characters, fights, pages and log lines', () => {
    const s = campaignSlice(sample(), 'doip')
    expect(s.campaigns.map((c) => c.id)).toEqual(['doip'])
    expect(s.characters.map((c) => c.id)).toEqual(['boom'])
    expect(s.log.map((l) => l.id)).toEqual(['l1', 'l2'])
    expect(makeBackup(sample(), { ...opts, campaignId: 'doip' }).campaignId).toBe('doip')
  })

  it('reads the older console dump (one array per table, settings rows)', () => {
    const data = sample()
    const dump = { ...data, settings: [{ key: 'device', value: { id: 'dm-1', name: 'Tan DM' } }, { key: 'currentCampaignId', value: 'doip' }] }
    const r = parsed(JSON.stringify(dump))
    expect(r.file.characters).toHaveLength(2)
    expect(r.file.deviceId).toBe('dm-1')
    expect(r.file.currentCampaignId).toBe('doip')
    expect(r.file.campaignId).toBeNull()
  })

  it('skips bad records with a warning and keeps the rest', () => {
    const data = sample() as unknown as Record<string, unknown[]>
    data.characters.push({ id: 'x', name: 'Broken', className: 'Pirate', level: 1 })
    data.encounters.push({ name: 'no id' })
    const r = parsed(JSON.stringify({ ...makeBackup(sample(), opts), characters: data.characters, encounters: data.encounters }))
    expect(r.file.characters).toHaveLength(2)
    expect(r.file.encounters).toHaveLength(1)
    expect(r.warnings.some((w) => w.includes('Broken'))).toBe(true)
    expect(r.warnings.some((w) => w.includes('ข้าม 1'))).toBe(true)
  })

  it('rejects other files', () => {
    expect(parseBackup('nope').ok).toBe(false)
    expect(parseBackup('{"format":"dnd-table-companion/character","version":1}').ok).toBe(false)
    expect(parseBackup('{"format":"dnd-table-companion/backup","version":99}').ok).toBe(false)
    expect(parseBackup('{"hello":1}').ok).toBe(false)
  })

  it('names the file by day (and campaign)', () => {
    const d = new Date(2026, 9, 19)
    expect(backupFileName(d)).toBe('dnd-backup-2026-10-19.json')
    expect(backupFileName(d, 'Dragon of Icespire Peak')).toBe('dnd-backup-Dragon-of-Icespire-Peak-2026-10-19.json')
  })
})

describe('planRestore', () => {
  const fileOf = (data: BackupData, campaignId: string | null = null) => makeBackup(data, { ...opts, campaignId })

  it('restores into an empty device', () => {
    const empty: BackupData = { campaigns: [], characters: [], encounters: [], notes: [], log: [] }
    const p = planRestore(fileOf(sample()), empty, 'merge', 'dm-1', false)
    expect(p.counts.characters).toEqual({ added: 2, updated: 0, kept: 0, deleted: 0 })
    expect(p.put.log).toHaveLength(3)
  })

  it('merge keeps the newer copy and never deletes', () => {
    const device = sample()
    const file = sample()
    // Played on after the backup: this device is newer.
    device.characters[0] = { ...device.characters[0], rev: 9, hp: { ...device.characters[0].hp, current: 1 } }
    // The file has a newer fight.
    file.encounters[0] = { ...file.encounters[0], rev: 3, round: 4 }
    device.notes.push({ ...createNote('doip'), id: 'n2' })
    const p = planRestore(fileOf(file), device, 'merge', 'dm-1', false)
    expect(p.counts.characters.kept).toBe(2)
    expect(p.put.characters).toEqual([])
    expect(p.counts.encounters.updated).toBe(1)
    expect(p.put.encounters[0].round).toBe(4)
    expect(p.counts.notes.deleted).toBe(0)
  })

  it('replace: the file wins with a higher revision, and extras in its scope are deleted', () => {
    const device = sample()
    device.characters[0] = { ...device.characters[0], rev: 9 }
    device.notes.push({ ...createNote('doip'), id: 'n2' }, { ...createNote('other'), id: 'n3' })
    const file = fileOf(sample(), 'doip')
    const p = planRestore(file, device, 'replace', 'dm-1', false, 7777)
    expect(p.put.characters).toHaveLength(1)
    expect(p.put.characters[0]).toMatchObject({ id: 'boom', rev: 10, updatedAt: 7777, updatedBy: 'dm-1' })
    // n3 belongs to another campaign: a one-campaign file leaves it alone.
    expect(p.delete.notes).toEqual(['n2'])
    expect(p.delete.characters).toEqual([])
  })

  it('replace with a full backup deletes everything not in the file', () => {
    const device = sample()
    device.characters.push({ ...createCharacter({ name: 'New' }), id: 'new' })
    const p = planRestore(fileOf(sample()), device, 'replace', 'dm-1', false)
    expect(p.delete.characters).toEqual(['new'])
    expect(p.counts.characters.kept).toBe(2)
  })

  it('a new DM device can take over the campaigns of the old one', () => {
    const empty: BackupData = { campaigns: [], characters: [], encounters: [], notes: [], log: [] }
    expect(planRestore(fileOf(sample()), empty, 'merge', 'dm-2', true).put.campaigns.every((c) => c.ownerDeviceId === 'dm-2')).toBe(true)
    expect(planRestore(fileOf(sample()), empty, 'merge', 'dm-2', false).put.campaigns.every((c) => c.ownerDeviceId === 'dm-1')).toBe(true)
  })
})
