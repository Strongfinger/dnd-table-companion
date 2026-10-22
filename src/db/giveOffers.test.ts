import 'fake-indexeddb/auto'
import { beforeEach, describe, expect, it } from 'vitest'
import { createCharacter } from '../model/character'
import { getCharacter, saveCharacter } from './characters'
import { db } from './db'
import { acceptGiveOffer, clearGiveOffers, getGiveOffers, receiveGiveOffer, removeGiveOffer } from './giveOffers'
import { listLog } from './log'

beforeEach(async () => {
  await db.characters.clear()
  await db.log.clear()
  await db.settings.clear()
})

async function setup() {
  const a = await saveCharacter(createCharacter({ name: 'Mira', inventory: [{ id: 'p', name: 'Potion of Healing', qty: 2 }] }))
  const b = await saveCharacter(createCharacter({ name: 'Gojo' }))
  return { a, b }
}

describe('give offers on the DM device', () => {
  it('an offer moves nothing until it is accepted; accepting moves it once and logs both sides', async () => {
    const { a, b } = await setup()
    await receiveGiveOffer('o1', 1, { fromId: a.id, toId: b.id, itemId: 'p', qty: 1 }, true)
    expect(await getGiveOffers()).toHaveLength(1)
    expect((await getCharacter(a.id))!.inventory[0].qty).toBe(2)
    // Accept sent twice at the same moment: only one move.
    const [x, y] = await Promise.all([acceptGiveOffer('o1'), acceptGiveOffer('o1')])
    expect([x, y]).toEqual([null, null])
    expect((await getCharacter(a.id))!.inventory[0].qty).toBe(1)
    expect((await getCharacter(b.id))!.inventory[0]).toMatchObject({ name: 'Potion of Healing', qty: 1 })
    expect(await getGiveOffers()).toEqual([])
    expect((await listLog(a.id)).filter((l) => l.text.startsWith('🤝'))).toHaveLength(1)
    expect((await listLog(b.id)).map((l) => l.text)).toContain('🤝 ได้รับ Potion of Healing จาก Mira')
  })

  it('refuses the accept when the sender no longer has it, and nothing moves', async () => {
    const { a, b } = await setup()
    await receiveGiveOffer('o1', 1, { fromId: a.id, toId: b.id, itemId: 'p', qty: 2 }, true)
    const sender = (await getCharacter(a.id))!
    await db.characters.put({ ...sender, inventory: [] })
    expect(await acceptGiveOffer('o1')).toMatch('ไม่มี')
    expect((await getCharacter(b.id))!.inventory).toEqual([])
    expect((await getGiveOffers())[0]).toMatchObject({ status: 'failed', atAccept: true })
  })

  it('decline / cancel removes the offer only when the asking device is allowed; clear empties all', async () => {
    const { a, b } = await setup()
    await receiveGiveOffer('o1', 1, { fromId: a.id, toId: b.id, itemId: 'p', qty: 1 }, true)
    expect(await removeGiveOffer('o1', (o) => o.toId === a.id)).toBe(false)
    expect(await getGiveOffers()).toHaveLength(1)
    expect(await removeGiveOffer('o1', (o) => o.toId === b.id)).toBe(true)
    expect(await getGiveOffers()).toEqual([])
    expect((await getCharacter(a.id))!.inventory[0].qty).toBe(2)
    await receiveGiveOffer('o2', 2, { fromId: a.id, toId: b.id, itemId: 'p', qty: 1 }, true)
    await clearGiveOffers()
    expect(await getGiveOffers()).toEqual([])
  })

  it('the same offer message arriving twice is listed once', async () => {
    const { a, b } = await setup()
    for (let n = 0; n < 2; n++) await receiveGiveOffer('o1', 1, { fromId: a.id, toId: b.id, itemId: 'p', qty: 1 }, true)
    expect(await getGiveOffers()).toHaveLength(1)
  })
})
