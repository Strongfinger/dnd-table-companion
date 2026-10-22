// Party give with accept (Phase 3): in a live room, giving does not move anything. It makes an OFFER on the DM's
// device; the receiver taps accept or decline, the sender can cancel. The DM's device moves the item or coins when
// the receiver accepts (once only) and only if the sender still has it. Offers never expire: they stay until
// accepted, declined, cancelled or the room ends. Pure functions; src/db/giveOffers.ts saves them.
import type { Character } from './character'
import { giftLabel, giveCoins, giveItem, parseGive, type GiveRequest } from './give'
import { COINS } from './rewards'
import { spendCoins, type Coin } from '../rules'

export interface GiveOffer {
  /** The sender's message id (so an offer sent again is only listed once). */
  id: string
  fromId: string
  fromName: string
  toId: string
  toName: string
  /** What is on offer: an item (by id in the sender's pack, with its name for the screens) or coins. */
  gift: { kind: 'item'; itemId: string; name: string; qty: number } | { kind: 'coins'; coin: Coin; amount: number }
  at: number
  /** open = waiting for the receiver; failed = could not be done (see `reason`), stays until someone closes it. */
  status: 'open' | 'failed'
  reason?: string
  /** Failed when the receiver accepted (so the receiver is told too), not when the offer was made. */
  atAccept?: boolean
}

/** Open offers one sender can have at once, and offers kept in total (spam guard). */
export const MAX_OPEN_PER_SENDER = 10
const MAX_OFFERS = 60

/** "Potion of Healing ×2" / "50 GP" */
export function offerLabel(o: Pick<GiveOffer, 'gift'>): string {
  return giftLabel(o.gift.kind === 'item' ? { kind: 'item', name: o.gift.name, qty: o.gift.qty } : o.gift)
}

/** Why this sender can't give this right now (Thai), or null when they can. */
export function senderProblem(from: Character | undefined, gift: GiveOffer['gift']): string | null {
  if (!from) return 'ไม่พบตัวละครผู้ส่ง'
  const who = from.name || 'ผู้ส่ง'
  if (gift.kind === 'coins') return spendCoins(from.coins, gift.coin, gift.amount) ? null : `${who} มีเงินไม่พอ`
  const item = from.inventory.find((i) => i.id === gift.itemId)
  if (!item) return `${who} ไม่มี ${gift.name} แล้ว`
  if (item.equipped || item.slot) return `${gift.name} ถูกสวมใส่อยู่ (ต้องถอดก่อน)`
  if (item.qty < gift.qty) return `${who} เหลือ ${gift.name} ไม่ถึง ${gift.qty} ชิ้น`
  return null
}

/**
 * A player's offer reached the DM's device. Listed as open; or as failed (with the reason) when the receiver isn't
 * played in the room, the sender doesn't have it, or the sender has too many open offers. Sent again = unchanged.
 */
export function createOffer(
  list: GiveOffer[], id: string, at: number, req: GiveRequest, from: Character | undefined, to: Character | undefined, receiverInRoom: boolean,
): GiveOffer[] {
  if (list.some((o) => o.id === id)) return list
  const item = 'itemId' in req ? from?.inventory.find((i) => i.id === req.itemId) : undefined
  const gift: GiveOffer['gift'] = 'itemId' in req
    ? { kind: 'item', itemId: req.itemId, name: item?.name ?? '?', qty: req.qty }
    : { kind: 'coins', coin: req.coin, amount: req.amount }
  const base = { id, fromId: req.fromId, fromName: from?.name || 'เพื่อน', toId: req.toId, toName: to?.name || 'เพื่อน', gift, at }
  const tooMany = list.filter((o) => o.fromId === req.fromId && o.status === 'open').length >= MAX_OPEN_PER_SENDER
  const reason = req.fromId === req.toId ? 'ส่งให้ตัวเองไม่ได้'
    : !receiverInRoom || !to ? `${base.toName} ไม่ได้อยู่ในห้อง`
    : tooMany ? 'มีของรอเพื่อนรับเยอะเกินไป (ยกเลิกบางอันก่อน)'
    : senderProblem(from, gift)
  const offer: GiveOffer = reason ? { ...base, status: 'failed', reason } : { ...base, status: 'open' }
  return [...list, offer].slice(-MAX_OFFERS)
}

export type AcceptResult =
  | { kind: 'none'; list: GiveOffer[] } // no such open offer (already handled, e.g. accept sent twice): nothing happens
  | { kind: 'failed'; list: GiveOffer[]; reason: string } // the sender can't give it any more: the offer is marked failed
  | { kind: 'done'; list: GiveOffer[]; from: Character; to: Character; label: string }

