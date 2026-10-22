// "🤝 ส่งให้เพื่อน": hand an item (from the item's buttons) or coins (under the coin purse) to another party member.
// - Player in a live room: the friends are the party cards; a 'giveOffer' message goes to the DM's device, which keeps
//   it as a pending offer. Nothing moves until the friend accepts (GiveOffers.tsx); both sheets then come back from there.
// - Otherwise (e.g. the DM's device): the other characters saved here in the same campaign; it moves at once.
// A character the DM runs but that isn't in the room can't give (the DM's device keeps its items and coins).
import { useLiveQuery } from 'dexie-react-hooks'
import { useEffect, useState } from 'react'
import { useLobby } from '../app/useLobby'
import { useDmRunsEconomy } from '../app/useRunsCampaign'
import { listCharacters } from '../db/characters'
import { giveNow } from '../db/give'
import type { Character, InventoryItem } from '../model/character'
import { giftLabel } from '../model/give'
import type { Coin } from '../rules'
import { Button, Select } from '../ui/kit'
import { WaitingMarks } from './GiveOffers'

const COIN_ORDER: Coin[] = ['pp', 'gp', 'ep', 'sp', 'cp']

/** Who this character can give to, and how it gets there. */
function useGive(c: Character) {
  const lobby = useLobby()
  const dmRuns = useDmRunsEconomy(c)
  const inRoom = lobby.session?.role === 'player' && lobby.myCharacterIds.includes(c.id)
  const here = useLiveQuery(listCharacters) ?? []
  if (inRoom) {
    return { room: true, blocked: false, friends: lobby.party.filter((p) => p.characterId !== c.id).map((p) => ({ id: p.characterId, name: p.name })) }
  }
  const sameCampaign = here.filter((x) => x.id !== c.id && (x.campaignId ?? null) === (c.campaignId ?? null))
  return { room: false, blocked: dmRuns, friends: dmRuns ? [] : sameCampaign.map((x) => ({ id: x.id, name: x.name || 'ไม่มีชื่อ' })) }
}

/** Pick a friend; the caller adds what to give and the send button. */
function FriendPicker({ friends, value, onChange }: { friends: { id: string; name: string }[]; value: string; onChange: (id: string) => void }) {
  return <Select value={value} options={[{ value: '', label: 'เลือกเพื่อนที่จะรับ' }, ...friends.map((f) => ({ value: f.id, label: f.name }))]} onChange={onChange} />
}

function Notice({ room, blocked, empty }: { room: boolean; blocked: boolean; empty: boolean }) {
  if (blocked) return <p className="text-xs text-stone-400">ต้องเข้าห้องออนไลน์ของ DM ก่อน (แท็บ 🌐 ห้อง) จึงจะส่งของให้เพื่อนได้</p>
  if (empty) return <p className="text-xs text-stone-400">{room ? 'ยังไม่มีเพื่อนคนอื่นในห้อง' : 'ไม่มีตัวละครอื่นในแคมเปญเดียวกันบนเครื่องนี้'}</p>
  return null
}

/** Give some of one pack item. */
export function GiveItemForm({ c, item, onDone }: { c: Character; item: InventoryItem; onDone: () => void }) {
  const lobby = useLobby()
  const g = useGive(c)
  const [to, setTo] = useState('')
  const [qty, setQty] = useState('1')
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null)
  const n = Math.max(1, Math.min(item.qty, Math.floor(Number(qty)) || 1))
  const friend = g.friends.find((f) => f.id === to)

  async function send() {
    if (!friend) return setMessage({ ok: false, text: 'เลือกเพื่อนที่จะรับก่อน' })
    const label = giftLabel({ kind: 'item', name: item.name, qty: n })
    if (g.room) {
      lobby.give({ fromId: c.id, toId: friend.id, itemId: item.id, qty: n })
      setMessage({ ok: true, text: `ส่งคำขอ ${label} ให้ ${friend.name} แล้ว รอเพื่อนกดรับ (ยกเลิกได้ที่ของชิ้นนั้น)` })
      return
    }
    const error = await giveNow({ fromId: c.id, toId: friend.id, itemId: item.id, qty: n })
    if (error) setMessage({ ok: false, text: error })
    else onDone()
  }

  return (
    <div className="mt-1 space-y-2 rounded-lg bg-stone-900 p-2">
      <p className="text-sm font-bold">🤝 ส่ง {item.name} ให้เพื่อน</p>
      <Notice room={g.room} blocked={g.blocked} empty={g.friends.length === 0} />
      {g.friends.length > 0 && (
        <div className="flex gap-2">
          <div className="min-w-0 flex-1"><FriendPicker friends={g.friends} value={to} onChange={(v) => { setTo(v); setMessage(null) }} /></div>
          {item.qty > 1 && (
            <input className="w-16 rounded-lg border border-stone-600 bg-stone-900 px-2 py-2 text-center" inputMode="numeric" aria-label="จำนวนที่ส่ง"
              value={qty} onChange={(e) => { setQty(e.target.value.replace(/[^0-9]/g, '').slice(0, 4)); setMessage(null) }} />
          )}
        </div>
      )}
      <div className="flex gap-2">
        {g.friends.length > 0 && <Button variant="primary" className="px-3 text-sm" onClick={() => void send()}>ส่ง{item.qty > 1 ? ` ${n} ชิ้น` : ''}</Button>}
        <Button className="px-3 text-sm" onClick={onDone}>ปิด</Button>
      </div>
      {message && <p className={`text-xs ${message.ok ? 'text-emerald-400' : 'text-red-400'}`}>{message.text}</p>}
    </div>
  )
}

