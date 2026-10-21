// The sheet's coin purse and inventory. Coins: pick a coin, type an amount, then "รับ" or "จ่าย" (paying
// breaks bigger coins and gives change, src/rules/coins.ts). Items: one per slot (head, neck, two rings, … main hand,
// off hand, back; model/inventory.ts); "+ เพิ่มของ" picks SRD 5.2.1 equipment (a pack adds what's inside)
// or adds a custom item by name. Changes save at once; in a live room they go to the DM like other sheet edits.
// A character run by a DM on another device (useDmRunsEconomy) can't add items or change coins: "+ หยิบจากคลังกลาง"
// takes what the DM put in the reward pool, and coins are asked for (the DM approves on the DM tab, model/rewards.ts).
// Tap an item in the pack to use one, rename it, change how many, or throw it away.
// A bar shows the weight carried against Carrying Capacity (Str × 15 lb, model/carrying.ts).
import { useRef, useState } from 'react'
import { useLobby } from '../app/useLobby'
import { useDmRunsEconomy } from '../app/useRunsCampaign'
import { addCustomItem, coinRequestLabel, magicItemToCustom, type CustomItem, type PoolItem } from '../model/rewards'
import { updateCharacter } from '../db/characters'
import { EQUIP_SLOTS, type Character, type EquipSlot, type InventoryItem } from '../model/character'
import { armorClassLine, costLine, findItem, KIND_FILTERS, searchItems, weaponPropertiesLine, type SrdEquipment, type SrdItem } from '../model/equipment'
import { addSrdItem, MAX_ITEM_DESCRIPTION, MAX_ITEM_SUMMARY, setItemDetails, consumeItem, editItem, equipItem, removeItem, normalizeEquipment, SLOT_LABEL, slotContents, slotsFor, unequipItem } from '../model/inventory'
import { COIN_VALUE_CP, gainCoins, spendCoins, totalCopper, type Coin } from '../rules'
import { Button, Checkbox, Section, Select, TextArea, TextInput } from '../ui/kit'
import MiniMarkdown from '../ui/MiniMarkdown'
import { useEquipment, useEquipmentTh, useMagicItems, useMagicItemSummaries, useMagicItemsTh } from './useSrdData'
import { WithThai } from '../ui/ThaiText'
import { ItemImage } from '../ui/ItemImage'
import { useShowItemImages } from '../ui/useShowItemImages'
import { MAX_ITEM_IMAGES, countItemImages, setItemImage } from '../model/itemImage'
import { characterLoad, formatLb, hasTypedWeight, itemUnitWeight, MAX_ITEM_WEIGHT, setItemWeight } from '../model/carrying'
import { OVER_CAPACITY_SPEED } from '../rules'
import { compressItemImage } from '../ui/imageResize'

type Change = (fn: (latest: Character) => Character) => void

export default function Inventory({ c }: { c: Character }) {
  const lobby = useLobby()
  const data = useEquipment()
  const [adding, setAdding] = useState(false)
  const dmRuns = useDmRunsEconomy(c)

  async function change(fn: (latest: Character) => Character) {
    await updateCharacter(c.id, (latest) => ({ character: fn(latest), text: '' }))
    lobby.shareSheet(c.id)
  }

  // Older saves may have more equipped than the slots hold: show them sorted out (saved on the next change).
  const shown = data ? normalizeEquipment(c, data) : c
  const slots = data ? slotContents(shown, data) : {}
  const pack = shown.inventory.filter((i) => !i.slot)
  return (
    <>
      {dmRuns ? <CoinRequestForm c={c} /> : <CoinPurse c={c} change={change} />}
      <Section
        title="ของในกระเป๋า (Inventory)"
        action={<Button variant="primary" className="text-sm" onClick={() => setAdding(!adding)}>{adding ? 'ปิด' : dmRuns ? '+ หยิบจากคลังกลาง' : '+ เพิ่มของ'}</Button>}
      >
        <LoadBar c={shown} data={data ?? undefined} />
        {adding && dmRuns && <PoolPicker c={c} />}
        {adding && !dmRuns && (
          <ItemPicker data={data} onAdd={(item) => data && change((latest) => addSrdItem(latest, item, data))}
            onAddCustom={(item) => change((latest) => addCustomItem(latest, item))} />
        )}
        {data && <SlotGrid slots={slots} data={data} onTakeOff={(id) => change((latest) => unequipItem(latest, id, data))} />}
        {pack.length === 0 && !adding && (
          <p className="text-sm text-stone-500">{dmRuns ? 'ไม่มีของในเป้ กด "+ หยิบจากคลังกลาง" เพื่อรับของที่ DM ใส่ไว้' : 'ไม่มีของในเป้ กด "+ เพิ่มของ" เพื่อเลือกจาก SRD 5.2.1 หรือพิมพ์ชื่อของเอง'}</p>
        )}
        <ul className="divide-y divide-stone-800">
          {pack.map((item) => {
            const srd = data && item.srdId ? findItem(data, item.srdId) : undefined
            return (
              <ItemRow key={item.id} item={item} srd={srd} slots={slots}
                onEquip={(slot) => data && change((latest) => equipItem(latest, item.id, slot, data))} change={change} noMore={dmRuns} />
            )
          })}
        </ul>
        <ItemImageSwitch count={countItemImages(shown)} />
        <p className="mt-2 text-xs text-stone-500">ใส่ได้ช่องละ 1 ชิ้น · อาวุธสองมือใช้ทั้งมือหลักและมือรอง · สวม/ถอดเกราะหรือ Shield แล้ว AC คำนวณให้เอง (ปิดได้ในหน้าแก้ไข)</p>
      </Section>
    </>
  )
}

