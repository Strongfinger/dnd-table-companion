// A campaign groups characters, fights and (later) notes. A live lobby will be a session of a campaign.
import { newId } from './character'
import type { SyncMeta } from './sync'

export interface Campaign extends SyncMeta {
  id: string
  name: string
  /** The DM's device. */
  ownerDeviceId: string
  createdAt: number
}

export function createCampaign(name: string, ownerDeviceId: string, now = Date.now()): Campaign {
  return { id: newId(), name: name.trim().slice(0, 100) || 'แคมเปญใหม่', ownerDeviceId, createdAt: now, updatedAt: now, rev: 0, updatedBy: ownerDeviceId }
}