/** The receiver accepted: move it, once. The offer leaves the list when it went across. */
export function acceptOffer(list: GiveOffer[], id: string, from: Character | undefined, to: Character | undefined): AcceptResult {
  const offer = list.find((o) => o.id === id)
  if (!offer || offer.status !== 'open') return { kind: 'none', list }
  const fail = (reason: string): AcceptResult => ({ kind: 'failed', reason, list: list.map((o) => (o === offer ? { ...o, status: 'failed', reason, atAccept: true } : o)) })
  if (!to) return fail(`${offer.toName} ไม่อยู่ในเครื่องนี้`)
  const problem = senderProblem(from, offer.gift)
  if (problem || !from) return fail(problem ?? 'ไม่พบตัวละครผู้ส่ง')
  const g = offer.gift
  const done = g.kind === 'item' ? giveItem(from, to, g.itemId, g.qty) : giveCoins(from, to, g.coin, g.amount)
  if (!done) return fail('ส่งไม่ได้ (กระเป๋าผู้รับเต็ม)')
  return { kind: 'done', list: list.filter((o) => o !== offer), from: done.from, to: done.to, label: giftLabel(done.gift) }
}

/** Decline (receiver), cancel (sender) or close a failed one: the offer is gone, nothing moves. */
export function removeOffer(list: GiveOffer[], id: string): GiveOffer[] {
  return list.some((o) => o.id === id) ? list.filter((o) => o.id !== id) : list
}

/** Offers waiting for me (open, to one of my characters). */
export const incomingOffers = (list: GiveOffer[], mine: string[]) => list.filter((o) => mine.includes(o.toId) && o.status === 'open')
/** Offers I made (open or failed), optionally only from one character. */
export const outgoingOffers = (list: GiveOffer[], mine: string[], characterId?: string) =>
  list.filter((o) => mine.includes(o.fromId) && (!characterId || o.fromId === characterId))
/** Offers that failed when I accepted them (so the receiver is told why nothing arrived). */
export const failedForReceiver = (list: GiveOffer[], mine: string[]) => list.filter((o) => mine.includes(o.toId) && o.status === 'failed' && o.atAccept)

/** A body that is only an offer id (accept / decline / cancel messages). Null = invalid. */
export function parseOfferId(body: unknown): string | null {
  const v = typeof body === 'object' && body !== null ? (body as Record<string, unknown>).offerId : null
  return typeof v === 'string' && v.length > 0 && v.length <= 64 ? v : null
}

/** A player's 'giveOffer' message body: the same shape as a give request. */
export const parseOfferBody = parseGive

/** The offers list from the DM (network data). Null = invalid. */
export function parseGiveOffers(body: unknown): GiveOffer[] | null {
  const list = typeof body === 'object' && body !== null ? (body as Record<string, unknown>).offers : null
  if (!Array.isArray(list) || list.length > MAX_OFFERS) return null
  const out: GiveOffer[] = []
  const text = (v: unknown) => (typeof v === 'string' && v.length > 0 && v.length <= 64 ? v : null)
  for (const x of list) {
    const o = (x ?? {}) as Record<string, unknown>
    const g = (o.gift ?? {}) as Record<string, unknown>
    const id = text(o.id), fromId = text(o.fromId), toId = text(o.toId)
    if (!id || !fromId || !toId || !Number.isFinite(o.at) || (o.status !== 'open' && o.status !== 'failed')) return null
    const gift: GiveOffer['gift'] | null = g.kind === 'item' && text(g.itemId) && typeof g.name === 'string' && Number.isInteger(g.qty) && (g.qty as number) >= 1
      ? { kind: 'item', itemId: g.itemId as string, name: (g.name as string).slice(0, 100), qty: g.qty as number }
      : g.kind === 'coins' && COINS.includes(g.coin as Coin) && Number.isInteger(g.amount) && (g.amount as number) >= 1
        ? { kind: 'coins', coin: g.coin as Coin, amount: g.amount as number }
        : null
    if (!gift) return null
    out.push({
      id, fromId, toId, gift, at: o.at as number, status: o.status,
      fromName: typeof o.fromName === 'string' ? o.fromName.slice(0, 100) : '',
      toName: typeof o.toName === 'string' ? o.toName.slice(0, 100) : '',
      ...(typeof o.reason === 'string' ? { reason: o.reason.slice(0, 160) } : {}),
      ...(o.atAccept === true ? { atAccept: true } : {}),
    })
  }
  return out
}