/** Turn every item picture off (or on again) on this device. */
function ItemImageSwitch({ count }: { count: number }) {
  const [show, setShow] = useShowItemImages()
  return (
    <div className="mt-2 flex items-center justify-between gap-2 text-xs text-stone-500">
      <span>{count > 0 && `รูปของตัวเอง ${count}/${MAX_ITEM_IMAGES} ชิ้น`}</span>
      <button type="button" onClick={() => setShow(!show)} aria-pressed={show} className="rounded-full border border-stone-700 px-3 py-1 text-stone-400">
        {show ? '🖼 ซ่อนรูปไอเทม' : '🖼 แสดงรูปไอเทม'}
      </button>
    </div>
  )
}

const COIN_ORDER: Coin[] = ['pp', 'gp', 'ep', 'sp', 'cp']

/** Coins apart from the items: tap a coin, type how many, then get or pay. */
function CoinPurse({ c, change }: { c: Character; change: Change }) {
  const [coin, setCoin] = useState<Coin>('gp')
  const [amount, setAmount] = useState('')
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null)
  const n = Math.floor(Number(amount))
  const valid = amount.trim() !== '' && Number.isFinite(n) && n > 0

  function apply(kind: 'gain' | 'spend') {
    if (!valid) return
    const label = `${n.toLocaleString('en-US')} ${coin.toUpperCase()}`
    if (kind === 'spend' && !spendCoins(c.coins, coin, n)) {
      setMessage({ ok: false, text: `เงินไม่พอจ่าย ${label}` })
      return
    }
    // Work it out again from the latest save (another tap or the DM may have changed it).
    change((latest) => ({ ...latest, coins: kind === 'gain' ? gainCoins(latest.coins, coin, n) : spendCoins(latest.coins, coin, n) ?? latest.coins }))
    setMessage({ ok: true, text: kind === 'gain' ? `รับ ${label} แล้ว` : `จ่าย ${label} แล้ว` })
    setAmount('')
  }

  const gp = totalCopper(c.coins) / COIN_VALUE_CP.gp
  return (
    <Section title="กระเป๋าเงิน (Coins)">
      <div className="grid grid-cols-5 gap-1.5">
        {COIN_ORDER.map((k) => (
          <button key={k} type="button" onClick={() => { setCoin(k); setMessage(null) }} aria-pressed={k === coin}
            className={`rounded-lg border px-1 py-1.5 text-center ${k === coin ? 'border-amber-400 bg-amber-900/60' : 'border-stone-700 bg-stone-900'}`}>
            <span className="block text-lg font-bold tabular-nums">{c.coins[k].toLocaleString('en-US')}</span>
            <span className="block text-xs text-stone-400">{k.toUpperCase()}</span>
          </button>
        ))}
      </div>
      <div className="mt-2 flex items-center gap-2">
        <input className="w-24 min-w-0 flex-1 rounded-lg border border-stone-600 bg-stone-900 px-3 py-2 text-center" inputMode="numeric"
          placeholder="จำนวน" aria-label={`จำนวน ${coin.toUpperCase()}`} value={amount}
          onChange={(e) => { setAmount(e.target.value.replace(/[^0-9]/g, '').slice(0, 7)); setMessage(null) }}
          onKeyDown={(e) => e.key === 'Enter' && apply('gain')} />
        <Button className="px-3 text-sm" onClick={() => apply('gain')}>+ รับ {coin.toUpperCase()}</Button>
        <Button className="px-3 text-sm" onClick={() => apply('spend')}>− จ่าย {coin.toUpperCase()}</Button>
      </div>
      <p className={`mt-1 text-xs ${message ? (message.ok ? 'text-emerald-400' : 'text-red-400') : 'text-stone-500'}`}>
        {message?.text ?? `รวมมูลค่า ${gp.toLocaleString('en-US', { maximumFractionDigits: 2 })} GP · จ่ายเกินเหรียญที่มี จะแตกเหรียญใหญ่และทอนให้เอง`}
      </p>
    </Section>
  )
}

/**
 * Coins of a character the DM runs: the player can't change them, only ask. The request goes to the DM's device and
 * shows on the DM tab; the coins change when the DM approves it.
 */