/** Give coins: a button under the coin purse that opens the form. */
export function GiveCoinsForm({ c }: { c: Character }) {
  const lobby = useLobby()
  const g = useGive(c)
  const [open, setOpen] = useState(false)
  const [to, setTo] = useState('')
  const [coin, setCoin] = useState<Coin>('gp')
  const [amount, setAmount] = useState('')
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null)
  const n = Math.floor(Number(amount))
  const friend = g.friends.find((f) => f.id === to)

  async function send() {
    if (!friend) return setMessage({ ok: false, text: 'เลือกเพื่อนที่จะรับก่อน' })
    if (!(amount !== '' && n >= 1)) return setMessage({ ok: false, text: 'ใส่จำนวนเงินก่อน' })
    const label = giftLabel({ kind: 'coins', coin, amount: n })
    if (g.room) {
      lobby.give({ fromId: c.id, toId: friend.id, coin, amount: n })
      setMessage({ ok: true, text: `ส่งคำขอ ${label} ให้ ${friend.name} แล้ว รอเพื่อนกดรับ (ยกเลิกได้ใต้กระเป๋าเงิน)` })
    } else {
      const error = await giveNow({ fromId: c.id, toId: friend.id, coin, amount: n })
      if (error) return setMessage({ ok: false, text: error })
      setMessage({ ok: true, text: `ส่ง ${label} ให้ ${friend.name} แล้ว` })
    }
    setAmount('')
  }

  if (!open) {
    return (
      <button type="button" className="mt-2 rounded-full border border-stone-600 px-3 py-1 text-sm text-stone-300" onClick={() => setOpen(true)}>
        🤝 ส่งเงินให้เพื่อน
      </button>
    )
  }
  return (
    <div className="mt-2 space-y-2 rounded-lg bg-stone-900 p-2">
      <p className="text-sm font-bold">🤝 ส่งเงินให้เพื่อน</p>
      <Notice room={g.room} blocked={g.blocked} empty={g.friends.length === 0} />
      {g.friends.length > 0 && (
        <>
          <FriendPicker friends={g.friends} value={to} onChange={(v) => { setTo(v); setMessage(null) }} />
          <div className="flex items-center gap-2">
            <input className="w-24 min-w-0 flex-1 rounded-lg border border-stone-600 bg-stone-900 px-3 py-2 text-center" inputMode="numeric"
              placeholder="จำนวน" aria-label={`จำนวน ${coin.toUpperCase()} ที่ส่ง`} value={amount}
              onChange={(e) => { setAmount(e.target.value.replace(/[^0-9]/g, '').slice(0, 7)); setMessage(null) }} />
            <div className="w-24"><Select value={coin} options={COIN_ORDER.map((k) => ({ value: k, label: k.toUpperCase() }))} onChange={setCoin} /></div>
          </div>
        </>
      )}
      <div className="flex gap-2">
        {g.friends.length > 0 && <Button variant="primary" className="px-3 text-sm" onClick={() => void send()}>ส่ง</Button>}
        <Button className="px-3 text-sm" onClick={() => { setOpen(false); setMessage(null) }}>ปิด</Button>
      </div>
      {message && <p className={`text-xs ${message.ok ? 'text-emerald-400' : 'text-red-400'}`}>{message.text}</p>}
      {g.friends.length > 0 && <p className="text-xs text-stone-500">เหรียญไม่พอ จะแตกเหรียญใหญ่และทอนให้เอง (เหมือนตอนจ่าย)</p>}
    </div>
  )
}

