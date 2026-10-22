import { describe, expect, it } from 'vitest'
import { createCharacter, type InventoryItem } from './character'
import type { GiveRequest } from './give'
import {
  MAX_OPEN_PER_SENDER, acceptOffer, createOffer, failedForReceiver, incomingOffers, offerLabel, outgoingOffers, parseGiveOffers, parseOfferId, removeOffer,
  type GiveOffer,
} from './giveOffer'

const item = (o: Partial<InventoryItem> & { name: string }): InventoryItem => ({ id: crypto.randomUUID(), qty: 1, ...o })
const potion = item({ name: 'Potion of Healing', qty: 3 })
const mira = createCharacter({ name: 'Mira', inventory: [potion], coins: { cp: 0, sp: 0, ep: 0, gp: 50, pp: 0 } })
const gojo = createCharacter({ name: 'Gojo' })
const itemReq = (qty = 2): GiveRequest => ({ fromId: mira.id, toId: gojo.id, itemId: potion.id, qty })
const coinReq: GiveRequest = { fromId: mira.id, toId: gojo.id, coin: 'gp', amount: 20 }
const open = (list: GiveOffer[]) => list.filter((o) => o.status === 'open')

describe('making an offer', () => {
  it('lists an open offer and moves nothing', () => {
    const list = createOffer([], 'm1', 100, itemReq(), mira, gojo, true)
    expect(list).toHaveLength(1)
    expect(list[0]).toMatchObject({ id: 'm1', status: 'open', fromName: 'Mira', toName: 'Gojo', gift: { kind: 'item', name: 'Potion of Healing', qty: 2 } })
    expect(offerLabel(list[0])).toBe('Potion of Healing ×2')
    expect(mira.inventory[0].qty).toBe(3)
  })

  it('lists a coin offer', () => {
    const list = createOffer([], 'm1', 100, coinReq, mira, gojo, true)
    expect(list[0]).toMatchObject({ status: 'open', gift: { kind: 'coins', coin: 'gp', amount: 20 } })
    expect(offerLabel(list[0])).toBe('20 GP')
  })

  it('the same message sent twice is listed once', () => {
    const once = createOffer([], 'm1', 100, itemReq(), mira, gojo, true)
    expect(createOffer(once, 'm1', 200, itemReq(), mira, gojo, true)).toBe(once)
  })

  it('is failed (not open) when the receiver is not in the room, kicked or missing', () => {
    expect(createOffer([], 'm1', 1, itemReq(), mira, gojo, false)[0]).toMatchObject({ status: 'failed', reason: 'Gojo ไม่ได้อยู่ในห้อง' })
    expect(createOffer([], 'm1', 1, itemReq(), mira, undefined, true)[0].status).toBe('failed')
  })

  it('is failed when the sender lacks the item, has too few, wears it, or lacks the coins', () => {
    const worn = item({ name: 'Ring', equipped: true, slot: 'ring1' })
    const a = { ...mira, inventory: [...mira.inventory, worn] }
    expect(createOffer([], 'm1', 1, { ...itemReq(), itemId: 'nope' }, a, gojo, true)[0].status).toBe('failed')
    expect(createOffer([], 'm1', 1, itemReq(4), a, gojo, true)[0].status).toBe('failed')
    expect(createOffer([], 'm1', 1, { ...itemReq(), itemId: worn.id, qty: 1 }, a, gojo, true)[0].status).toBe('failed')
    expect(createOffer([], 'm1', 1, { ...coinReq, amount: 51 }, a, gojo, true)[0].status).toBe('failed')
  })

  it('refuses giving to oneself', () => {
    expect(createOffer([], 'm1', 1, { ...itemReq(), toId: mira.id }, mira, mira, true)[0].status).toBe('failed')
  })

  it('stops a sender from piling up offers', () => {
    let list: GiveOffer[] = []
    for (let n = 0; n < MAX_OPEN_PER_SENDER + 3; n++) list = createOffer(list, `m${n}`, n, itemReq(1), mira, gojo, true)
    expect(open(list)).toHaveLength(MAX_OPEN_PER_SENDER)
  })
})