function CoinRequestForm({ c }: { c: Character }) {
  const lobby = useLobby()
  const [coin, setCoin] = useState<Coin>('gp')
  const [amount, setAmount] = useState('')
  const [note, setNote] = useState('')
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null)
  const n = Math.floor(Number(amount))
  const valid = amount.trim() !== '' && Number.isFinite(n) && n > 0
  const inRoom = lobby.myCharacterIds.includes(c.id)
  const mine = lobby.coinRequests.filter((r) => r.characterId === c.id).slice().reverse()

  function ask(kind: 'gain' | 'spend') {
    if (!valid) return
    if (!inRoom) {
      setMessage({ ok: false, text: 'ต้องเข้าห้องออนไลน์ของ DM ก่อน (แท็บ 🌐 ห้อง) จึงจะส่งคำขอได้' })
      return
    }
    lobby.requestCoins(c.id, { kind, coin, amount: n, note: note.trim().slice(0, 120) })
    setMessage({ ok: true, text: `ส่งคำขอ${coinRequestLabel({ kind, coin, amount: n })} แล้ว รอ DM อนุมัติ` })
    setAmount('')
    setNote('')
  }

  const gp = totalCopper(c.coins) / COIN_VALUE_CP.gp
  return (
    <Section title="กระเป๋าเงิน (Coins)">
      <div className="grid grid-cols-5 gap-1.5">
        {COIN_ORDER.map((k) => (
          <button key={k} type="button" onClick={() => { setCoin(k); setMessage(null) }} aria-pressed={k === coin}
            className={`rounded-lg border px-1 py-1.5 text-center ${k === coin ? 'border-amber-400 bg-amber-900/60' : 'border-stone-700 bg-stone-900'}`}>
            <span className="block text-lg font-bold tabular-nums">{c.coins[k].toLocaleString('en-US')}</span>
            <span className="block text-xs text-stone-400">{k.toUpperCase()}</span>
          </button>
        ))}
      </div>
      <p className="mt-2 text-xs text-stone-400">🔒 เงินเพิ่ม/ลดเองไม่ได้: ส่งคำขอให้ DM อนุมัติก่อน</p>
      <div className="mt-1 flex items-center gap-2">
        <input className="w-24 min-w-0 flex-1 rounded-lg border border-stone-600 bg-stone-900 px-3 py-2 text-center" inputMode="numeric"
          placeholder="จำนวน" aria-label={`จำนวน ${coin.toUpperCase()}`} value={amount}
          onChange={(e) => { setAmount(e.target.value.replace(/[^0-9]/g, '').slice(0, 7)); setMessage(null) }} />
        <Button className="px-3 text-sm" onClick={() => ask('gain')}>ขอรับ {coin.toUpperCase()}</Button>
        <Button className="px-3 text-sm" onClick={() => ask('spend')}>ขอจ่าย {coin.toUpperCase()}</Button>
      </div>
      <div className="mt-2"><TextInput value={note} placeholder="เหตุผล (ไม่บังคับ) เช่น ขายดาบ, ค่าห้องพัก" onChange={(v) => setNote(v.slice(0, 120))} /></div>
      <p className={`mt-1 text-xs ${message ? (message.ok ? 'text-emerald-400' : 'text-red-400') : 'text-stone-500'}`}>
        {message?.text ?? `รวมมูลค่า ${gp.toLocaleString('en-US', { maximumFractionDigits: 2 })} GP`}
      </p>
      {mine.length > 0 && (
        <ul className="mt-2 space-y-1 text-sm">
          {mine.slice(0, 6).map((r) => (
            <li key={r.id} className="flex items-center justify-between gap-2 rounded bg-stone-900 px-2 py-1">
              <span className="min-w-0 truncate">{coinRequestLabel(r)}{r.note && <span className="text-stone-400"> · {r.note}</span>}</span>
              <span className={`shrink-0 text-xs ${r.status === 'open' ? 'text-amber-300' : r.status === 'approved' ? 'text-emerald-400' : 'text-red-400'}`}>
                {r.status === 'open' ? '⏳ รอ DM' : r.status === 'approved' ? '✓ อนุมัติแล้ว' : '✕ ไม่อนุมัติ'}
              </span>
            </li>
          ))}
        </ul>
      )}
    </Section>
  )
}

/** Items the DM put in the reward pool: take some for this character (the DM's device gives what is still there). */
function PoolPicker({ c }: { c: Character }) {
  const lobby = useLobby()
  const [asked, setAsked] = useState<string | null>(null)
  if (!lobby.myCharacterIds.includes(c.id)) {
    return <p className="mb-3 rounded-lg bg-stone-900 p-3 text-sm text-stone-400">คลังกลางเปิดเมื่ออยู่ในห้องออนไลน์ของ DM (แท็บ 🌐 ห้อง) · ของใหม่ต้องหยิบจากคลังที่ DM ใส่ไว้เท่านั้น</p>
  }
  const pool = lobby.pool
  return (
    <div className="mb-3 space-y-2 rounded-lg bg-stone-900 p-3">
      <p className="text-sm font-bold">🎁 คลังกลาง (ของที่ DM ใส่ไว้ตอนนี้)</p>
      {pool === null && <p className="text-sm text-stone-500">กำลังโหลดคลังจาก DM…</p>}
      {pool?.length === 0 && <p className="text-sm text-stone-500">คลังว่าง: รอ DM เพิ่มของรางวัล</p>}
      <ul className="max-h-72 space-y-1 overflow-y-auto">
        {pool?.map((p) => <PoolRow key={p.id} item={p} asked={asked === p.id} onTake={(qty) => { lobby.takeFromPool(c.id, p.id, qty); setAsked(p.id) }} />)}
      </ul>
      {asked && <p className="text-xs text-emerald-400">ส่งแล้ว ของจะเข้ากระเป๋าเมื่อเครื่อง DM ยืนยัน (ถ้ามีคนหยิบไปก่อน จะได้เท่าที่เหลือ)</p>}
    </div>
  )
}