/**
 * The party page's "🤝 ส่งของให้": a sheet from the bottom to give one friend an item from the pack or coins.
 * `givers` are the characters that may give (a player: their own; the DM's device: the others in the campaign).
 */
export function GiveSheet({ toId, toName, givers, onClose }: { toId: string; toName: string; givers: Character[]; onClose: () => void }) {
  const [fromId, setFromId] = useState(givers[0]?.id ?? '')
  const from = givers.find((x) => x.id === fromId) ?? givers[0]
  // Esc closes it, like other pop-ups.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])
  return (
    <div className="fixed inset-0 z-40" role="dialog" aria-modal="true" aria-label={`ส่งของให้ ${toName}`}>
      <button type="button" aria-label="ปิด" className="absolute inset-0 bg-black/60" onClick={onClose} />
      <div className="absolute inset-x-0 bottom-0 mx-auto max-h-[85dvh] max-w-xl space-y-3 overflow-y-auto rounded-t-2xl border-t border-stone-700 bg-stone-900 p-4 pb-8 shadow-2xl">
        <div className="flex items-start justify-between gap-2">
          <div>
            <h2 className="text-lg font-bold">🤝 ส่งของให้ <span className="text-amber-400">{toName}</span></h2>
            {from && givers.length === 1 && <p className="text-sm text-stone-400">จาก {from.name || 'ไม่มีชื่อ'}</p>}
          </div>
          <button type="button" aria-label="ปิด" className="h-10 w-10 shrink-0 rounded-full bg-stone-800 text-stone-300" onClick={onClose}>✕</button>
        </div>
        {givers.length > 1 && (
          <label className="block text-sm text-stone-400">ส่งจาก
            <Select value={from?.id ?? ''} options={givers.map((x) => ({ value: x.id, label: x.name || 'ไม่มีชื่อ' }))} onChange={setFromId} />
          </label>
        )}
        {from ? <GiveSheetBody key={from.id} from={from} toId={toId} /> : <p className="text-sm text-stone-400">ไม่มีตัวละครที่ส่งของให้ {toName} ได้ (ต้องอยู่แคมเปญเดียวกัน)</p>}
      </div>
    </div>
  )
}

