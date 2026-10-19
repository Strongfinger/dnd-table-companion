// The sheet's coin purse and inventory. Coins: pick a coin, type an amount, then "รับ" or "จ่าย" (paying
// breaks bigger coins and gives change, src/rules/coins.ts). Items: one per slot (head, neck, two rings, … main hand,
// off hand, back; model/inventory.ts); "+ เพิ่มของ" picks SRD 5.2.1 equipment (a pack adds what's inside)
// or adds a custom item by name. Changes save at once; in a live room they go to the DM like other sheet edits.
// Names and quantities of any item are edited on the edit page.
import { useState } from 'react'
import { useLobby } from '../app/useLobby'
import { updateCharacter } from '../db/characters'
import { EQUIP_SLOTS, type Character, type EquipSlot, type InventoryItem } from '../model/character'
import { armorClassLine, costLine, findItem, KIND_FILTERS, searchItems, weaponPropertiesLine, type SrdEquipment, type SrdItem } from '../model/equipment'
import { addPlainItem, addSrdItem, equipItem, normalizeEquipment, SLOT_LABEL, slotContents, slotsFor, unequipItem } from '../model/inventory'
import { COIN_VALUE_CP, gainCoins, spendCoins, totalCopper, type Coin } from '../rules'
import { Button, Section, Select, TextInput } from '../ui/kit'
import { useEquipment, useEquipmentTh } from './useSrdData'
import { WithThai } from '../ui/ThaiText'

type Change = (fn: (latest: Character) => Character) => void

export default function Inventory({ c }: { c: Character }) {
  const lobby = useLobby()
  const data = useEquipment()
  const [adding, setAdding] = useState(false)

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
      <CoinPurse c={c} change={change} />
      <Section
        title="ของในกระเป๋า (Inventory)"
        action={<Button variant="primary" className="text-sm" onClick={() => setAdding(!adding)}>{adding ? 'ปิด' : '+ เพิ่มของ'}</Button>}
      >
        {adding && (
          <ItemPicker data={data} onAdd={(item) => data && change((latest) => addSrdItem(latest, item, data))}
            onAddCustom={(name, qty, wear) => change((latest) => addPlainItem(latest, name, qty, wear))} />
        )}
        {data && <SlotGrid slots={slots} data={data} onTakeOff={(id) => change((latest) => unequipItem(latest, id, data))} />}
        {pack.length === 0 && !adding && <p className="text-sm text-stone-500">ไม่มีของในเป้ กด "+ เพิ่มของ" เพื่อเลือกจาก SRD 5.2.1 หรือพิมพ์ชื่อของเอง</p>}
        <ul className="divide-y divide-stone-800">
          {pack.map((item) => {
            const srd = data && item.srdId ? findItem(data, item.srdId) : undefined
            return (
              <ItemRow key={item.id} item={item} srd={srd} slots={slots}
                onEquip={(slot) => data && change((latest) => equipItem(latest, item.id, slot, data))} />
            )
          })}
        </ul>
        <p className="mt-2 text-xs text-stone-500">ใส่ได้ช่องละ 1 ชิ้น · อาวุธสองมือใช้ทั้งมือหลักและมือรอง · สวม/ถอดเกราะหรือ Shield แล้ว AC คำนวณให้เอง (ปิดได้ในหน้าแก้ไข)</p>
      </Section>
    </>
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

function ItemRow({ item, srd, slots, onEquip }: {
  item: InventoryItem
  srd: SrdItem | undefined
  slots: Partial<Record<EquipSlot, InventoryItem>>
  onEquip: (slot: EquipSlot) => void
}) {
  const [open, setOpen] = useState(false)
  const [choosing, setChoosing] = useState(false)
  const fits = slotsFor(item, srd)
  const verb = srd?.kind === 'weapon' || fits.includes('mainHand') ? 'ถือ' : 'สวม'
  return (
    <li className="py-1.5">
      <div className="flex items-center gap-2">
        <button type="button" className="min-w-0 flex-1 text-left" onClick={() => setOpen(!open)} disabled={!srd}>
          {item.name}{item.qty !== 1 && <span className="font-normal text-stone-400"> ×{item.qty}</span>}
          {item.wear && <span className="ml-1 text-xs text-stone-500">({SLOT_LABEL[item.wear]})</span>}
          {srd && <span className="ml-1 text-xs font-normal text-stone-500">ⓘ</span>}
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
      {open && srd && <ItemDetails srd={srd} />}
    </li>
  )
}

/**
 * An SRD item's stats and text; the text (and a tool's uses) in Thai with the ไทย/EN switch when DND-TH has it.
 * The Thai name shows here unless the list row above already has it (`rowHasThaiName`).
 */
export function ItemDetails({ srd, rowHasThaiName = false }: { srd: SrdItem; rowHasThaiName?: boolean }) {
  const thai = useEquipmentTh()
  const th = thai.items[srd.id]
  const thText = [th?.utilize && `**ใช้งาน:** ${th.utilize}`, th?.text].filter(Boolean).join('\n\n')
  const mastery = srd.weapon && thai.masteries[srd.weapon.mastery]
  return (
    <div className="mt-1 space-y-1 rounded-lg bg-stone-900 p-2 text-sm text-stone-300">
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
    </div>
  )
}

function ItemPicker({ data, onAdd, onAddCustom }: {
  data: SrdEquipment | null
  onAdd: (item: SrdItem) => void
  onAddCustom: (name: string, qty: number, wear: EquipSlot | undefined) => void
}) {
  const thai = useEquipmentTh().items
  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState(0)
  const [added, setAdded] = useState<string | null>(null)
  if (!data) return <CustomItemForm initialName={query} onAdd={onAddCustom} />
  const found = searchItems(data, query, query ? undefined : KIND_FILTERS[filter].kinds, thai)

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
      </ul>
      {found.length === 0 && <p className="text-xs text-stone-500">ไม่พบใน SRD · เพิ่มเป็นของ custom ด้านล่างได้</p>}
      <CustomItemForm key={found.length === 0 ? query : ''} initialName={found.length === 0 ? query : ''} onAdd={onAddCustom} />
    </div>
  )
}

/** Wear slots a custom item can have: "in a hand" means either hand, a ring either ring slot. */
const WEAR_OPTIONS: { value: EquipSlot | ''; label: string }[] = [
  { value: '', label: 'ไม่ได้สวมใส่ (เก็บในเป้)' },
  ...EQUIP_SLOTS.filter((s) => s !== 'offHand' && s !== 'ring2').map((s) => ({ value: s, label: s === 'mainHand' ? 'ถือในมือ' : s === 'ring1' ? 'สวมที่นิ้ว (แหวน)' : `สวมที่${SLOT_LABEL[s]}` })),
]

/** A custom item the SRD list doesn't have (a quest item, a reward from the DM…). */
function CustomItemForm({ initialName, onAdd }: { initialName: string; onAdd: (name: string, qty: number, wear: EquipSlot | undefined) => void }) {
  const [name, setName] = useState(initialName)
  const [qty, setQty] = useState('1')
  const [wear, setWear] = useState<EquipSlot | ''>('')
  const [added, setAdded] = useState<string | null>(null)
  const n = Math.max(1, Math.min(9999, Math.floor(Number(qty)) || 1))
  function add() {
    if (!name.trim()) return
    onAdd(name, n, wear || undefined)
    setAdded(name.trim())
    setName('')
    setQty('1')
    setWear('')
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