function PoolRow({ item, asked, onTake }: { item: PoolItem; asked: boolean; onTake: (qty: number) => void }) {
  const [qty, setQty] = useState('1')
  const n = Math.max(1, Math.min(item.qty, Math.floor(Number(qty)) || 1))
  return (
    <li className="flex items-center gap-2 rounded bg-stone-800 px-2 py-1 text-sm">
      <ItemImage item={item} size={28} />
      <span className="min-w-0 flex-1">
        {item.magic && '✨ '}<span className="font-bold">{item.name}</span><span className="text-stone-400"> · เหลือ {item.qty}</span>
        {item.description && <span className="block whitespace-pre-wrap text-xs text-stone-400">{item.description}</span>}
      </span>
      {item.qty > 1 && (
        <input className="w-14 rounded-lg border border-stone-600 bg-stone-900 px-1 py-1 text-center" inputMode="numeric" aria-label="จำนวนที่หยิบ"
          value={qty} onChange={(e) => setQty(e.target.value.replace(/[^0-9]/g, '').slice(0, 4))} />
      )}
      <Button className="px-3 py-1 text-sm" onClick={() => onTake(n)}>{asked ? 'หยิบอีก' : 'หยิบ'}</Button>
    </li>
  )
}

/** Every slot and what is in each; tap an SRD item's name to read about it. */
function SlotGrid({ slots, data, onTakeOff }: {
  slots: Partial<Record<EquipSlot, InventoryItem>>
  data: SrdEquipment
  onTakeOff: (itemId: string) => void
}) {
  return (
    <div className="mb-3 grid grid-cols-1 gap-x-3 sm:grid-cols-2">
      {EQUIP_SLOTS.map((s) => {
        const item = slots[s]
        // A Two-Handed weapon shows in both hands; take it off (and read it) from the main hand.
        const both = s === 'offHand' && !!item && slots.mainHand === item
        return <SlotRow key={s} slot={s} item={item} both={both} srd={item?.srdId ? findItem(data, item.srdId) : undefined} onTakeOff={onTakeOff} />
      })}
    </div>
  )
}

function SlotRow({ slot, item, both, srd, onTakeOff }: {
  slot: EquipSlot
  item: InventoryItem | undefined
  both: boolean
  srd: SrdItem | undefined
  onTakeOff: (itemId: string) => void
}) {
  const [open, setOpen] = useState(false)
  return (
    <div className="border-b border-stone-800 py-1 text-sm">
      <div className="flex min-h-7 items-center gap-2">
        <span className="w-20 shrink-0 text-xs text-stone-400">{SLOT_LABEL[slot]}</span>
        {!item && <span className="flex-1 text-stone-600">—</span>}
        {item && both && <span className="min-w-0 flex-1 truncate text-stone-500">({item.name} ใช้สองมือ)</span>}
        {item && !both && <ItemImage item={item} srd={srd} size={28} />}
        {item && !both && (
          <button type="button" className="min-w-0 flex-1 truncate text-left font-bold text-amber-300" onClick={() => setOpen(!open)} disabled={!srd} aria-expanded={open}>
            {item.name}{srd && <span className="ml-1 text-xs font-normal text-stone-500">ⓘ</span>}
          </button>
        )}
        {item && !both && (
          <button type="button" onClick={() => onTakeOff(item.id)} className="shrink-0 rounded-full border border-stone-600 px-2.5 py-0.5 text-xs text-stone-300">ถอด</button>
        )}
      </div>
      {open && srd && item && !both && <ItemDetails srd={srd} />}
    </div>
  )
}

function ItemRow({ item, srd, slots, onEquip, change, noMore }: {
  item: InventoryItem
  srd: SrdItem | undefined
  slots: Partial<Record<EquipSlot, InventoryItem>>
  onEquip: (slot: EquipSlot) => void
  change: Change
  /** The DM runs this character's items: the number can go down, not up. */
  noMore: boolean
}) {
  const [open, setOpen] = useState(false)
  const [choosing, setChoosing] = useState(false)
  const fits = slotsFor(item, srd)
  const verb = srd?.kind === 'weapon' || fits.includes('mainHand') ? 'ถือ' : 'สวม'
  return (
    <li className="py-1.5">
      <div className="flex items-center gap-2">
        <ItemImage item={item} srd={srd} />
        <button type="button" className="min-w-0 flex-1 text-left" onClick={() => setOpen(!open)} aria-expanded={open}>
          {item.magic && <span className="mr-1" title="Magic Item">✨</span>}{item.name}{item.qty !== 1 && <span className="font-normal text-stone-400"> ×{item.qty}</span>}
          {item.wear && <span className="ml-1 text-xs text-stone-500">({SLOT_LABEL[item.wear]})</span>}
          {itemUnitWeight(item, srd) > 0 && <span className="ml-1 text-xs font-normal text-stone-500">{formatLb(item.qty * itemUnitWeight(item, srd))}</span>}
          <span className="ml-1 text-xs font-normal text-stone-500">{srd ? 'ⓘ' : '✎'}</span>
        </button>
        {fits.length > 0 && (
          <button type="button" onClick={() => (fits.length === 1 ? onEquip(fits[0]) : setChoosing(!choosing))}
            className="shrink-0 rounded-full border border-stone-600 px-3 py-1 text-sm text-stone-300">
            {fits.length === 1 ? `${verb} (${SLOT_LABEL[fits[0]]})` : choosing ? 'ปิด' : verb}
          </button>
        )}
      </div>
      {choosing && (
        <div className="mt-1 flex flex-wrap gap-1.5">
          {fits.map((s) => (
            <button key={s} type="button" onClick={() => { onEquip(s); setChoosing(false) }}
              className="rounded-full border border-amber-500 px-3 py-1 text-sm">
              {SLOT_LABEL[s]}{slots[s] && <span className="text-xs text-stone-400"> (แทน {slots[s]!.name})</span>}
            </button>
          ))}
        </div>
      )}
      {open && <ItemActions item={item} srd={srd} wearable={fits.length > 0} change={change} noMore={noMore} />}
      {open && srd && <ItemDetails srd={srd} item={item} />}
      {open && !srd && item.description && <CustomItemText item={item} />}
      {open && !srd && <ItemPictureField item={item} change={change} />}
    </li>
  )
}

