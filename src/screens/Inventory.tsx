// The sheet's inventory: coins, items, and an "equip" toggle for SRD weapons, armor and Shields
// (equipped weapons show up as attacks). "+ เพิ่มของ" picks SRD 5.2.1 equipment (a pack adds what's
// inside). Changes save at once; in a live room they go to the DM like other sheet edits.
// Names and quantities of any item are edited on the edit page.
import { useState } from 'react'
import { useLobby } from '../app/useLobby'
import { updateCharacter } from '../db/characters'
import type { Character, InventoryItem } from '../model/character'
import { armorClassLine, costLine, findItem, searchItems, weaponPropertiesLine, type EquipmentKind, type SrdEquipment, type SrdItem } from '../model/equipment'
import { addSrdItem, isEquippable, toggleEquipped } from '../model/inventory'
import { Button, Section, TextInput } from '../ui/kit'
import { useEquipment } from './useSrdData'

const KIND_FILTERS: { label: string; kinds: EquipmentKind[] }[] = [
  { label: 'อาวุธ', kinds: ['weapon', 'ammunition'] },
  { label: 'เกราะ/โล่', kinds: ['armor', 'shield'] },
  { label: 'แพ็ก', kinds: ['pack'] },
  { label: 'เครื่องมือ', kinds: ['tool'] },
  { label: 'ของใช้', kinds: ['gear', 'focus'] },
]

export default function Inventory({ c }: { c: Character }) {
  const lobby = useLobby()
  const data = useEquipment()
  const [adding, setAdding] = useState(false)
  const coins = Object.entries(c.coins).filter(([, n]) => n > 0)

  async function change(fn: (latest: Character) => Character) {
    await updateCharacter(c.id, (latest) => ({ character: fn(latest), text: '' }))
    lobby.shareSheet(c.id)
  }

  // Equipped things first, then the rest in the order they were added.
  const items = [...c.inventory].sort((a, b) => Number(!!b.equipped) - Number(!!a.equipped))
  return (
    <Section
      title="ของในกระเป๋า (Inventory)"
      action={<Button variant="primary" className="text-sm" onClick={() => setAdding(!adding)}>{adding ? 'ปิด' : '+ เพิ่มของ'}</Button>}
    >
      {adding && <ItemPicker data={data} onAdd={(item) => data && change((latest) => addSrdItem(latest, item, data))} />}
      {coins.length > 0 && <p className="mb-2 text-amber-300">{coins.map(([k, n]) => `${n} ${k.toUpperCase()}`).join(' · ')}</p>}
      {items.length === 0 && !adding && <p className="text-sm text-stone-500">ยังไม่มีของ กด "+ เพิ่มของ" เพื่อเลือกจาก SRD 5.2.1</p>}
      <ul className="divide-y divide-stone-800">
        {items.map((item) => (
          <ItemRow key={item.id} item={item} srd={data && item.srdId ? findItem(data, item.srdId) : undefined}
            onToggle={() => data && change((latest) => toggleEquipped(latest, item.id, data))} />
        ))}
      </ul>
      {c.inventory.some((i) => i.equipped && i.srdId && data && findItem(data, i.srdId)?.armor) && (
        <p className="mt-2 text-xs text-stone-500">AC ยังเป็นค่าที่ใส่เองในหน้าแก้ไข (การคำนวณ AC จากเกราะที่สวมกำลังจะมา)</p>
      )}
    </Section>
  )
}

