// Full backup on this device: read every table for a backup file, and restore one (see model/backup.ts).
import { withDefaults } from '../model/character'
import { withEncounterDefaults } from '../model/encounter'
import { withNoteDefaults } from '../model/note'
import { makeBackup, planRestore, TABLES, type BackupData, type BackupFile, type RestoreMode, type RestorePlan } from '../model/backup'
import { db } from './db'
import { currentDevice, deviceId, getSetting, setSetting } from './device'

/** Everything this device keeps (as stored, with defaults filled in for older records). */
export async function readAll(): Promise<BackupData> {
  const [campaigns, characters, encounters, notes, log] = await Promise.all([
    db.campaigns.toArray(), db.characters.toArray(), db.encounters.toArray(), db.notes.toArray(), db.log.toArray(),
  ])
  return {
    campaigns,
    characters: characters.map(withDefaults),
    encounters: encounters.map(withEncounterDefaults),
    notes: notes.map(withNoteDefaults),
    log,
  }
}

/** A backup of this device: everything (`campaignId` null) or one campaign. */
export async function backupThisDevice(campaignId: string | null): Promise<BackupFile> {
  return makeBackup(await readAll(), {
    deviceId: deviceId(),
    deviceName: currentDevice()?.name ?? '',
    campaignId,
    currentCampaignId: (await getSetting<string | null>('currentCampaignId')) ?? null,
  })
}

/** What restoring `file` would change on this device. */
export async function planRestoreHere(file: BackupFile, mode: RestoreMode, takeOver: boolean): Promise<RestorePlan> {
  return planRestore(file, await readAll(), mode, deviceId(), takeOver)
}

/**
 * Restore a backup in one transaction (all or nothing). The plan is worked out again inside it, so a
 * change made since the preview (e.g. a sync in a live room) is not overwritten by mistake.
 */
export async function restoreBackup(file: BackupFile, mode: RestoreMode, takeOver: boolean): Promise<RestorePlan> {
  const tables = TABLES.map((t) => db[t])
  const plan = await db.transaction('rw', tables, async () => {
    const p = planRestore(file, await readAll(), mode, deviceId(), takeOver)
    for (const t of TABLES) {
      const table = db[t] as unknown as { bulkDelete(ids: string[]): Promise<void>; bulkPut(rows: unknown[]): Promise<unknown> }
      if (p.delete[t].length) await table.bulkDelete(p.delete[t])
      if (p.put[t].length) await table.bulkPut(p.put[t])
    }
    return p
  })
  // Select the file's campaign if this device has none selected (or the selected one is gone).
  const current = await getSetting<string | null>('currentCampaignId')
  const next = file.campaignId ?? file.currentCampaignId
  if (next && (mode === 'replace' || !current || !(await db.campaigns.get(current))) && (await db.campaigns.get(next))) {
    await setSetting('currentCampaignId', next)
  }
  return plan
}
