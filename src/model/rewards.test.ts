import { describe, expect, it } from 'vitest'
import { createCharacter, EQUIP_SLOTS } from './character'
import { loadSrdEquipment } from './equipment'
import {
  addCustomItem, addCoinRequest, addToPool, applyCoinRequest, coinRequestLabel, decideCoinRequest, dmRunsEconomy, keepDmEconomy, KEEP_DECIDED, parseCoinRequestBody,
  parseCoinRequests, parsePool, parseTake, receivePoolItem, setPoolQty, takeFromPool, type CoinRequest,
  lootToPool, magicItemToCustom, magicItemWear,
} from './rewards'
import { MAX_ITEM_DESCRIPTION, toggleEquipped } from './inventory'
import type { LootItem } from './generators'

const hero = () => createCharacter({ name: 'Mira', coins: { cp: 0, sp: 0, ep: 0, gp: 5, pp: 0 } })

describe('reward pool', () => {
  it('adds items, stacking the same SRD item or the same custom item', () => {
    let pool = addToPool([], { name: 'Dagger', srdId: 'dagger', qty: 1 })
    pool = addToPool(pool, { name: 'Dagger', srdId: 'dagger', qty: 2 })
    pool = addToPool(pool, { name: 'Ring of the Old King', qty: 1, wear: 'ring1', weight: 0.1 })
    pool = addToPool(pool, { name: 'Ring of the Old King', qty: 1, wear: 'ring1', weight: 0.1 })
    pool = addToPool(pool, { name: 'Ring of the Old King', qty: 1 }) // no slot: another item
    expect(pool.map((p) => [p.name, p.qty])).toEqual([['Dagger', 3], ['Ring of the Old King', 2], ['Ring of the Old King', 1]])
    expect(addToPool(pool, { name: '  ', qty: 1 })).toBe(pool)
    expect(addToPool(pool, { name: 'Gem', qty: 0 })).toBe(pool)
  })

  it('takes what is left, and the item leaves the pool when none are left', () => {
    const pool = addToPool([], { name: 'Potion of Healing', qty: 2 })
    const id = pool[0].id
    const first = takeFromPool(pool, id, 1)
    expect(first.taken?.qty).toBe(1)
    expect(first.pool[0].qty).toBe(1)
    // Asked for 3, only 1 left: gets 1.
    const second = takeFromPool(first.pool, id, 3)
    expect(second.taken?.qty).toBe(1)
    expect(second.pool).toEqual([])
    // Already gone (someone else took it).
    expect(takeFromPool(second.pool, id, 1).taken).toBeNull()
    expect(takeFromPool(pool, id, 0).taken).toBeNull()
  })

  it('sets the number left (0 takes it out)', () => {
    const pool = addToPool([], { name: 'Gem', qty: 2 })
    expect(setPoolQty(pool, pool[0].id, 5)[0].qty).toBe(5)
    expect(setPoolQty(pool, pool[0].id, 0)).toEqual([])
  })

  it('puts taken items in the inventory: SRD items, packs (once per pack) and custom items', async () => {
    const data = await loadSrdEquipment()
    let c = receivePoolItem(hero(), { id: 'p1', name: 'Arrows', srdId: 'arrows', qty: 20 }, data)
    expect(c.inventory).toEqual([expect.objectContaining({ name: 'Arrows', srdId: 'arrows', qty: 20 })])
    c = receivePoolItem(c, { id: 'p2', name: "Burglar's Pack", srdId: 'burglars-pack', qty: 2 }, data)
    expect(c.inventory.find((i) => i.name === 'Candle')?.qty).toBe(20)
    c = receivePoolItem(c, { id: 'p3', name: 'Ring of the Old King', qty: 1, wear: 'ring1', weight: 0.5 }, data)
    expect(c.inventory.at(-1)).toMatchObject({ name: 'Ring of the Old King', qty: 1, wear: 'ring1', weight: 0.5 })
  })

  it('keeps a custom magic item\'s effect text from the pool to the sheet', async () => {
    const data = await loadSrdEquipment()
    let pool = addToPool([], { name: 'Cloak of Embers', qty: 1, wear: 'cloak', description: '  Resistance to Fire  ', summary: ' Fire Resistance ', magic: true })
    // Same name, different text: another item.
    pool = addToPool(pool, { name: 'Cloak of Embers', qty: 1, wear: 'cloak' })
    expect(pool).toHaveLength(2)
    expect(pool[0]).toMatchObject({ description: 'Resistance to Fire', summary: 'Fire Resistance', magic: true })
    expect(parsePool(JSON.parse(JSON.stringify({ items: pool })))).toEqual(pool)
    const c = receivePoolItem(hero(), pool[0], data)
    expect(c.inventory[0]).toMatchObject({ name: 'Cloak of Embers', wear: 'cloak', description: 'Resistance to Fire', summary: 'Fire Resistance', magic: true })
  })

  it('checks pool and take messages from the network', () => {
    const pool = addToPool([], { name: 'Dagger', srdId: 'dagger', qty: 2 })
    expect(parsePool(JSON.parse(JSON.stringify({ items: pool })))).toEqual(pool)
    expect(parsePool({ items: [{ id: 'x', name: 'Gem', qty: 0 }] })).toBeNull()
    expect(parsePool({ items: 'no' })).toBeNull()
    expect(parseTake({ characterId: 'c', itemId: 'p', qty: 2 })).toEqual({ characterId: 'c', itemId: 'p', qty: 2 })
    expect(parseTake({ characterId: 'c', itemId: 'p', qty: 1.5 })).toBeNull()
    expect(parseTake({ characterId: 'c', itemId: 'p', qty: 0 })).toBeNull()
  })
})

