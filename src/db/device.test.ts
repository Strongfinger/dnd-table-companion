import 'fake-indexeddb/auto'
import { beforeEach, describe, expect, it } from 'vitest'
import { createCharacter } from '../model/character'
import { addCampaign, deleteCampaign, listCampaigns, renameCampaign } from './campaigns'
import { getCharacter, saveCharacter, updateCharacter } from './characters'
import { db } from './db'
import { deviceId, getSetting, loadDevice, setDeviceName, setSetting } from './device'

beforeEach(async () => {
  await Promise.all([db.settings.clear(), db.characters.clear(), db.campaigns.clear(), db.encounters.clear()])
})

describe('device identity', () => {
  it('is created once and kept', async () => {
    const first = await loadDevice()
    expect(first.id).toMatch(/^[\w-]{20,}$/)
    expect((await loadDevice()).id).toBe(first.id)
    expect(deviceId()).toBe(first.id)
  })

  it('can be renamed; the id never changes', async () => {
    const d = await loadDevice()
    const renamed = await setDeviceName('  มือถือบูม  ')
    expect(renamed).toEqual({ id: d.id, name: 'มือถือบูม' })
    expect((await loadDevice()).name).toBe('มือถือบูม')
  })

  it('stores small settings', async () => {
    await setSetting('currentCampaignId', 'abc')
    expect(await getSetting('currentCampaignId')).toBe('abc')
  })
})

describe('sync stamps on save', () => {
  it('every save bumps the revision; the creating device becomes the owner', async () => {
    const me = (await loadDevice()).id
    const c = await saveCharacter(createCharacter({ name: 'Boom' }))
    expect(c).toMatchObject({ rev: 1, ownerDeviceId: me, updatedBy: me })
    await updateCharacter(c.id, (x) => ({ character: { ...x, hp: { ...x.hp, current: 5 } }, text: '' }))
    expect((await getCharacter(c.id))!.rev).toBe(2)
  })

  it('an imported character keeps its owner (the player\'s phone)', async () => {
    await loadDevice()
    const c = await saveCharacter(createCharacter({ name: 'From phone', ownerDeviceId: 'players-phone' }))
    expect(c.ownerDeviceId).toBe('players-phone')
  })
})

describe('campaigns', () => {
  it('add, rename, list, delete (characters stay, without the campaign)', async () => {
    await loadDevice()
    const camp = await addCampaign('  Lost Mine  ')
    expect(camp.name).toBe('Lost Mine')
    await renameCampaign(camp.id, 'Phandelver')
    expect((await listCampaigns())[0]).toMatchObject({ name: 'Phandelver', rev: 1 })

    const boom = await saveCharacter(createCharacter({ name: 'Boom', campaignId: camp.id }))
    await deleteCampaign(camp.id)
    expect(await listCampaigns()).toEqual([])
    expect((await getCharacter(boom.id))!.campaignId).toBeNull()
  })
})
