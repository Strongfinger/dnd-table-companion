import { describe, expect, it } from 'vitest'
import { canManageCampaign, createCampaign } from './campaign'

describe('canManageCampaign', () => {
  const mine = createCampaign('Lost Mine', 'dm-device')
  it('the device that created it may manage it', () => {
    expect(canManageCampaign(mine, 'dm-device', false)).toBe(true)
  })
  it("a player's copy of the DM's campaign is read-only", () => {
    expect(canManageCampaign(mine, 'player-phone', false)).toBe(false)
  })
  it('never while playing in a room as a player', () => {
    expect(canManageCampaign(mine, 'dm-device', true)).toBe(false)
  })
  it('no device id yet = no', () => {
    expect(canManageCampaign({ ownerDeviceId: '' }, '', false)).toBe(false)
  })
})