describe('addCustomItem', () => {
  it('adds the text to a new item, or to a stacked one that had none', () => {
    let c = addCustomItem(hero(), { name: 'Strange Coin', qty: 1 })
    c = addCustomItem(c, { name: 'Strange Coin', qty: 1, description: 'Glows near undead', magic: true })
    expect(c.inventory).toEqual([expect.objectContaining({ qty: 2, description: 'Glows near undead', magic: true })])
    // Already has text: kept.
    c = addCustomItem(c, { name: 'Strange Coin', qty: 1, description: 'Something else' })
    expect(c.inventory[0]).toMatchObject({ qty: 3, description: 'Glows near undead' })
  })
})

describe('coin requests', () => {
  const request = (id: string, over: Partial<CoinRequest> = {}): CoinRequest =>
    ({ id, characterId: 'c', characterName: 'Mira', kind: 'gain', coin: 'gp', amount: 50, note: '', at: 1, status: 'open', ...over })

  it('lists a request once, and only an open one can be decided', () => {
    let list = addCoinRequest([], request('a'))
    expect(addCoinRequest(list, request('a'))).toBe(list)
    list = decideCoinRequest(list, 'a', 'approved')
    expect(list[0].status).toBe('approved')
    expect(decideCoinRequest(list, 'a', 'rejected')[0].status).toBe('approved')
  })

  it('keeps every open request and only the latest decided ones', () => {
    let list: CoinRequest[] = []
    for (let i = 0; i < KEEP_DECIDED + 5; i++) list = addCoinRequest(list, request(`d${i}`, { status: 'rejected' }))
    list = addCoinRequest(list, request('open'))
    expect(list.filter((r) => r.status !== 'open')).toHaveLength(KEEP_DECIDED)
    expect(list.some((r) => r.id === 'open')).toBe(true)
    expect(list.some((r) => r.id === 'd0')).toBe(false)
  })

  it('applies an approved request; paying breaks bigger coins, and too much is refused', () => {
    expect(applyCoinRequest(hero(), { kind: 'gain', coin: 'gp', amount: 50 })?.coins.gp).toBe(55)
    expect(applyCoinRequest(hero(), { kind: 'spend', coin: 'sp', amount: 5 })?.coins).toMatchObject({ gp: 4, sp: 5 })
    expect(applyCoinRequest(hero(), { kind: 'spend', coin: 'gp', amount: 6 })).toBeNull()
  })

  it('labels requests in Thai', () => {
    expect(coinRequestLabel({ kind: 'gain', coin: 'gp', amount: 1500 })).toBe('รับ 1,500 GP')
    expect(coinRequestLabel({ kind: 'spend', coin: 'sp', amount: 5 })).toBe('จ่าย 5 SP')
  })

  it('checks request messages from the network', () => {
    expect(parseCoinRequestBody({ characterId: 'c', kind: 'spend', coin: 'gp', amount: 3, note: ' ค่าห้อง ' }))
      .toEqual({ characterId: 'c', kind: 'spend', coin: 'gp', amount: 3, note: 'ค่าห้อง' })
    expect(parseCoinRequestBody({ characterId: 'c', kind: 'steal', coin: 'gp', amount: 3 })).toBeNull()
    expect(parseCoinRequestBody({ characterId: 'c', kind: 'gain', coin: 'xp', amount: 3 })).toBeNull()
    expect(parseCoinRequestBody({ characterId: 'c', kind: 'gain', coin: 'gp', amount: -3 })).toBeNull()
    const list = [request('a'), request('b', { status: 'approved' })]
    expect(parseCoinRequests(JSON.parse(JSON.stringify({ requests: list })))).toEqual(list)
    expect(parseCoinRequests({ requests: [{ ...request('a'), status: 'maybe' }] })).toBeNull()
  })
})

