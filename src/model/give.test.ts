import { describe, expect, it } from 'vitest'
import { createCharacter, type InventoryItem } from './character'
import { giftLabel, giveCoins, giveItem, parseGive } from './give'
import { MAX_ITEM_IMAGES } from './itemImage'

const item = (o: Partial<InventoryItem> & { name: string }): InventoryItem => ({ id: crypto.randomUUID(), qty: 1, ...o })
const pic = 'data:image/webp;base64,AAAA'

describe('giving an item', () => {
  it('moves some of a stack: the giver keeps the rest, the receiver gets a new entry', () => {
    const potion = item({ name: 'Potion of Healing', qty: 3, srdId: 'potion-of-healing' })
    const a = createCharacter({ name: 'Mira', inventory: [potion] })
    const b = createCharacter({ name: 'Gojo' })
    const r = giveItem(a, b, potion.id, 2)!
    expect(r.from.inventory).toEqual([{ ...potion, qty: 1 }])
    expect(r.to.inventory).toHaveLength(1)
    expect(r.to.inventory[0]).toMatchObject({ name: 'Potion of Healing', qty: 2, srdId: 'potion-of-healing' })
    expect(r.to.inventory[0].id).not.toBe(potion.id)
    expect(r.gift).toEqual({ kind: 'item', name: 'Potion of Healing', qty: 2 })
  })

  it('gives all when asked for more than there is, and the item leaves the giver', () => {
    const rope = item({ name: 'Rope', qty: 1 })
    const a = createCharacter({ inventory: [rope] })
    const r = giveItem(a, createCharacter(), rope.id, 5)!
    expect(r.from.inventory).toEqual([])
    expect(r.to.inventory[0].qty).toBe(1)
  })

  it('stacks on the same item the receiver already has', () => {
    const arrows = item({ name: 'Arrows', qty: 20, srdId: 'arrows' })
    const theirs = item({ name: 'Arrows', qty: 5, srdId: 'arrows' })
    const r = giveItem(createCharacter({ inventory: [arrows] }), createCharacter({ inventory: [theirs] }), arrows.id, 10)!
    expect(r.to.inventory).toEqual([{ ...theirs, qty: 15 }])
  })

  it('keeps a custom item as it is: name, slot, weight, effect text, Magic Item mark and picture', () => {
    const ring = item({ name: 'Ring of the Old King', wear: 'ring1', weight: 0.1, description: '+1 AC', magic: true, image: pic })
    const r = giveItem(createCharacter({ inventory: [ring] }), createCharacter(), ring.id, 1)!
    const { id: _id, ...rest } = ring
    expect(r.to.inventory[0]).toMatchObject(rest)
  })

  it('leaves the picture behind when the receiver already has the most pictures', () => {
    const ring = item({ name: 'Ring', image: pic })
    const full = Array.from({ length: MAX_ITEM_IMAGES }, (_, n) => item({ name: `Gem ${n}`, image: pic }))
    const r = giveItem(createCharacter({ inventory: [ring] }), createCharacter({ inventory: full }), ring.id, 1)!
    expect(r.to.inventory.at(-1)?.image).toBeUndefined()
  })

  it('refuses a worn or held item, a missing one, giving to oneself, and less than 1', () => {
    const sword = item({ name: 'Longsword', srdId: 'longsword', equipped: true, slot: 'mainHand' })
    const gem = item({ name: 'Gem' })
    const a = createCharacter({ inventory: [sword, gem] })
    const b = createCharacter()
    expect(giveItem(a, b, sword.id, 1)).toBeNull()
    expect(giveItem(a, b, 'nope', 1)).toBeNull()
    expect(giveItem(a, a, gem.id, 1)).toBeNull()
    expect(giveItem(a, b, gem.id, 0)).toBeNull()
  })

  it('does not stack past 9999 (sends only what fits)', () => {
    const mine = item({ name: 'Ball Bearings', qty: 10 })
    const theirs = item({ name: 'Ball Bearings', qty: 9995 })
    const r = giveItem(createCharacter({ inventory: [mine] }), createCharacter({ inventory: [theirs] }), mine.id, 10)!
    expect(r.to.inventory[0].qty).toBe(9999)
    expect(r.from.inventory[0].qty).toBe(6)
    const fullTo = createCharacter({ inventory: [{ ...theirs, qty: 9999 }] })
    expect(giveItem(createCharacter({ inventory: [mine] }), fullTo, mine.id, 1)).toBeNull()
  })
})

describe('giving coins', () => {
  const coins = (gp: number, sp = 0) => ({ cp: 0, sp, ep: 0, gp, pp: 0 })

  it('moves coins of one kind', () => {
    const r = giveCoins(createCharacter({ coins: coins(10) }), createCharacter({ coins: coins(1) }), 'gp', 4)!
    expect(r.from.coins.gp).toBe(6)
    expect(r.to.coins.gp).toBe(5)
    expect(r.gift).toEqual({ kind: 'coins', coin: 'gp', amount: 4 })
  })

  it('breaks a bigger coin and gives change, like paying', () => {
    const r = giveCoins(createCharacter({ coins: coins(1) }), createCharacter(), 'sp', 3)!
    expect(r.to.coins.sp).toBe(3)
    expect(r.from.coins).toMatchObject({ gp: 0, sp: 7 })
  })

  it('refuses when the giver cannot pay, or to oneself', () => {
    const a = createCharacter({ coins: coins(2) })
    expect(giveCoins(a, createCharacter(), 'gp', 3)).toBeNull()
    expect(giveCoins(a, a, 'gp', 1)).toBeNull()
    expect(giveCoins(a, createCharacter(), 'gp', 0)).toBeNull()
  })
})

describe('give messages', () => {
  it('reads an item or a coin gift and refuses anything else', () => {
    expect(parseGive({ fromId: 'a', toId: 'b', itemId: 'i', qty: 2 })).toEqual({ fromId: 'a', toId: 'b', itemId: 'i', qty: 2 })
    expect(parseGive({ fromId: 'a', toId: 'b', coin: 'gp', amount: 50 })).toEqual({ fromId: 'a', toId: 'b', coin: 'gp', amount: 50 })
    expect(parseGive({ fromId: 'a', toId: 'a', itemId: 'i', qty: 1 })).toBeNull()
    expect(parseGive({ fromId: 'a', toId: 'b', itemId: 'i', qty: 0 })).toBeNull()
    expect(parseGive({ fromId: 'a', toId: 'b', itemId: 'i', qty: 1.5 })).toBeNull()
    expect(parseGive({ fromId: 'a', toId: 'b', coin: 'xp', amount: 1 })).toBeNull()
    expect(parseGive({ toId: 'b', itemId: 'i', qty: 1 })).toBeNull()
    expect(parseGive(null)).toBeNull()
  })

  it('labels gifts', () => {
    expect(giftLabel({ kind: 'item', name: 'Rope', qty: 1 })).toBe('Rope')
    expect(giftLabel({ kind: 'item', name: 'Arrows', qty: 20 })).toBe('Arrows ×20')
    expect(giftLabel({ kind: 'coins', coin: 'gp', amount: 1500 })).toBe('1,500 GP')
  })
})