/**
 * Use one, rename / change the number, or throw away (tap ลบ twice: no pop-up).
 * Things worn or held (weapons, armor, a cloak…) aren't used up, so they only get แก้ไข and ลบ.
 */
function ItemActions({ item, srd, wearable, change, noMore }: { item: InventoryItem; srd: SrdItem | undefined; wearable: boolean; change: Change; noMore: boolean }) {
  const [editing, setEditing] = useState(false)
  const [name, setName] = useState(item.name)
  const [qty, setQty] = useState(String(item.qty))
  const [weight, setWeight] = useState(item.weight ? String(item.weight) : '')
  const [description, setDescription] = useState(item.description ?? '')
  const [summary, setSummary] = useState(item.summary ?? '')
  const [magic, setMagic] = useState(!!item.magic)
  const typed = hasTypedWeight(srd)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const pill = 'rounded-full border px-3 py-1 text-sm'

  if (editing) {
    return (
      <div className="mt-1 space-y-2 rounded-lg bg-stone-900 p-2">
        <div className="flex gap-2">
          <div className="min-w-0 flex-1"><TextInput value={name} onChange={setName} /></div>
          <input className="w-16 rounded-lg border border-stone-600 bg-stone-900 px-2 py-2 text-center" inputMode="numeric" aria-label="จำนวน"
            value={qty} onChange={(e) => {
              const v = e.target.value.replace(/[^0-9]/g, '').slice(0, 4)
              setQty(noMore && v !== '' && Number(v) > item.qty ? String(item.qty) : v)
            }} />
        </div>
        {noMore && <p className="text-xs text-stone-500">ลดจำนวนได้ · ของเพิ่มต้องหยิบจากคลังกลางของ DM</p>}
        <div className="flex gap-2">
          <Button variant="primary" className="px-3 text-sm" onClick={() => {
            change((latest) => {
              let next = editItem(latest, item.id, name, qty === '' ? item.qty : Number(qty))
              // The effect text and Magic Item mark are the DM's (a character the DM runs can't change them).
              if (!srd && !noMore) next = setItemDetails(next, item.id, { description, summary, magic })
              return typed ? setItemWeight(next, item.id, weight === '' ? undefined : Number(weight)) : next
            })
            setEditing(false)
          }}>บันทึก</Button>
          <Button className="px-3 text-sm" onClick={() => {
            setName(item.name); setQty(String(item.qty)); setWeight(item.weight ? String(item.weight) : '')
            setDescription(item.description ?? ''); setSummary(item.summary ?? ''); setMagic(!!item.magic); setEditing(false)
          }}>ยกเลิก</Button>
        </div>
        {typed && <WeightField value={weight} onChange={setWeight} />}
        {!srd && !noMore && <DetailsFields description={description} summary={summary} magic={magic} onDescription={setDescription} onSummary={setSummary} onMagic={setMagic} />}
        {!srd && noMore && <p className="text-xs text-stone-500">คำอธิบาย / Magic Item: DM เป็นคนแก้</p>}
        {qty === '0' && <p className="text-xs text-amber-300">จำนวน 0 = เอาของชิ้นนี้ออกจากเป้</p>}
      </div>
    )
  }
  return (
    <div className="mt-1 flex flex-wrap gap-1.5">
      {!wearable && (
        <button type="button" className={`${pill} border-emerald-600 text-emerald-300`} onClick={() => change((latest) => consumeItem(latest, item.id))}>
          ใช้ 1 {item.qty > 1 ? `(เหลือ ${item.qty - 1})` : '(หมด)'}
        </button>
      )}
      <button type="button" className={`${pill} border-stone-600 text-stone-300`} onClick={() => { setName(item.name); setQty(String(item.qty)); setEditing(true) }}>แก้ไข</button>
      <button type="button" className={`${pill} ${confirmDelete ? 'border-red-500 bg-red-900 font-bold text-red-100' : 'border-red-800 text-red-400'}`}
        onClick={() => (confirmDelete ? change((latest) => removeItem(latest, item.id)) : setConfirmDelete(true))}>
        {confirmDelete ? 'แตะอีกครั้งเพื่อลบ' : 'ลบ'}
      </button>
    </div>
  )
}

/**
 * An SRD item's stats and text; the text (and a tool's uses) in Thai with the ไทย/EN switch when DND-TH has it.
 * The Thai name shows here unless the list row above already has it (`rowHasThaiName`).
 */