function GiveSheetBody({ from, toId }: { from: Character; toId: string }) {
  const lobby = useLobby()
  const g = useGive(from)
  const friend = g.friends.find((f) => f.id === toId)
  const [kind, setKind] = useState<'item' | 'coins'>('item')
  const [search, setSearch] = useState('')
  const [itemId, setItemId] = useState('')
  const [qty, setQty] = useState(1)
  const [coin, setCoin] = useState<Coin>('gp')
  const [amount, setAmount] = useState('')
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null)

  // Only pack items can be given (take worn or held things off first).
  const pack = from.inventory.filter((i) => !i.equipped && !i.slot)
  const shown = pack.filter((i) => i.name.toLowerCase().includes(search.trim().toLowerCase()))
  const item = pack.find((i) => i.id === itemId)
  const n = item ? Math.max(1, Math.min(item.qty, qty)) : 0
  const coins = Math.floor(Number(amount))

  if (g.blocked || !friend) {
    return <Notice room={g.room} blocked={g.blocked} empty />
  }

  async function send() {
    if (!friend) return
    const request = kind === 'item'
      ? item && { fromId: from.id, toId: friend.id, itemId: item.id, qty: n }
      : amount !== '' && coins >= 1 && { fromId: from.id, toId: friend.id, coin, amount: coins }
    if (!request) return setMessage({ ok: false, text: kind === 'item' ? 'เลือกของที่จะส่งก่อน' : 'ใส่จำนวนเงินก่อน' })
    const label = 'itemId' in request ? giftLabel({ kind: 'item', name: item!.name, qty: n }) : giftLabel({ kind: 'coins', coin, amount: coins })
    if (g.room) {
      lobby.give(request)
      setMessage({ ok: true, text: `ส่งคำขอ ${label} ให้ ${friend.name} แล้ว รอเพื่อนกดรับ` })
    } else {
      const error = await giveNow(request)
      if (error) return setMessage({ ok: false, text: error })
      setMessage({ ok: true, text: `ส่ง ${label} ให้ ${friend.name} แล้ว` })
    }
    setItemId('')
    setQty(1)
    setAmount('')
  }

  const seg = (on: boolean) => `min-h-10 flex-1 rounded-lg text-sm ${on ? 'bg-amber-400 font-bold text-stone-900' : 'text-stone-300'}`
  return (
    <div className="space-y-3">
      <div className="flex gap-1 rounded-xl border border-stone-700 bg-stone-950 p-1">
        <button type="button" aria-pressed={kind === 'item'} className={seg(kind === 'item')} onClick={() => { setKind('item'); setMessage(null) }}>ของในกระเป๋า</button>
        <button type="button" aria-pressed={kind === 'coins'} className={seg(kind === 'coins')} onClick={() => { setKind('coins'); setMessage(null) }}>เหรียญ</button>
      </div>

      {kind === 'item' ? (
        <>
          {pack.length > 6 && (
            <input type="search" aria-label="ค้นหาของในกระเป๋า" placeholder="ค้นหาของในกระเป๋า" value={search} onChange={(e) => setSearch(e.target.value)}
              className="w-full rounded-lg border border-stone-600 bg-stone-950 px-3 py-2 text-base" />
          )}
          {pack.length === 0 && <p className="text-sm text-stone-400">ไม่มีของในกระเป๋า (ของที่สวมใส่อยู่ต้องถอดก่อนจึงจะส่งได้)</p>}
          <ul className="max-h-72 space-y-1.5 overflow-y-auto">
            {shown.map((i) => {
              const on = i.id === itemId
              return (
                <li key={i.id} className={`flex min-h-12 items-center gap-2 rounded-xl border px-3 py-1.5 ${on ? 'border-amber-400 bg-amber-950/40' : 'border-stone-700 bg-stone-950'}`}>
                  <button type="button" aria-pressed={on} className="min-w-0 flex-1 py-1 text-left" onClick={() => { setItemId(on ? '' : i.id); setQty(1); setMessage(null) }}>
                    <b className="block truncate">{i.magic && '✨ '}{i.name}</b>
                    <span className="text-xs text-stone-400">มี {i.qty} ชิ้น</span>
                  </button>
                  {on && i.qty > 1 && (
                    <div className="flex items-center gap-1">
                      <button type="button" aria-label="ลดจำนวน" className="h-9 w-9 rounded-lg bg-stone-700 font-bold" onClick={() => setQty(Math.max(1, n - 1))}>−</button>
                      <b className="w-7 text-center">{n}</b>
                      <button type="button" aria-label="เพิ่มจำนวน" className="h-9 w-9 rounded-lg bg-stone-700 font-bold" onClick={() => setQty(Math.min(i.qty, n + 1))}>+</button>
                    </div>
                  )}
                </li>
              )
            })}
          </ul>
        </>
      ) : (
        <>
          <p className="text-sm text-stone-400">มี {COIN_ORDER.filter((k) => from.coins[k] > 0).map((k) => `${from.coins[k].toLocaleString('en-US')} ${k.toUpperCase()}`).join(' · ') || 'ไม่มีเงิน'}</p>
          <div className="flex items-center gap-2">
            <input className="min-w-0 flex-1 rounded-lg border border-stone-600 bg-stone-950 px-3 py-2 text-center text-base" inputMode="numeric"
              placeholder="จำนวน" aria-label={`จำนวน ${coin.toUpperCase()} ที่ส่ง`} value={amount}
              onChange={(e) => { setAmount(e.target.value.replace(/[^0-9]/g, '').slice(0, 7)); setMessage(null) }} />
            <div className="w-24"><Select value={coin} options={COIN_ORDER.map((k) => ({ value: k, label: k.toUpperCase() }))} onChange={setCoin} /></div>
          </div>
          <p className="text-xs text-stone-500">เหรียญไม่พอ จะแตกเหรียญใหญ่และทอนให้เอง (เหมือนตอนจ่าย)</p>
        </>
      )}

      {g.room && <p className="text-xs text-stone-500">ของจะย้ายเมื่อ {friend.name} กดรับ (รอได้จนกว่าจะเลิกห้อง ยกเลิกได้เอง)</p>}
      {g.room && <WaitingMarks characterId={from.id} to={friend.id} />}
      <Button variant="primary" className="min-h-12 w-full" onClick={() => void send()}>
        {kind === 'item'
          ? item ? `ส่ง ${item.name}${n > 1 ? ` ${n} ชิ้น` : ''} ให้ ${friend.name}` : 'เลือกของที่จะส่ง'
          : `ส่ง${coins >= 1 ? ` ${coins.toLocaleString('en-US')} ${coin.toUpperCase()}` : 'เงิน'} ให้ ${friend.name}`}
      </Button>
      {message && <p role="status" className={`text-sm ${message.ok ? 'text-emerald-400' : 'text-red-400'}`}>{message.text}</p>}
    </div>
  )
}
