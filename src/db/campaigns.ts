// Read/write campaigns.
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

/** Deletes the campaign only; its characters and fights stay, just without a campaign. */
export async function deleteCampaign(id: string): Promise<void> {
  await db.transaction('rw', db.campaigns, db.characters, db.encounters, async () => {
    await db.campaigns.delete(id)
    await db.characters.where('campaignId').equals(id).modify({ campaignId: null })
    await db.encounters.where('campaignId').equals(id).modify({ campaignId: null })
  })
}
