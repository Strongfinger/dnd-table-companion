// Pending party gives (offers) on the DM's device, saved in settings like the coin requests (model/giveOffer.ts).
// The DM's device is the only place an offer is applied: accepting moves the item or coins in one transaction, once.
import { db } from './db'
import { getCharacter, updateCharacter } from './characters'
import { logCharacterEvent } from './log'
import { change, read, watch } from './rewards'
import type { GiveRequest } from '../model/give'
import { acceptOffer, createOffer, removeOffer, type GiveOffer } from '../model/giveOffer'

const OFFERS = 'give-offers'

export const getGiveOffers = () => read<GiveOffer>(OFFERS)
export const watchGiveOffers = (onChange: (list: GiveOffer[]) => void) => watch<GiveOffer>(OFFERS, onChange)
const changeOffers = <R>(fn: (list: GiveOffer[]) => { list: GiveOffer[]; result: R }) => change<GiveOffer, R>(OFFERS, fn)

/** A player's offer reached the DM's device: list it (once). `receiverInRoom`: the receiver is played in the room now. */
export async function receiveGiveOffer(id: string, at: number, req: GiveRequest, receiverInRoom: boolean): Promise<void> {
  await db.transaction('rw', db.settings, db.characters, async () => {
    const from = await getCharacter(req.fromId)
    const to = await getCharacter(req.toId)
    await changeOffers((list) => ({ list: createOffer(list, id, at, req, from, to, receiverInRoom), result: undefined }))
  })
}

/**
 * The receiver accepted. Moves the item or coins once (a second accept finds no offer and does nothing).
 * Returns the reason (Thai) when it can't be done, else null.
 */
export async function acceptGiveOffer(id: string): Promise<string | null> {
  type Done = { error: string | null; log?: { fromId: string; toId: string; label: string; fromName: string; toName: string } }
  const result = await db.transaction('rw', db.settings, db.characters, async (): Promise<Done> => {
    const list = await getGiveOffers()
    const offer = list.find((o) => o.id === id)
    if (!offer) return { error: null }
    const r = acceptOffer(list, id, await getCharacter(offer.fromId), await getCharacter(offer.toId))
    if (r.list !== list) await db.settings.put({ key: OFFERS, value: r.list })
    if (r.kind === 'failed') return { error: r.reason }
    if (r.kind === 'none') return { error: null }
    await updateCharacter(r.from.id, () => ({ character: r.from, text: '' }))
    await updateCharacter(r.to.id, () => ({ character: r.to, text: '' }))
    return { error: null, log: { fromId: r.from.id, toId: r.to.id, label: r.label, fromName: r.from.name || 'เพื่อน', toName: r.to.name || 'เพื่อน' } }
  })
  if (result.log) {
    const l = result.log
    await logCharacterEvent(l.fromId, `🤝 ส่ง ${l.label} ให้ ${l.toName}`)
    await logCharacterEvent(l.toId, `🤝 ได้รับ ${l.label} จาก ${l.fromName}`)
  }
  return result.error
}

/**
 * Decline, cancel or close an offer: nothing moves. `may` says whether the asking device may remove this offer
 * (the receiver's device declines, the sender's cancels). Returns true when it was removed.
 */
export async function removeGiveOffer(id: string, may: (o: GiveOffer) => boolean): Promise<boolean> {
  return changeOffers((list) => {
    const offer = list.find((o) => o.id === id)
    return offer && may(offer) ? { list: removeOffer(list, id), result: true } : { list, result: false }
  })
}

/** The room ended: every offer goes away (the items never left their senders). */
export async function clearGiveOffers(): Promise<void> {
  await changeOffers((list) => ({ list: list.length ? [] : list, result: undefined }))
}