describe('who runs items and coins', () => {
  const dmCampaign = { ownerDeviceId: 'dm-laptop' }
  it('a player in a room, or a character in another device\'s campaign: the DM does', () => {
    expect(dmRunsEconomy({ playedHereAsPlayer: true, campaign: undefined, myDeviceId: 'phone', playerInRoom: true })).toBe(true)
    expect(dmRunsEconomy({ playedHereAsPlayer: false, campaign: dmCampaign, myDeviceId: 'phone', playerInRoom: false })).toBe(true)
  })
  it('the DM\'s own device, or a character outside any campaign: free as before', () => {
    expect(dmRunsEconomy({ playedHereAsPlayer: false, campaign: dmCampaign, myDeviceId: 'dm-laptop', playerInRoom: false })).toBe(false)
    expect(dmRunsEconomy({ playedHereAsPlayer: false, campaign: undefined, myDeviceId: 'phone', playerInRoom: false })).toBe(false)
  })
})

describe('keepDmEconomy', () => {
  it('keeps the DM\'s coins; takes the player\'s items unless they have more than the DM\'s copy', () => {
    const dm = { ...hero(), inventory: [{ id: 'a', name: 'Dagger', qty: 2, srdId: 'dagger' }] }
    // Equipping one dagger splits the stack: same total, taken.
    const split = [{ id: 'a', name: 'Dagger', qty: 1, srdId: 'dagger' }, { id: 'b', name: 'Dagger', qty: 1, srdId: 'dagger', equipped: true }]
    const ok = keepDmEconomy(dm, { ...dm, coins: { ...dm.coins, gp: 900 }, inventory: split })
    expect(ok.coins.gp).toBe(5)
    expect(ok.inventory).toEqual(split)
    // The effect text and Magic Item mark stay the DM's.
    const ring = { id: 'r', name: 'Ring', qty: 1, description: '+1 AC', magic: true as const }
    const withRing = { ...dm, inventory: [ring] }
    expect(keepDmEconomy(withRing, { ...withRing, inventory: [{ id: 'r', name: 'My Ring', qty: 1, description: '+5 AC' }] }).inventory)
      .toEqual([{ id: 'r', name: 'My Ring', qty: 1, description: '+1 AC', magic: true }])
    const extra = keepDmEconomy(dm, { ...dm, inventory: [...dm.inventory, { id: 'z', name: 'Gem', qty: 1 }] })
    expect(extra.inventory).toEqual(dm.inventory)
  })
})

