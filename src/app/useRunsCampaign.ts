// Is this device the DM of a campaign (it created it, and isn't a player in a live room right now)?
import { useLiveQuery } from 'dexie-react-hooks'
import { getCampaign } from '../db/campaigns'
import { deviceId } from '../db/device'
import { canManageCampaign } from '../model/campaign'
import { dmRunsEconomy } from '../model/rewards'
import { useLobby } from './useLobby'

export function useRunsCampaign(campaignId: string | null | undefined): boolean {
  const playerInRoom = useLobby().session?.role === 'player'
  const campaign = useLiveQuery(() => (campaignId ? getCampaign(campaignId) : undefined), [campaignId])
  return !!campaign && canManageCampaign(campaign, deviceId(), playerInRoom)
}

/**
 * Does a DM on another device run this character's items and coins? Then the sheet takes items only from the DM's
 * reward pool and asks the DM for coin changes (model/rewards.ts `dmRunsEconomy`).
 */
export function useDmRunsEconomy(c: { id: string; campaignId?: string | null }): boolean {
  const lobby = useLobby()
  const playerInRoom = lobby.session?.role === 'player'
  const campaign = useLiveQuery(() => (c.campaignId ? getCampaign(c.campaignId) : undefined), [c.campaignId])
  return dmRunsEconomy({ playedHereAsPlayer: playerInRoom && lobby.myCharacterIds.includes(c.id), campaign, myDeviceId: deviceId(), playerInRoom })
}
