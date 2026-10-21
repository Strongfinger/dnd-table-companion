// "🤝 ส่งให้เพื่อน": hand an item (from the item's buttons) or coins (under the coin purse) to another party member.
// - Player in a live room: the friends are the party cards; a 'give' message goes to the DM's device, which moves it
//   (both sheets come back from there).
// - Otherwise (e.g. the DM's device): the other characters saved here in the same campaign; it moves at once.
// A character the DM runs but that isn't in the room can't give (the DM's device keeps its items and coins).
import { useLiveQuery } from 'dexie-react-hooks'
import { useState } from 'react'
import { useLobby } from '../app/useLobby'
import { useDmRunsEconomy } from '../app/useRunsCampaign'
import { listCharacters } from '../db/characters'
import { giveNow } from '../db/give'
import type { Character, InventoryItem } from '../model/character'
import { giftLabel } from '../model/give'
import type { Coin } from '../rules'
import { Button, Select } from '../ui/kit'

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
      setMessage({ ok: true, text: `ส่ง ${label} ให้ ${friend.name} แล้ว ของจะย้ายเมื่อเครื่อง DM ยืนยัน` })
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
      setMessage({ ok: true, text: `ส่ง ${label} ให้ ${friend.name} แล้ว เงินจะย้ายเมื่อเครื่อง DM ยืนยัน` })
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