describe('accepting', () => {
  const list = createOffer([], 'm1', 1, itemReq(), mira, gojo, true)

  it('moves the item once, and the offer is gone', () => {
    const r = acceptOffer(list, 'm1', mira, gojo)
    if (r.kind !== 'done') throw new Error('expected done')
    expect(r.list).toEqual([])
    expect(r.from.inventory[0].qty).toBe(1)
    expect(r.to.inventory[0]).toMatchObject({ name: 'Potion of Healing', qty: 2 })
    expect(r.label).toBe('Potion of Healing ×2')
    // Accept sent twice: the second finds no offer and changes nothing.
    expect(acceptOffer(r.list, 'm1', r.from, r.to)).toEqual({ kind: 'none', list: [] })
  })

  it('moves coins (breaking a bigger coin like paying)', () => {
    const r = acceptOffer(createOffer([], 'c1', 1, coinReq, mira, gojo, true), 'c1', mira, gojo)
    if (r.kind !== 'done') throw new Error('expected done')
    expect(r.from.coins.gp).toBe(30)
    expect(r.to.coins.gp).toBe(20)
  })

  it('refuses when the sender spent or removed the item meanwhile, and keeps the offer as failed', () => {
    const spent = { ...mira, inventory: [{ ...potion, qty: 1 }] }
    const r = acceptOffer(list, 'm1', spent, gojo)
    expect(r.kind).toBe('failed')
    expect(r.list[0]).toMatchObject({ status: 'failed', atAccept: true })
    // A failed offer can't be accepted later.
    expect(acceptOffer(r.list, 'm1', mira, gojo).kind).toBe('none')
    expect(acceptOffer(list, 'm1', { ...mira, inventory: [] }, gojo).kind).toBe('failed')
  })

  it('refuses when the sender no longer has the coins', () => {
    const l = createOffer([], 'c1', 1, coinReq, mira, gojo, true)
    expect(acceptOffer(l, 'c1', { ...mira, coins: { cp: 0, sp: 0, ep: 0, gp: 5, pp: 0 } }, gojo).kind).toBe('failed')
  })

  it('refuses when a character is missing, and ignores an unknown offer', () => {
    expect(acceptOffer(list, 'm1', undefined, gojo).kind).toBe('failed')
    expect(acceptOffer(list, 'm1', mira, undefined).kind).toBe('failed')
    expect(acceptOffer(list, 'zzz', mira, gojo).kind).toBe('none')
  })

  it('refuses when the receiver already holds 9999 of it', () => {
    const full = { ...gojo, inventory: [{ ...potion, id: 'x', qty: 9999 }] }
    expect(acceptOffer(list, 'm1', mira, full).kind).toBe('failed')
  })
})

describe('decline, cancel, close', () => {
  it('removes the offer and changes nothing else; unknown ids do nothing', () => {
    const list = createOffer(createOffer([], 'a', 1, itemReq(1), mira, gojo, true), 'b', 2, coinReq, mira, gojo, true)
    expect(removeOffer(list, 'a').map((o) => o.id)).toEqual(['b'])
    expect(removeOffer(list, 'zzz')).toBe(list)
  })
})

describe('who sees what', () => {
  const list = [
    ...createOffer([], 'a', 1, itemReq(1), mira, gojo, true),
    ...createOffer([], 'b', 2, itemReq(9), mira, gojo, true), // failed at making
  ]
  it('the receiver sees only open offers to them; the sender sees theirs (open and failed)', () => {
    expect(incomingOffers(list, [gojo.id]).map((o) => o.id)).toEqual(['a'])
    expect(incomingOffers(list, [mira.id])).toEqual([])
    expect(outgoingOffers(list, [mira.id]).map((o) => o.id)).toEqual(['a', 'b'])
    expect(outgoingOffers(list, [mira.id], 'other')).toEqual([])
    expect(failedForReceiver(list, [gojo.id])).toEqual([])
  })
  it('the receiver is told when an accept failed', () => {
    const r = acceptOffer(list, 'a', { ...mira, inventory: [] }, gojo)
    expect(failedForReceiver(r.list, [gojo.id]).map((o) => o.id)).toEqual(['a'])
  })
})

describe('parsing network data', () => {
  it('reads an offer id', () => {
    expect(parseOfferId({ offerId: 'abc' })).toBe('abc')
    for (const bad of [null, {}, { offerId: '' }, { offerId: 5 }, { offerId: 'x'.repeat(65) }]) expect(parseOfferId(bad)).toBeNull()
  })

  it('round-trips the DM list and rejects broken data', () => {
    const list = createOffer(createOffer([], 'a', 1, itemReq(1), mira, gojo, true), 'b', 2, coinReq, mira, gojo, true)
    expect(parseGiveOffers({ offers: JSON.parse(JSON.stringify(list)) })).toEqual(list)
    expect(parseGiveOffers(null)).toBeNull()
    expect(parseGiveOffers({ offers: 'x' })).toBeNull()
    expect(parseGiveOffers({ offers: [{ ...list[0], status: 'done' }] })).toBeNull()
    expect(parseGiveOffers({ offers: [{ ...list[0], gift: { kind: 'item', itemId: 'i', name: 'x', qty: 0 } }] })).toBeNull()
    expect(parseGiveOffers({ offers: [{ ...list[1], gift: { kind: 'coins', coin: 'zz', amount: 3 } }] })).toBeNull()
    expect(parseGiveOffers({ offers: Array.from({ length: 61 }, () => list[0]) })).toBeNull()
  })
})