function ItemRow({ item, srd, onToggle }: { item: InventoryItem; srd: SrdItem | undefined; onToggle: () => void }) {
  const [open, setOpen] = useState(false)
  const verb = srd?.kind === 'weapon' ? 'ถือ' : 'สวม'
  return (
    <li className="py-1.5">
      <div className="flex items-center gap-2">
        <button type="button" className={`min-w-0 flex-1 text-left ${item.equipped ? 'font-bold text-amber-300' : ''}`} onClick={() => setOpen(!open)} disabled={!srd}>
          {item.name}{item.qty !== 1 && <span className="font-normal text-stone-400"> ×{item.qty}</span>}
          {srd && <span className="ml-1 text-xs font-normal text-stone-500">ⓘ</span>}
        </button>
        {isEquippable(srd) && (
          <button
            type="button"
            onClick={onToggle}
            aria-pressed={!!item.equipped}
            className={`shrink-0 rounded-full border px-3 py-1 text-sm ${item.equipped ? 'border-amber-400 bg-amber-800 font-bold' : 'border-stone-600 text-stone-300'}`}
          >
            {item.equipped ? `✓ ${verb}อยู่` : verb}
          </button>
        )}
      </div>
      {open && srd && <ItemDetails srd={srd} />}
    </li>
  )
}

function ItemDetails({ srd }: { srd: SrdItem }) {
  return (
    <div className="mt-1 space-y-1 rounded-lg bg-stone-900 p-2 text-sm text-stone-300">
      {srd.weapon && <p>{srd.weapon.category} {srd.weapon.type} · {srd.weapon.dice} {srd.weapon.damageType}{srd.weapon.properties.length > 0 && ` · ${weaponPropertiesLine(srd.weapon)}`} · Mastery: {srd.weapon.mastery}</p>}
      {srd.armor && (
        <p>
          {srd.armor.category === 'Shield' ? 'Shield' : `${srd.armor.category} Armor`} · AC {armorClassLine(srd.armor)}
          {srd.armor.strMin > 0 && ` · Str ${srd.armor.strMin}`}
          {srd.armor.stealthDisadvantage && ' · Stealth Disadvantage'}
        </p>
      )}
      {srd.utilize && <p>Ability: {srd.ability?.toUpperCase()} · {srd.utilize.join(', ')}</p>}
      {srd.text && <p className="whitespace-pre-wrap">{srd.text}</p>}
      <p className="text-xs text-stone-500">{costLine(srd.cost)}{srd.weight ? ` · ${srd.weight} lb.` : ''}</p>
    </div>
  )
}

function ItemPicker({ data, onAdd }: { data: SrdEquipment | null; onAdd: (item: SrdItem) => void }) {
  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState(0)
  const [added, setAdded] = useState<string | null>(null)
  if (!data) return <p className="mb-3 text-sm text-stone-400">กำลังโหลดอุปกรณ์…</p>
  const found = searchItems(data, query, query ? undefined : KIND_FILTERS[filter].kinds)

  return (
    <div className="mb-3 space-y-2 rounded-lg bg-stone-900 p-3">
      <TextInput value={query} placeholder="ค้นหา เช่น sword, rope, leather" onChange={setQuery} />
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
              <span className="font-bold">{i.name}</span>{i.qty && i.qty > 1 && <span className="text-stone-400"> ×{i.qty}</span>}
              <span className="block text-xs text-stone-400">{pickerLine(i)}</span>
            </span>
            {added === i.id
              ? <span className="text-xs whitespace-nowrap text-emerald-400">✓ เพิ่มแล้ว</span>
              : <Button className="px-3 py-1 text-sm" onClick={() => { onAdd(i); setAdded(i.id) }}>+ เพิ่ม</Button>}
          </li>
        ))}
      </ul>
      {found.length === 0 && <p className="text-xs text-stone-500">ไม่พบ · ของที่ไม่มีใน SRD เพิ่มได้ในหน้าแก้ไข</p>}
    </div>
  )
}

function pickerLine(i: SrdItem): string {
  if (i.weapon) return `${i.weapon.dice} ${i.weapon.damageType} · ${i.weapon.category} · ${costLine(i.cost)}`
  if (i.armor) return `AC ${armorClassLine(i.armor)} · ${i.armor.category} · ${costLine(i.cost)}`
  if (i.kind === 'pack') return `ใส่ของข้างในทั้งหมด (${i.contents?.length ?? 0} อย่าง) · ${costLine(i.cost)}`
  return costLine(i.cost)
}