export function ItemDetails({ srd, item, rowHasThaiName = false }: { srd: SrdItem; item?: InventoryItem; rowHasThaiName?: boolean }) {
  const thai = useEquipmentTh()
  const [big, setBig] = useState(false)
  const th = thai.items[srd.id]
  const thText = [th?.utilize && `**ใช้งาน:** ${th.utilize}`, th?.text].filter(Boolean).join('\n\n')
  const mastery = srd.weapon && thai.masteries[srd.weapon.mastery]
  return (
    <div className="mt-1 space-y-1 rounded-lg bg-stone-900 p-2 text-sm text-stone-300">
      {/* The picture floats beside the text, so short text doesn't leave a tall gap; tap it to see it bigger. */}
      <button type="button" className="float-right ml-2 mb-1" onClick={() => setBig(!big)} aria-label={big ? 'ย่อรูป' : 'ดูรูปใหญ่'}>
        <ItemImage item={item ?? { srdId: srd.id }} srd={srd} size={big ? 224 : 112} />
      </button>
      {th && !rowHasThaiName && <p className="text-amber-200">{th.name}</p>}
      {srd.weapon && <p>{srd.weapon.category} {srd.weapon.type} · {srd.weapon.dice} {srd.weapon.damageType}{srd.weapon.properties.length > 0 && ` · ${weaponPropertiesLine(srd.weapon)}`} · Mastery: {srd.weapon.mastery}{mastery && ` (${mastery.name})`}</p>}
      {srd.armor && (
        <p>
          {srd.armor.category === 'Shield' ? 'Shield' : `${srd.armor.category} Armor`} · AC {armorClassLine(srd.armor)}
          {srd.armor.strMin > 0 && ` · Str ${srd.armor.strMin}`}
          {srd.armor.stealthDisadvantage && ' · Stealth Disadvantage'}
        </p>
      )}
      <WithThai th={thText || undefined}>
        {srd.utilize && <p>Ability: {srd.ability?.toUpperCase()} · {srd.utilize.join(', ')}</p>}
        {srd.text && <p className="whitespace-pre-wrap">{srd.text}</p>}
      </WithThai>
      <p className="text-xs text-stone-500">{costLine(srd.cost)}{srd.weight ? ` · ${srd.weight} lb.` : ''}</p>
      <div className="clear-both" />
    </div>
  )
}

/** A custom item's own picture: pick one from the phone (shrunk to a thumbnail) or take it off again. */
function ItemPictureField({ item, change }: { item: InventoryItem; change: Change }) {
  const file = useRef<HTMLInputElement>(null)
  const [error, setError] = useState<string | null>(null)

  async function pick(files: FileList | null) {
    const chosen = files?.[0]
    if (!chosen) return
    setError(null)
    try {
      const dataUrl = await compressItemImage(chosen)
      change((latest) => {
        const next = setItemImage(latest, item.id, dataUrl)
        if (next === latest) setError(`ใส่รูปได้ไม่เกิน ${MAX_ITEM_IMAGES} ชิ้นต่อตัวละคร (เอารูปของชิ้นอื่นออกก่อน)`)
        return next
      })
    } catch (e) {
      setError(e instanceof Error ? e.message : 'ใส่รูปนี้ไม่ได้')
    }
  }

  return (
    <div className="mt-1 flex items-center gap-2 text-xs text-stone-400">
      <ItemImage item={item} size={40} />
      <button type="button" className="rounded-full border border-stone-600 px-3 py-1 text-sm text-stone-300" onClick={() => file.current?.click()}>
        {item.image ? '🖼 เปลี่ยนรูป' : '🖼 ใส่รูป'}
      </button>
      {item.image && (
        <button type="button" className="rounded-full border border-stone-700 px-3 py-1 text-sm text-stone-400" onClick={() => change((latest) => setItemImage(latest, item.id, undefined))}>
          เอารูปออก
        </button>
      )}
      <input ref={file} type="file" accept="image/*" hidden onChange={(e) => { void pick(e.target.files); e.target.value = '' }} />
      <span className={error ? 'text-red-400' : ''}>{error ?? 'รูปเล็กๆ ใช้ได้ทุกเครื่องในห้อง'}</span>
    </div>
  )
}

