// Save an imported campaign pack (see model/campaignPack.ts) on this device.
import { createCampaign } from '../model/campaign'
import type { CampaignPack } from '../model/campaignPack'
import { stamp } from '../model/sync'
import { db } from './db'
import { deviceId, setSetting } from './device'

/** What an import would change, for the preview. */
export interface PackPlan {
  campaignExists: boolean
  newNotes: number
  existingNotes: number
  newFights: number
  existingFights: number
  /** Fights already started or finished: replaced only when asked (`resetStarted`). */
  startedFights: number
  startedFightNames: string[]
}

export async function planPackImport(pack: CampaignPack): Promise<PackPlan> {
  const notes = await db.notes.bulkGet(pack.notes.map((n) => n.id))
  const fights = await db.encounters.bulkGet(pack.encounters.map((e) => e.id))
  return {
    campaignExists: !!(await db.campaigns.get(pack.campaign.id)),
    newNotes: notes.filter((n) => !n).length,
    existingNotes: notes.filter(Boolean).length,
    newFights: fights.filter((f) => !f).length,
    existingFights: fights.filter((f) => f && f.status === 'setup').length,
    startedFights: fights.filter((f) => f && f.status !== 'setup').length,
    startedFightNames: fights.flatMap((f) => (f && f.status !== 'setup' ? [f.name] : [])),
  }
}

/**
 * `replace`: pages and not-yet-started fights that already exist are overwritten with the file's version
 * (ticks in session plans start over); with `resetStarted`, fights already started or finished too (back to
 * the prepared fight, their fight log cleared, as when a fight is deleted). `addOnly`: only records not on
 * this device yet are added. The pack's campaign becomes the selected campaign.
 */
export async function applyPack(pack: CampaignPack, mode: 'replace' | 'addOnly', resetStarted = false): Promise<void> {
  const me = deviceId()
  await db.transaction('rw', [db.campaigns, db.notes, db.encounters, db.log], async () => {
    if (!(await db.campaigns.get(pack.campaign.id))) {
      await db.campaigns.put({ ...createCampaign(pack.campaign.name, me), id: pack.campaign.id })
    }
    for (const n of pack.notes) {
      const old = await db.notes.get(n.id)
      if (old && mode === 'addOnly') continue
      // Keep the revision counting up, so a newer copy always wins.
      await db.notes.put(stamp({ ...n, rev: old?.rev ?? 0, createdAt: old?.createdAt ?? n.createdAt }, me))
    }
    for (const e of pack.encounters) {
      const old = await db.encounters.get(e.id)
      if (old && (mode === 'addOnly' || (old.status !== 'setup' && !resetStarted))) continue
      // The fight's own log goes (PC sheet logs keep their copies), so the fresh fight starts empty.
      if (old && old.status !== 'setup') await db.log.where('encounterId').equals(e.id).filter((l) => l.characterId === '').delete()
      await db.encounters.put(stamp({ ...e, rev: old?.rev ?? 0 }, me))
    }
  })
  await setSetting('currentCampaignId', pack.campaign.id)
}
