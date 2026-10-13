// Is this device the DM of a campaign (it created it, and isn't a player in a live room right now)?
import { useLiveQuery } from 'dexie-react-hooks'
import { getCampaign } from '../db/campaigns'
import { deviceId } from '../db/device'
import { canManageCampaign } from '../model/campaign'
import { useLobby } from './useLobby'

export function useRunsCampaign(campaignId: string | null | undefined): boolean {
  const playerInRoom = useLobby().session?.role === 'player'
  const campaign = useLiveQuery(() => (campaignId ? getCampaign(campaignId) : undefined), [campaignId])
  return !!campaign && canManageCampaign(campaign, deviceId(), playerInRoom)
}