describe('SRD magic items as rewards', () => {
  const loot = (name: string, category: string, over: Partial<LootItem> = {}): LootItem =>
    ({ id: name.toLowerCase().replace(/\W+/g, '-'), name, category, rarity: 'Uncommon', attunement: false, desc: 'English text', ...over })

  it('picks the slot an SRD magic item is worn in', () => {
    expect(magicItemWear(loot('Adamantine Armor', 'Armor'))).toBe('body')
    expect(magicItemWear(loot('Shield +1', 'Armor'))).toBe('offHand')
    expect(magicItemWear(loot('Flame Tongue', 'Weapons'))).toBe('mainHand')
    expect(magicItemWear(loot('Ring of Protection', 'Rings'))).toBe('ring1')
    expect(magicItemWear(loot('Cloak of Protection', 'Wondrous Items'))).toBe('cloak')
    expect(magicItemWear(loot('Amulet of Health', 'Wondrous Items'))).toBe('neck')
    expect(magicItemWear(loot('Boots of Speed', 'Wondrous Items'))).toBe('feet')
    expect(magicItemWear(loot('Gauntlets of Ogre Power', 'Wondrous Items'))).toBe('hands')
    expect(magicItemWear(loot('Helm of Telepathy', 'Wondrous Items'))).toBe('head')
    expect(magicItemWear(loot('Belt of Giant Strength', 'Wondrous Items'))).toBe('waist')
    expect(magicItemWear(loot('Bag of Holding', 'Wondrous Items'))).toBe('back')
    expect(magicItemWear(loot('Potion of Healing', 'Potions'))).toBeUndefined()
    expect(magicItemWear(loot('Bag of Tricks', 'Wondrous Items'))).toBeUndefined()
  })

  it('puts Adamantine Armor in the pool, and a player can take it and wear it', async () => {
    const data = await loadSrdEquipment()
    const armor = loot('Adamantine Armor', 'Armor', { desc: 'Critical Hits become normal hits.' })
    const custom = magicItemToCustom(armor, '  ข้อความภาษาไทย ')
    expect(custom).toEqual({ name: 'Adamantine Armor', qty: 1, wear: 'body', magic: true, description: '*Uncommon*\n\nข้อความภาษาไทย' })
    expect(magicItemToCustom(armor, undefined, 'สรุปสั้น').summary).toBe('สรุปสั้น')
    expect(magicItemToCustom(loot('Ring of X', 'Rings', { attunement: true, desc: 'x'.repeat(3000) })).description).toHaveLength(MAX_ITEM_DESCRIPTION)
    const { magic, ...rest } = custom
    const pool = addToPool([], { ...rest, ...(magic ? { magic: true as const } : {}) })
    expect(pool[0]).toMatchObject({ name: 'Adamantine Armor', wear: 'body', magic: true })
    let c = receivePoolItem(createCharacter({ name: 'Mira' }), takeFromPool(pool, pool[0].id, 1).taken!, data)
    c = toggleEquipped(c, c.inventory[0].id, data)
    expect(c.inventory[0]).toMatchObject({ name: 'Adamantine Armor', equipped: true, slot: 'body', magic: true })
    // Every SRD magic item gets valid text, and only real slots.
    const all = (await import('../data/srd-magic-items.json')).default as LootItem[]
    for (const i of all) {
      const ci = magicItemToCustom(i)
      expect(ci.description!.length).toBeGreaterThan(10)
      if (ci.wear) expect(EQUIP_SLOTS).toContain(ci.wear)
    }
  })
})

describe('lootToPool', () => {
  it('puts the rolled valuables and magic items in the pool; the same gem twice stacks', () => {
    const scroll: LootItem = { id: 'spell-scroll-common', name: 'Spell Scroll (Cantrip or Level 1)', rarity: 'Common', category: 'Wondrous Items', attunement: false, desc: 'Scroll text' }
    const loot = { valuables: [{ value: 10, text: 'หินโมรา' }, { value: 10, text: 'หินโมรา' }], items: [scroll] }
    const list = lootToPool(loot, { 'spell-scroll-common': { text: 'ข้อความไทย' } }, { 'spell-scroll-common': { summary: 'สรุป' } })
    expect(list).toEqual([
      { name: 'หินโมรา (10 gp)', qty: 1, description: 'ของมีค่า ขายได้ประมาณ 10 gp' },
      { name: 'หินโมรา (10 gp)', qty: 1, description: 'ของมีค่า ขายได้ประมาณ 10 gp' },
      { name: 'Spell Scroll (Cantrip or Level 1)', qty: 1, description: '*Common*\n\nข้อความไทย', summary: 'สรุป', magic: true },
    ])
    const pool = list.reduce(addToPool, [] as ReturnType<typeof addToPool>)
    expect(pool.map((p) => [p.name, p.qty])).toEqual([['หินโมรา (10 gp)', 2], ['Spell Scroll (Cantrip or Level 1)', 1]])
    expect(lootToPool({ valuables: [], items: [] })).toEqual([])
  })
})
