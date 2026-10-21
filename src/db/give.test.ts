import 'fake-indexeddb/auto'
import { beforeEach, describe, expect, it } from 'vitest'
import { createCharacter } from '../model/character'
import { getCharacter, saveCharacter } from './characters'
import { db } from './db'
import { giveNow } from './give'
import { listLog } from './log'

beforeEach(async () => {
  await db.characters.clear()
  await db.log.clear()
})

describe('giveNow', () => {
  it('moves an item between two saved characters and logs it on both', async () => {
    const a = await saveCharacter(createCharacter({ name: 'Mira', inventory: [{ id: 'p', name: 'Potion of Healing', qty: 2 }] }))
    const b = await saveCharacter(createCharacter({ name: 'Gojo' }))
    expect(await giveNow({ fromId: a.id, toId: b.id, itemId: 'p', qty: 1 })).toBeNull()
    expect((await getCharacter(a.id))!.inventory[0].qty).toBe(1)
    expect((await getCharacter(b.id))!.inventory[0]).toMatchObject({ name: 'Potion of Healing', qty: 1 })
    expect((await listLog(a.id)).map((l) => l.text)).toContain('🤝 ส่ง Potion of Healing ให้ Gojo')
    expect((await listLog(b.id)).map((l) => l.text)).toContain('🤝 ได้รับ Potion of Healing จาก Mira')
  })

  it('says why when it cannot (not enough coins, item gone, character missing) and changes nothing', async () => {
    const a = await saveCharacter(createCharacter({ name: 'Mira', coins: { cp: 0, sp: 0, ep: 0, gp: 1, pp: 0 } }))
    const b = await saveCharacter(createCharacter({ name: 'Gojo' }))
    expect(await giveNow({ fromId: a.id, toId: b.id, coin: 'gp', amount: 5 })).toMatch('เงินไม่พอ')
    expect(await giveNow({ fromId: a.id, toId: b.id, itemId: 'gone', qty: 1 })).toMatch('ส่งไม่ได้')
    expect(await giveNow({ fromId: a.id, toId: 'nobody', coin: 'gp', amount: 1 })).toMatch('ไม่พบ')
    expect((await getCharacter(a.id))!.coins.gp).toBe(1)
    expect(await giveNow({ fromId: a.id, toId: b.id, coin: 'gp', amount: 1 })).toBeNull()
    expect((await getCharacter(b.id))!.coins.gp).toBe(1)
  })
})
