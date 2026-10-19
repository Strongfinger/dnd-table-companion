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
 * this device yet are added.
 * `targetId`: the campaign on this device that gets the pages and fights (default: the pack's own; made if
 * missing, and renamed to the pack's name if the file changed it and this device owns it). Another campaign already on this device
 * can be picked instead, e.g. the one the room plays: its name stays. Records keep their pack ids either way,
 * so importing again still finds them. The target becomes the selected campaign.
 */
export async function applyPack(
  pack: CampaignPack,
  mode: 'replace' | 'addOnly',
  resetStarted = false,
  targetId = pack.campaign.id,
): Promise<void> {
  const me = deviceId()
  await db.transaction('rw', [db.campaigns, db.notes, db.encounters, db.log], async () => {
    const target = await db.campaigns.get(targetId)
    if (targetId === pack.campaign.id) {
      if (!target) await db.campaigns.put({ ...createCampaign(pack.campaign.name, me), id: pack.campaign.id })
      else if (target.name !== pack.campaign.name && target.ownerDeviceId === me) await db.campaigns.put(stamp({ ...target, name: pack.campaign.name }, me))
    } else if (!target) {
      throw new Error(`no campaign ${targetId}`)
    }
    for (const n of pack.notes) {
      const old = await db.notes.get(n.id)
      if (old && mode === 'addOnly') continue
      // Keep the revision counting up, so a newer copy always wins.
      await db.notes.put(stamp({ ...n, campaignId: targetId, rev: old?.rev ?? 0, createdAt: old?.createdAt ?? n.createdAt }, me))
    }
    for (const e of pack.encounters) {
      const old = await db.encounters.get(e.id)
      if (old && (mode === 'addOnly' || (old.status !== 'setup' && !resetStarted))) continue
      // The fight's own log goes (PC sheet logs keep their copies), so the fresh fight starts empty.
      if (old && old.status !== 'setup') await db.log.where('encounterId').equals(e.id).filter((l) => l.characterId === '').delete()
      await db.encounters.put(stamp({ ...e, campaignId: targetId, rev: old?.rev ?? 0 }, me))
    }
  })
  await setSetting('currentCampaignId', targetId)
}