/** SRD equipment search plus a custom item form (the sheet's "+ เพิ่มของ", and the DM's "+ ของรางวัล"). */
export function ItemPicker({ data, onAdd, onAddCustom }: {
  data: SrdEquipment | null
  onAdd: (item: SrdItem) => void
  onAddCustom: AddCustom
}) {
  const thai = useEquipmentTh().items
  const magicItems = useMagicItems()
  const magicTh = useMagicItemsTh()
  const summaries = useMagicItemSummaries()
  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState(0)
  const [added, setAdded] = useState<string | null>(null)
  if (!data) return <CustomItemForm initialName={query} onAdd={onAddCustom} />
  // The last chip, after the SRD equipment kinds: SRD magic items, added as ✨ Magic Items (with slot and text).
  const magicChip = filter === KIND_FILTERS.length
  const found = magicChip && !query ? [] : searchItems(data, query, query ? undefined : KIND_FILTERS[filter].kinds, thai)
  const words = query.toLowerCase().split(/\s+/).filter(Boolean)
  const magicFound = (magicChip || query) && magicItems
    ? magicItems.filter((i) => words.every((w) => i.name.toLowerCase().includes(w) || !!magicTh[i.id]?.name.includes(w)))
    : []

  return (
    <div className="mb-3 space-y-2 rounded-lg bg-stone-900 p-3">
      <TextInput value={query} placeholder="ค้นหา เช่น sword, rope, leather, เชือก" onChange={setQuery} />
      {!query && (
        <div className="flex flex-wrap gap-1.5 text-sm">
          {KIND_FILTERS.map((f, i) => (
            <button key={f.label} type="button" onClick={() => setFilter(i)}
              className={`rounded-full border px-3 py-1 ${i === filter ? 'border-amber-400 bg-amber-800 font-bold' : 'border-stone-600'}`}>
              {f.label}
            </button>
          ))}
          <button type="button" onClick={() => setFilter(KIND_FILTERS.length)}
            className={`rounded-full border px-3 py-1 ${magicChip ? 'border-amber-400 bg-amber-800 font-bold' : 'border-stone-600'}`}>
            ✨ ไอเทมเวท
          </button>
        </div>
      )}
      <ul className="max-h-72 space-y-1 overflow-y-auto">
        {found.map((i) => (
          <li key={i.id} className="flex items-center justify-between gap-2 rounded bg-stone-800 px-2 py-1 text-sm">
            <span className="min-w-0">
              <span className="font-bold">{i.name}</span>{i.qty && i.qty > 1 && <span className="text-stone-400"> ×{i.qty}</span>}{thai[i.id] && <span className="text-stone-400"> · {thai[i.id].name}</span>}
              <span className="block text-xs text-stone-400">{pickerLine(i)}</span>
            </span>
            {added === i.id
              ? <span className="text-xs whitespace-nowrap text-emerald-400">✓ เพิ่มแล้ว</span>
              : <Button className="px-3 py-1 text-sm" onClick={() => { onAdd(i); setAdded(i.id) }}>+ เพิ่ม</Button>}
          </li>
        ))}
        {magicFound.map((i) => (
          <li key={`magic-${i.id}`} className="flex items-center justify-between gap-2 rounded bg-stone-800 px-2 py-1 text-sm">
            <span className="min-w-0">
              ✨ <span className="font-bold">{i.name}</span>{magicTh[i.id] && <span className="text-stone-400"> · {magicTh[i.id].name}</span>}
              <span className="block text-xs text-stone-400">{i.rarity}{i.attunement && ' · Attune'} · Magic Item</span>
            </span>
            {added === `magic-${i.id}`
              ? <span className="text-xs whitespace-nowrap text-emerald-400">✓ เพิ่มแล้ว</span>
              : <Button className="px-3 py-1 text-sm" onClick={() => { onAddCustom(magicItemToCustom(i, magicTh[i.id]?.text, summaries[i.id]?.summary)); setAdded(`magic-${i.id}`) }}>+ เพิ่ม</Button>}
          </li>
        ))}
      </ul>
      {magicChip && !query && <p className="text-xs text-stone-500">ไอเทมเวทจาก SRD 5.2.1 ใส่เป็น ✨ Magic Item พร้อมช่องสวมใส่และคำอธิบาย · ตัวเลข (เช่น +1 AC) แอปไม่คิดให้</p>}
      {found.length === 0 && magicFound.length === 0 && <p className="text-xs text-stone-500">ไม่พบใน SRD · เพิ่มเป็นของ custom ด้านล่างได้</p>}
      <CustomItemForm key={found.length + magicFound.length === 0 ? query : ''} initialName={found.length + magicFound.length === 0 ? query : ''} onAdd={onAddCustom} />
    </div>
  )
}

/** Wear slots a custom item can have: "in a hand" means either hand, a ring either ring slot. */
const WEAR_OPTIONS: { value: EquipSlot | ''; label: string }[] = [
  { value: '', label: 'ไม่ได้สวมใส่ (เก็บในเป้)' },
  ...EQUIP_SLOTS.filter((s) => s !== 'offHand' && s !== 'ring2').map((s) => ({ value: s, label: s === 'mainHand' ? 'ถือในมือ' : s === 'ring1' ? 'สวมที่นิ้ว (แหวน)' : `สวมที่${SLOT_LABEL[s]}` })),
]

/** A custom item the SRD list doesn't have (a quest item, a reward from the DM…). */
function CustomItemForm({ initialName, onAdd }: { initialName: string; onAdd: AddCustom }) {
  const [name, setName] = useState(initialName)
  const [qty, setQty] = useState('1')
  const [weight, setWeight] = useState('')
  const [wear, setWear] = useState<EquipSlot | ''>('')
  const [description, setDescription] = useState('')
  const [summary, setSummary] = useState('')
  const [magic, setMagic] = useState(false)
  const [added, setAdded] = useState<string | null>(null)
  const n = Math.max(1, Math.min(9999, Math.floor(Number(qty)) || 1))
  function add() {
    if (!name.trim()) return
    onAdd({ name, qty: n, wear: wear || undefined, weight: weight === '' ? undefined : Number(weight), description, summary, magic })
    setAdded(name.trim())
    setName('')
    setQty('1')
    setWeight('')
    setWear('')
    setDescription('')
    setSummary('')
    setMagic(false)
  }
  return (
    <div className="mb-3 space-y-2 rounded-lg border border-stone-700 p-2">
      <p className="text-sm font-bold">เพิ่มของที่ไม่มีในรายการ (custom)</p>
      <div className="flex gap-2">
        <div className="min-w-0 flex-1"><TextInput value={name} placeholder="ชื่อของ เช่น Ring of the Old King" onChange={(v) => { setName(v); setAdded(null) }} /></div>
        <input className="w-16 rounded-lg border border-stone-600 bg-stone-900 px-2 py-2 text-center" inputMode="numeric" aria-label="จำนวน"
          value={qty} onChange={(e) => setQty(e.target.value.replace(/[^0-9]/g, '').slice(0, 4))} />
      </div>
      <div className="flex items-center gap-2">
        <div className="min-w-0 flex-1"><Select value={wear} options={WEAR_OPTIONS} onChange={setWear} /></div>
        <Button className="px-3 text-sm" onClick={add}>+ เพิ่ม</Button>
      </div>
      <WeightField value={weight} onChange={setWeight} />
      <DetailsFields description={description} summary={summary} magic={magic} onDescription={setDescription} onSummary={setSummary} onMagic={setMagic} />
      {added && <p className="text-xs text-emerald-400">✓ เพิ่ม {added} แล้ว</p>}
    </div>
  )
}

