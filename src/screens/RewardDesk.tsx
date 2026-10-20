// DM tab: the reward pool (คลังกลาง) and players' coin requests (model/rewards.ts, db/rewards.ts).
// "+ ของรางวัล" puts SRD equipment or a custom item in the pool; players in the live room take from it on their sheet.
// Players can't change their coins themselves: their requests wait here until the DM approves or turns them down.
import { useLiveQuery } from 'dexie-react-hooks'
import { useState } from 'react'
import { useLobby } from '../app/useLobby'
import { decideCoinRequestNow, getCoinRequests, getPool, updatePool } from '../db/rewards'
import { addToPool, coinRequestLabel, setPoolQty, type CoinRequest } from '../model/rewards'
import { Button, Section } from '../ui/kit'
import { ItemImage } from '../ui/ItemImage'
import { ItemPicker } from './Inventory'
import { useEquipment } from './useSrdData'

export function RewardPool() {
  const lobby = useLobby()
  const data = useEquipment()
  const pool = useLiveQuery(getPool) ?? []
  const [adding, setAdding] = useState(false)
  const hosting = lobby.session?.role === 'dm'
  return (
    <Section
      title="🎁 คลังกลาง (ของรางวัล)"
      action={<Button variant="primary" className="text-sm" onClick={() => setAdding(!adding)}>{adding ? 'ปิด' : '+ ของรางวัล'}</Button>}
    >
      <p className="mb-2 text-sm text-stone-400">
        ผู้เล่นเพิ่มของเองไม่ได้ หยิบได้เฉพาะของในคลังนี้ (ที่หน้าชีท "+ หยิบจากคลังกลาง")
        {!hosting && <> · เปิดห้องที่แท็บ <a href="#/lobby" className="text-amber-400 underline">🌐 ห้อง</a> ให้ผู้เล่นเห็นคลัง</>}
      </p>
      {adding && (
        <ItemPicker data={data}
          onAdd={(item) => void updatePool((p) => addToPool(p, { name: item.name, srdId: item.id, qty: item.kind === 'pack' ? 1 : item.qty ?? 1 }))}
          onAddCustom={({ magic, ...item }) => void updatePool((p) => addToPool(p, { ...item, ...(magic ? { magic: true as const } : {}) }))} />
      )}
      {pool.length === 0 && !adding && <p className="text-sm text-stone-500">คลังว่าง กด "+ ของรางวัล" เพื่อใส่ของจาก SRD หรือพิมพ์ชื่อของเอง</p>}
      <ul className="divide-y divide-stone-800">
        {pool.map((p) => (
          <li key={p.id} className="flex items-center gap-2 py-1.5 text-sm">
            <ItemImage item={p} size={28} />
            <span className="min-w-0 flex-1 truncate" title={p.description}>{p.magic && '✨ '}<span className="font-bold">{p.name}</span><span className="text-stone-400"> ×{p.qty}</span></span>
            <button type="button" className="rounded-full border border-stone-600 px-2.5 py-0.5 text-stone-300" aria-label={`เพิ่ม ${p.name}`}
              onClick={() => void updatePool((list) => setPoolQty(list, p.id, p.qty + 1))}>+1</button>
            <button type="button" className="rounded-full border border-stone-600 px-2.5 py-0.5 text-stone-300" aria-label={`ลด ${p.name}`}
              onClick={() => void updatePool((list) => setPoolQty(list, p.id, p.qty - 1))}>−1</button>
            <button type="button" className="rounded-full border border-red-800 px-2.5 py-0.5 text-red-400"
              onClick={() => void updatePool((list) => setPoolQty(list, p.id, 0))}>เอาออก</button>
          </li>
        ))}
      </ul>
    </Section>
  )
}

export function CoinRequests() {
  const requests = useLiveQuery(getCoinRequests) ?? []
  const open = requests.filter((r) => r.status === 'open')
  const decided = requests.filter((r) => r.status !== 'open').slice().reverse()
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [showDone, setShowDone] = useState(false)

  async function decide(r: CoinRequest, approve: boolean) {
    const error = await decideCoinRequestNow(r.id, approve)
    setErrors((old) => {
      const { [r.id]: _gone, ...rest } = old
      return error ? { ...rest, [r.id]: error } : rest
    })
  }

  return (
    <Section title={`💰 คำขอเงินจากผู้เล่น${open.length ? ` (${open.length})` : ''}`}>
      {open.length === 0 && <p className="text-sm text-stone-500">ไม่มีคำขอรออนุมัติ · ผู้เล่นเพิ่ม/ลดเงินเองไม่ได้ ต้องขอที่หน้าชีท</p>}
      <ul className="space-y-2">
        {open.map((r) => (
          <li key={r.id} className="rounded-lg bg-stone-900 p-2 text-sm">
            <p><span className="font-bold">{r.characterName || 'ผู้เล่น'}</span> ขอ<span className={r.kind === 'gain' ? 'text-emerald-300' : 'text-amber-300'}>{coinRequestLabel(r)}</span></p>
            {r.note && <p className="text-stone-400">“{r.note}”</p>}
            <div className="mt-1 flex gap-2">
              <Button variant="primary" className="px-3 py-1 text-sm" onClick={() => void decide(r, true)}>✓ อนุมัติ</Button>
              <Button className="px-3 py-1 text-sm" onClick={() => void decide(r, false)}>✕ ไม่อนุมัติ</Button>
            </div>
            {errors[r.id] && <p className="mt-1 text-xs text-red-400">{errors[r.id]}</p>}
          </li>
        ))}
      </ul>
      {decided.length > 0 && (
        <div className="mt-2">
          <button type="button" className="text-xs text-stone-400 underline" onClick={() => setShowDone(!showDone)}>
            {showDone ? 'ซ่อนคำขอที่ตัดสินแล้ว' : `คำขอที่ตัดสินแล้ว (${decided.length})`}
          </button>
          {showDone && (
            <ul className="mt-1 space-y-0.5 text-xs text-stone-400">
              {decided.map((r) => (
                <li key={r.id}>{r.status === 'approved' ? '✓' : '✕'} {r.characterName}: {coinRequestLabel(r)}{r.note && ` · ${r.note}`}</li>
              ))}
            </ul>
          )}
        </div>
      )}
    </Section>
  )
}

/** DM hosting a room: a bar under the tabs while players' coin requests wait (tap to go to the DM tab). */
export function CoinRequestBar() {
  const lobby = useLobby()
  const requests = useLiveQuery(getCoinRequests) ?? []
  const open = requests.filter((r) => r.status === 'open').length
  if (lobby.session?.role !== 'dm' || open === 0) return null
  return (
    <a href="#/dm" className="mx-auto block max-w-5xl bg-amber-900 px-4 py-2 text-sm font-bold text-amber-100">
      💰 คำขอเงินจากผู้เล่น {open} รายการ · แตะเพื่ออนุมัติ
    </a>
  )
}
