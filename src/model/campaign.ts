// A campaign groups characters, fights and (later) notes. A live lobby will be a session of a campaign.
import { newId } from './character'
import type { SyncMeta } from './sync'

export interface Campaign extends SyncMeta {
  id: string
  name: string
  /** The DM's device. */
  ownerDeviceId: string
  createdAt: number
  /** The journey chronicle's share id in Firebase (sync/chronicleShare.ts), once the DM has shared it. */
  chronicleId?: string
}

export function createCampaign(name: string, ownerDeviceId: string, now = Date.now()): Campaign {
  return { id: newId(), name: name.trim().slice(0, 100) || 'แคมเปญใหม่', ownerDeviceId, createdAt: now, updatedAt: now, rev: 0, updatedBy: ownerDeviceId }
}

/**
 * Only the DM's device that created a campaign may rename or delete it. A player's phone keeps a
 * read-only copy of the room's campaign, and a player in a room never manages campaigns.
 */
export function canManageCampaign(c: Pick<Campaign, 'ownerDeviceId'>, myDeviceId: string, playerInRoom: boolean): boolean {
  return !playerInRoom && !!myDeviceId && c.ownerDeviceId === myDeviceId
}
