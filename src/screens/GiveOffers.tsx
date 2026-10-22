// Party give with accept (model/giveOffer.ts), the player's side of the screens:
// - GiveOfferNotice: on every page, offers made to my characters (รับ / ไม่รับ) and gives that failed.
// - WaitingMarks: "🤝 รอ X รับ" under an item (or the coin purse) I offered, with a cancel button.
// Everything is read from the DM's device through the lobby (nothing moves here); the buttons send answers.
import { useState } from 'react'
import { useLobby } from '../app/useLobby'
import { failedForReceiver, incomingOffers, offerLabel, outgoingOffers, type GiveOffer } from '../model/giveOffer'
import { Button } from '../ui/kit'

/** My side of the offers: all in the room, and the answer button. */
function useOffers() {
  const lobby = useLobby()
  const inRoom = lobby.session?.role === 'player'
  const mine = inRoom ? lobby.myCharacterIds : []
  return { offers: inRoom ? lobby.giveOffers : [], mine, answer: lobby.answerOffer, online: lobby.status === 'connected' }
}

/** Incoming offers and failed gives, as a small notice at the top of every page. */
export function GiveOfferNotice() {
  const { offers, mine, answer, online } = useOffers()
  // Offers I just answered, hidden until the DM's list catches up (so a second tap can't happen).
  const [answered, setAnswered] = useState<string[]>([])
  const incoming = incomingOffers(offers, mine).filter((o) => !answered.includes(o.id))
  // Failed gives: the ones I made (any reason) and the ones I tried to accept. A failed offer is closed with ปิด.
  const failed = [...outgoingOffers(offers, mine).filter((o) => o.status === 'failed'), ...failedForReceiver(offers, mine)]
    .filter((o, i, all) => all.findIndex((x) => x.id === o.id) === i && !answered.includes(o.id))
  if (incoming.length === 0 && failed.length === 0) return null

  const respond = (o: GiveOffer, a: 'accept' | 'decline' | 'cancel') => {
    answer(o.id, a)
    setAnswered((old) => [...old, o.id])
  }
  return (
    <div className="mx-auto max-w-xl space-y-2 px-4 pt-3" role="region" aria-label="ของที่เพื่อนส่งมา">
      {incoming.map((o) => (
        <div key={o.id} className="rounded-xl border-2 border-amber-500 bg-amber-950/60 p-3">
          <p className="text-sm"><b className="text-amber-300">🤝 {o.fromName || 'เพื่อน'}</b> อยากส่งให้ <b>{o.toName || 'คุณ'}</b></p>
          <p className="my-1 text-lg font-bold">{offerLabel(o)}</p>
          <div className="flex gap-2">
            <Button variant="primary" className="min-h-11 flex-1 text-sm" onClick={() => respond(o, 'accept')}>รับ</Button>
            <Button className="min-h-11 flex-1 text-sm" onClick={() => respond(o, 'decline')}>ไม่รับ</Button>
          </div>
          {!online && <p className="mt-1 text-xs text-stone-400">ตอนนี้ไม่ได้ต่อเน็ต คำตอบจะถูกส่งเมื่อกลับมาออนไลน์</p>}
        </div>
      ))}
      {failed.map((o) => (
        <div key={o.id} className="flex items-start gap-2 rounded-xl border border-red-700 bg-red-950/50 p-3 text-sm">
          <p className="min-w-0 flex-1">
            🤝 ส่ง <b>{offerLabel(o)}</b> {mine.includes(o.fromId) ? `ให้ ${o.toName || 'เพื่อน'}` : `จาก ${o.fromName || 'เพื่อน'}`} ไม่สำเร็จ
            <span className="block text-red-300">{o.reason}</span>
          </p>
          <Button className="px-3 text-xs" onClick={() => respond(o, mine.includes(o.fromId) ? 'cancel' : 'decline')}>ปิด</Button>
        </div>
      ))}
    </div>
  )
}

/**
 * Gives I offered from this character that are still waiting: "🤝 รอ X รับ" with a cancel button. `itemId` shows the
 * ones for that pack item; `coins` the coin ones; `to` (give sheet) only the ones for that friend.
 */
export function WaitingMarks({ characterId, itemId, coins, to }: { characterId: string; itemId?: string; coins?: boolean; to?: string }) {
  const { offers, mine, answer } = useOffers()
  const [cancelled, setCancelled] = useState<string[]>([])
  const waiting = outgoingOffers(offers, mine, characterId).filter((o) =>
    o.status === 'open' && !cancelled.includes(o.id) && (!to || o.toId === to) &&
    (itemId ? o.gift.kind === 'item' && o.gift.itemId === itemId : coins ? o.gift.kind === 'coins' : true))
  if (waiting.length === 0) return null
  return (
    <div className="mt-1 space-y-1">
      {waiting.map((o) => (
        <div key={o.id} className="flex items-center gap-2 rounded-lg bg-amber-950/50 px-2 py-1 text-xs text-amber-200">
          <span className="min-w-0 flex-1">🤝 รอ {o.toName || 'เพื่อน'} รับ {offerLabel(o)}</span>
          <button type="button" className="shrink-0 rounded-full border border-amber-700 px-2.5 py-1 text-amber-100"
            onClick={() => { answer(o.id, 'cancel'); setCancelled((old) => [...old, o.id]) }}>ยกเลิก</button>
        </div>
      ))}
    </div>
  )
}
