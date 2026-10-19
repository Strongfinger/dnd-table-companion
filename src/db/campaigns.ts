// Read/write campaigns.
import { liveQuery } from 'dexie'
import { createCampaign, type Campaign } from '../model/campaign'
import { stamp } from '../model/sync'
import { db } from './db'
import { deviceId } from './device'

export function listCampaigns(): Promise<Campaign[]> {
  return db.campaigns.orderBy('updatedAt').reverse().toArray()
}

export async function addCampaign(name: string): Promise<Campaign> {
  const c = createCampaign(name, deviceId())
  await db.campaigns.put(c)
  return c
}

export async function renameCampaign(id: string, name: string): Promise<void> {
  await db.transaction('rw', db.campaigns, async () => {
    const c = await db.campaigns.get(id)
    if (c) await db.campaigns.put(stamp({ ...c, name: name.trim().slice(0, 100) || c.name }, deviceId()))
  })
}

/** Deletes the campaign only; its characters, fights and notes stay, just without a campaign. */
export async function deleteCampaign(id: string): Promise<void> {
  await db.transaction('rw', [db.campaigns, db.characters, db.encounters, db.notes, db.chapters], async () => {
    await db.campaigns.delete(id)
    // Stamp the changed records too, so other devices can tell they changed.
    const me = deviceId()
    await db.characters.where('campaignId').equals(id).modify((c) => {
      Object.assign(c, stamp({ ...c, campaignId: null }, me))
    })
    await db.encounters.where('campaignId').equals(id).modify((e) => {
      Object.assign(e, stamp({ ...e, campaignId: null }, me))
    })
    await db.notes.where('campaignId').equals(id).modify((n) => {
      Object.assign(n, stamp({ ...n, campaignId: null }, me))
    })
    await db.chapters.where('campaignId').equals(id).modify((c) => {
      Object.assign(c, stamp({ ...c, campaignId: null }, me))
    })
  })
}

export function getCampaign(id: string): Promise<Campaign | undefined> {
  return db.campaigns.get(id)
}

/**
 * Live lobby (player device): keep the DM's campaign here with the same id, so this player's
 * character can belong to it (party overview, lists). Owned by the DM's device.
 */
export async function adoptCampaign(id: string, name: string, ownerDeviceId: string, chronicleId?: string): Promise<void> {
  await db.transaction('rw', db.campaigns, async () => {
    const c = await db.campaigns.get(id)
    const chronicle = chronicleId ? { chronicleId } : {}
    if (!c) await db.campaigns.put({ ...createCampaign(name, ownerDeviceId), id, ...chronicle })
    else if (c.name !== name || (chronicleId && c.chronicleId !== chronicleId)) await db.campaigns.put({ ...c, name: name.trim().slice(0, 100) || c.name, ...chronicle })
  })
}

/** DM: remember the campaign's chronicle share id (a new one replaces the old link). */
export async function setChronicleId(id: string, chronicleId: string): Promise<void> {
  await db.transaction('rw', db.campaigns, async () => {
    const c = await db.campaigns.get(id)
    if (c) await db.campaigns.put(stamp({ ...c, chronicleId }, deviceId()))
  })
}

/** Live lobby (DM device): the campaign now and after every change. */
export function watchCampaign(id: string, onChange: (c: Campaign | undefined) => void): () => void {
  const sub = liveQuery(() => db.campaigns.get(id)).subscribe({ next: onChange, error: (err) => console.error('watchCampaign', err) })
  return () => sub.unsubscribe()
}
