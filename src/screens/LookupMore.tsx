// More SRD lookup tabs (everyone, players too): equipment with the weapon property and Weapon Mastery
// texts, and features (class and subclass features, species traits, feats), all English SRD text.
import { useState } from 'react'
import { CLASSES } from '../rules'
import { costLine, KIND_FILTERS, searchItems } from '../model/equipment'
import { ItemDetails } from './Inventory'
import { useEquipment, useFeaturesTh, useFeatureTexts } from './useSrdData'
import FeatureText from './FeatureText'
import { TextInput } from '../ui/kit'

const chip = (on: boolean) => `rounded-full border px-3 py-1 text-sm ${on ? 'border-amber-400 bg-amber-800 font-bold' : 'border-stone-600'}`

export function EquipmentSearch() {
  const data = useEquipment()
  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState(0)
  const [open, setOpen] = useState<string | null>(null)
  if (!data) return <p className="text-stone-400">กำลังโหลด…</p>
  const rules = filter === KIND_FILTERS.length
  const found = rules ? [] : searchItems(data, query, query ? undefined : KIND_FILTERS[filter].kinds)
  const q = query.trim().toLowerCase()
  const texts = [...data.masteries.map((m) => ({ ...m, tag: 'Mastery' })), ...data.properties.map((p) => ({ ...p, tag: 'Property' }))]
    .filter((t) => !q || t.name.toLowerCase().includes(q))
  return (
    <div className="space-y-3">
      <TextInput value={query} placeholder="ค้นหา เช่น longsword, chain, rope, vex" onChange={setQuery} />
      <div className="flex flex-wrap gap-1.5">
        {KIND_FILTERS.map((f, i) => <button key={f.label} type="button" className={chip(i === filter)} onClick={() => setFilter(i)}>{f.label}</button>)}
        <button type="button" className={chip(rules)} onClick={() => setFilter(KIND_FILTERS.length)}>Mastery & Properties</button>
      </div>
      {!rules && (
        <ul className="space-y-1">
          {found.map((i) => (
            <li key={i.id} className="rounded-lg bg-stone-800 px-3 py-2">
              <button type="button" className="flex w-full items-baseline justify-between gap-2 text-left" onClick={() => setOpen(open === i.id ? null : i.id)} aria-expanded={open === i.id}>
                <span className="font-bold">{i.name}</span>
                <span className="shrink-0 text-xs text-stone-400">{i.weapon ? `${i.weapon.dice} ${i.weapon.damageType}` : i.armor ? `AC ${i.armor.category === 'Shield' ? '+' : ''}${i.armor.base}` : costLine(i.cost)}</span>
              </button>
              {open === i.id && <ItemDetails srd={i} />}
            </li>
          ))}
        </ul>
      )}
      {(rules || q) && (
        <ul className="space-y-2">
          {texts.map((t) => (
            <li key={t.tag + t.name} className="rounded-lg bg-stone-800 p-3 text-sm">
              <b className="text-amber-200">{t.name}</b> <span className="text-xs text-stone-500">{t.tag === 'Mastery' ? 'Weapon Mastery' : 'Weapon Property'}</span>
              <p className="mt-1 text-stone-300">{t.text}</p>
            </li>
          ))}
        </ul>
      )}
      <p className="text-xs text-stone-500">SRD 5.2.1 (CC-BY-4.0) · ราคาและน้ำหนักตามตารางใน SRD</p>
    </div>
  )
}

const SOURCES = ['ทั้งหมด', ...CLASSES, 'Species', 'Feats'] as const

export function FeatureSearch() {
  const data = useFeatureTexts()
  const thai = useFeaturesTh()
  const [query, setQuery] = useState('')
  const [source, setSource] = useState<(typeof SOURCES)[number]>('ทั้งหมด')
  const [open, setOpen] = useState<string | null>(null)
  if (!data) return <p className="text-stone-400">กำลังโหลด…</p>
  const words = query.toLowerCase().split(/\s+/).filter(Boolean)
  const all = [
    ...data.classFeatures.map((f) => ({ id: f.id, name: f.name, group: f.className, tag: `${f.subclass ?? f.className} ${f.level}`, text: f.text })),
    ...data.traits.map((t) => ({ id: t.id, name: t.name, group: 'Species', tag: t.species.join(', '), text: t.text })),
    ...data.feats.map((f) => ({ id: f.id, name: f.name, group: 'Feats', tag: `${f.type} Feat`, text: f.text })),
  ]
  const found = all
    .filter((e) => source === 'ทั้งหมด' || e.group === source)
    .filter((e) => words.every((w) => e.name.toLowerCase().includes(w) || !!thai[e.id]?.name.includes(w)))
  return (
    <div className="space-y-3">
      <TextInput value={query} placeholder="ค้นหาชื่อ เช่น rage, sneak, second wind, alert, ตื่นตัว" onChange={setQuery} />
      <select className="w-full rounded-lg border border-stone-600 bg-stone-900 px-3 py-2" value={source} onChange={(e) => setSource(e.target.value as (typeof SOURCES)[number])} aria-label="จาก">
        {SOURCES.map((s) => <option key={s} value={s}>{s}</option>)}
      </select>
      <ul className="space-y-1">
        {found.slice(0, 150).map((e) => (
          <li key={e.id} className="rounded-lg bg-stone-800 px-3 py-2">
            <button type="button" className="flex w-full items-baseline justify-between gap-2 text-left" onClick={() => setOpen(open === e.id ? null : e.id)} aria-expanded={open === e.id}>
              <span><b>{e.name}</b>{thai[e.id] && <span className="text-sm text-stone-400"> · {thai[e.id].name}</span>}</span>
              <span className="shrink-0 text-xs text-stone-400">{e.tag}</span>
            </button>
            {open === e.id && <FeatureText text={e.text} th={thai[e.id]} />}
          </li>
        ))}
      </ul>
      <p className="text-xs text-stone-500">{found.length} รายการ · ข้อความกติกาเต็มจาก SRD 5.2.1 (CC-BY-4.0) · Feat มีคำแปลไทยจาก DND-TH</p>
    </div>
  )
}