function pickerLine(i: SrdItem): string {
  if (i.weapon) return `${i.weapon.dice} ${i.weapon.damageType} · ${i.weapon.category} · ${costLine(i.cost)}`
  if (i.armor) return `AC ${armorClassLine(i.armor)} · ${i.armor.category} · ${costLine(i.cost)}`
  if (i.kind === 'pack') return `ใส่ของข้างในทั้งหมด (${i.contents?.length ?? 0} อย่าง) · ${costLine(i.cost)}`
  return costLine(i.cost)
}

export type AddCustom = (item: CustomItem) => void

/** A custom item's own text, e.g. a magic item's effect: **bold**, *italic* and lists work. */
function CustomItemText({ item }: { item: InventoryItem }) {
  return (
    <div className="mt-1 rounded-lg bg-stone-900 p-2 text-sm text-stone-300">
      {item.magic && <p className="mb-1 text-xs font-bold text-violet-300">✨ Magic Item</p>}
      <MiniMarkdown text={item.description ?? ''} />
    </div>
  )
}

/** A custom item's effect text, a magic item's short summary, and the Magic Item mark (the custom form and the edit box). */
function DetailsFields({ description, summary, magic, onDescription, onSummary, onMagic }: {
  description: string
  summary: string
  magic: boolean
  onDescription: (v: string) => void
  onSummary: (v: string) => void
  onMagic: (v: boolean) => void
}) {
  return (
    <div className="space-y-1">
      <Checkbox checked={magic} onChange={onMagic} label="✨ Magic Item" />
      <p className="text-xs text-stone-400">คำอธิบาย / Effect (ไม่บังคับ) เช่น +1 AC ขณะสวม, ใช้ได้ 1 ครั้งต่อ Long Rest</p>
      <TextArea value={description} rows={3} onChange={(v) => onDescription(v.slice(0, MAX_ITEM_DESCRIPTION))} />
      {magic && (
        <>
          <p className="text-xs text-stone-400">สรุปเอฟเฟกต์สั้นๆ (แสดงในบัฟ/เอฟเฟกต์ชั่วคราว · เว้นว่าง = ใช้สรุปของ SRD หรือต้นคำอธิบาย)</p>
          <TextInput value={summary} placeholder="เช่น +1 AC และ +1 ทุก Saving Throw" onChange={(v) => onSummary(v.slice(0, MAX_ITEM_SUMMARY))} />
        </>
      )}
    </div>
  )
}

/** Weight of one piece, for items the SRD list has no weight for (blank = not counted). */
function WeightField({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <label className="flex items-center gap-2 text-sm text-stone-400">
      น้ำหนักต่อชิ้น
      <input className="w-20 rounded-lg border border-stone-600 bg-stone-900 px-2 py-1.5 text-center text-stone-100" inputMode="decimal" placeholder="0"
        value={value} onChange={(e) => {
          const v = e.target.value.replace(/[^0-9.]/g, '').replace(/(\..*)\./g, '$1').slice(0, 7)
          if (v === '' || Number(v) <= MAX_ITEM_WEIGHT) onChange(v)
        }} />
      lb
    </label>
  )
}

/**
 * Weight carried against Carrying Capacity (Strength × 15 lb, × 30 for a Goliath). Over it, the character can only drag, lift or push
 * (up to twice the capacity) with Speed no more than 5 ft; past that they can't move it at all.
 */
function LoadBar({ c, data }: { c: Character; data: SrdEquipment | undefined }) {
  const load = characterLoad(c, data)
  const pct = load.capacity > 0 ? Math.min(100, (load.total / load.capacity) * 100) : 100
  const color = load.state !== 'ok' ? 'bg-red-500' : pct >= 80 ? 'bg-amber-500' : 'bg-emerald-500'
  return (
    <div className="mb-3 space-y-1">
      <div className="flex items-baseline justify-between gap-2 text-sm">
        <span className="font-bold">น้ำหนักที่แบก</span>
        <span className={load.state === 'ok' ? 'text-stone-300' : 'font-bold text-red-300'}>
          {formatLb(load.total)} / {formatLb(load.capacity)}
        </span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-stone-800" role="meter" aria-label="น้ำหนักที่แบก"
        aria-valuemin={0} aria-valuemax={load.capacity} aria-valuenow={Math.round(load.total * 10) / 10}>
        <div className={`h-full ${color}`} style={{ width: `${pct}%` }} />
      </div>
      <p className="text-xs text-stone-500">
        ของ {formatLb(load.items)}{load.coins > 0 && ` · เหรียญ ${formatLb(load.coins)} (50 เหรียญ = 1 lb)`} · แบกได้ STR {c.scores.str} × {load.capacity / Math.max(1, c.scores.str)} lb
      </p>
      {load.state === 'over' && (
        <p className="rounded-lg bg-red-950 p-2 text-xs text-red-200">
          เกิน Carrying Capacity: Speed เหลือ {OVER_CAPACITY_SPEED} ft (หักบนชีทแล้ว) · ลาก ยก หรือดันได้ถึง {formatLb(load.limit)}
        </p>
      )}
      {load.state === 'tooHeavy' && (
        <p className="rounded-lg bg-red-950 p-2 text-xs text-red-200">
          หนักเกินกว่าจะขยับได้ (เกิน {formatLb(load.limit)}): Speed เป็น 0 จนกว่าจะทิ้งของบางอย่าง
        </p>
      )}
    </div>
  )
}
