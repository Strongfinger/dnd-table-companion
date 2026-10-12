// SRD lookup (Phase 3.2): monsters (full stat blocks, DM only); spells, rules & conditions, equipment and
// features (everyone).
// The data loads only when its tab opens.
import { useLiveQuery } from 'dexie-react-hooks'
import { useState, type ReactNode } from 'react'
import { useLobby } from '../app/useLobby'
import { getCharacter } from '../db/characters'
import { listEncounters } from '../db/encounters'
import { addMonstersToFight } from '../db/turns'
import { GLOSSARY_TERMS, lookupTerm } from '../model/glossary'
import type { FullMonster } from '../model/monsterDetails'
import { formatCR, monsterInput, searchMonsters } from '../model/monsters'
import { castingTimeLine, componentsLine, searchSpells, spellLevelLine, type SrdSpell } from '../model/spells'
import MonsterStatBlock from '../ui/MonsterStatBlock'
import { EquipmentSearch, FeatureSearch } from './LookupMore'
import { useMonsters, useSpells } from './useSrdData'
import { Button, NumberInput, Section, TextInput } from '../ui/kit'

export type LookupTab = 'monsters' | 'spells' | 'rules' | 'equipment' | 'features'

const CR_FILTERS = [
  { value: 30, label: 'ทุก CR' }, { value: 0.25, label: 'CR ≤ 1/4' }, { value: 1, label: 'CR ≤ 1' },
  { value: 3, label: 'CR ≤ 3' }, { value: 5, label: 'CR ≤ 5' }, { value: 10, label: 'CR ≤ 10' },
]

/** Monster stats are the DM's: a player in a live room only gets spells and rules & conditions. */
const useIsPlayer = () => useLobby().session?.role === 'player'


export default function Lookup({ tab }: { tab: LookupTab | null }) {
  const isPlayer = useIsPlayer()
  const current: LookupTab = isPlayer && (tab === 'monsters' || !tab) ? 'spells' : tab ?? 'monsters'
  const tabs: { id: LookupTab; label: string }[] = [
    ...(isPlayer ? [] : [{ id: 'monsters' as const, label: '👹 มอนสเตอร์' }]),
    { id: 'spells', label: '✨ คาถา' },
    { id: 'rules', label: '📖 กติกา & Conditions' },
    { id: 'equipment', label: '⚔️ อุปกรณ์' },
    { id: 'features', label: '🧬 ความสามารถ' },
  ]
  return (
    <div className="space-y-4">
      <header>
        <h1 className="text-3xl font-bold text-amber-400">📖 ค้นหา SRD</h1>
        <p className="text-sm text-stone-400">ข้อมูล SRD 5.2.1 ใช้ได้แม้ไม่มีอินเทอร์เน็ต</p>
      </header>
      <div className="flex flex-wrap gap-2">
        {tabs.map((t) => (
          <a key={t.id} href={`#/lookup/${t.id}`} className={`rounded-full border px-3 py-1 text-sm ${current === t.id ? 'border-amber-400 bg-amber-500 font-bold text-stone-900' : 'border-stone-600'}`}>
            {t.label}
          </a>
        ))}
      </div>
      {current === 'monsters' ? <MonsterSearch /> : current === 'spells' ? <SpellSearch />
        : current === 'equipment' ? <EquipmentSearch /> : current === 'features' ? <FeatureSearch /> : <RulesSearch />}
    </div>
  )
}

/** Open a result: on the lookup page it's a link; inside the DM panel it opens in the panel. */
export type OpenResult = (r: { kind: 'monster' | 'spell'; id: string }) => void

/** A result row: a link to its page, or a button when `onOpen` is given (DM panel). */
function ResultLink({ href, onOpen, className, children }: { href: string; onOpen?: () => void; className: string; children: ReactNode }) {
  return onOpen
    ? <button type="button" onClick={onOpen} className={`w-full text-left ${className}`}>{children}</button>
    : <a href={href} className={className}>{children}</a>
}

export function MonsterSearch({ onOpen }: { onOpen?: OpenResult }) {
  const monsters = useMonsters()
  const [query, setQuery] = useState('')
  const [crMax, setCrMax] = useState(30)
  if (!monsters) return <p className="text-stone-400">กำลังโหลดข้อมูลมอนสเตอร์…</p>
  const found = searchMonsters(monsters, query, crMax) as FullMonster[]
  return (
    <div className="space-y-3">
      <div className="flex gap-2">
        <div className="flex-1"><TextInput value={query} placeholder="ชื่อหรือประเภท เช่น goblin, dragon, undead" onChange={setQuery} /></div>
        <select aria-label="CR" className="rounded-lg border border-stone-600 bg-stone-900 px-2 text-base" value={crMax} onChange={(e) => setCrMax(Number(e.target.value))}>
          {CR_FILTERS.map((f) => <option key={f.value} value={f.value}>{f.label}</option>)}
        </select>
      </div>
      <p className="text-xs text-stone-500">พบ {found.length} ตัว</p>
      <ul className="space-y-1">
        {found.slice(0, 100).map((m) => (
          <li key={m.id}>
            <ResultLink href={`#/lookup/monster/${m.id}`} onOpen={onOpen && (() => onOpen({ kind: 'monster', id: m.id }))} className="flex items-center justify-between gap-2 rounded-lg bg-stone-800 px-3 py-2 hover:bg-stone-700">
              <span>
                <b>{m.name}</b>
                <span className="ml-2 text-xs text-stone-400">{m.size} {m.type}</span>
              </span>
              <span className="text-right text-sm text-stone-400">CR {formatCR(m.cr)} · AC {m.ac} · HP {m.hp}</span>
            </ResultLink>
          </li>
        ))}
      </ul>
      {found.length > 100 && <p className="text-xs text-stone-500">แสดง 100 ตัวแรก · พิมพ์ค้นหาเพื่อหาตัวอื่น</p>}
    </div>
  )
}

const CLASS_OPTIONS = ['Bard', 'Cleric', 'Druid', 'Paladin', 'Ranger', 'Sorcerer', 'Warlock', 'Wizard']


export function SpellSearch({ onOpen }: { onOpen?: OpenResult }) {
  const spells = useSpells()
  // A player in a room starts with their own character's class.
  const myCharacterId = useLobby().session?.characterId ?? null
  const myClass = useLiveQuery(async () => (myCharacterId ? (await getCharacter(myCharacterId))?.className ?? null : null), [myCharacterId])
  const [query, setQuery] = useState('')
  const [level, setLevel] = useState<number | null>(null)
  const [className, setClassName] = useState<string | null | undefined>(undefined)
  const cls = className === undefined ? (myClass && CLASS_OPTIONS.includes(myClass) ? myClass : null) : className
  if (!spells) return <p className="text-stone-400">กำลังโหลดข้อมูลคาถา…</p>
  const found = searchSpells(spells, { query, level, className: cls })
  const select = 'rounded-lg border border-stone-600 bg-stone-900 px-2 py-2 text-base'
  return (
    <div className="space-y-3">
      <TextInput value={query} placeholder="ชื่อคาถาหรือ School เช่น fireball, cure, evocation" onChange={setQuery} />
      <div className="flex gap-2">
        <select aria-label="Level" className={`flex-1 ${select}`} value={level ?? ''} onChange={(e) => setLevel(e.target.value === '' ? null : Number(e.target.value))}>
          <option value="">ทุก Level</option>
          <option value="0">Cantrip</option>
          {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((n) => <option key={n} value={n}>Level {n}</option>)}
        </select>
        <select aria-label="Class" className={`flex-1 ${select}`} value={cls ?? ''} onChange={(e) => setClassName(e.target.value || null)}>
          <option value="">ทุก Class</option>
          {CLASS_OPTIONS.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
      </div>
      <p className="text-xs text-stone-500">พบ {found.length} คาถา · C = Concentration · R = Ritual</p>
      <ul className="space-y-1">
        {found.slice(0, 150).map((sp) => (
          <li key={sp.id}>
            <ResultLink href={`#/lookup/spell/${sp.id}`} onOpen={onOpen && (() => onOpen({ kind: 'spell', id: sp.id }))} className="flex items-center justify-between gap-2 rounded-lg bg-stone-800 px-3 py-2 hover:bg-stone-700">
              <span>
                <b>{sp.name}</b>
                {sp.concentration && <span className="ml-1 rounded bg-violet-900 px-1 text-xs">C</span>}
                {sp.ritual && <span className="ml-1 rounded bg-sky-900 px-1 text-xs">R</span>}
                <span className="block text-xs text-stone-400">{spellLevelLine(sp)}</span>
              </span>
              <span className="text-right text-xs text-stone-400">{sp.castingTime.split(',')[0]} · {sp.range}</span>
            </ResultLink>
          </li>
        ))}
      </ul>
      {found.length > 150 && <p className="text-xs text-stone-500">แสดง 150 รายการแรก · เลือก Level หรือ Class เพื่อดูส่วนอื่น</p>}
    </div>
  )
}

const Row = ({ label, children }: { label: string; children: ReactNode }) => <p><b className="text-amber-200">{label}:</b> {children}</p>

export function SpellView({ id }: { id: string }) {
  const spells = useSpells()
  if (!spells) return <p className="text-stone-400">กำลังโหลด…</p>
  const sp = spells.find((x) => x.id === id)
  if (!sp) return <p className="text-center text-stone-400">ไม่พบคาถานี้ · <a href="#/lookup/spells" className="underline">กลับ</a></p>
  return (
    <div className="space-y-4">
      <a href="#/lookup/spells" className="text-sm text-stone-400">← คาถาทั้งหมด</a>
      <SpellCard sp={sp} />
    </div>
  )
}

/** One spell, 2024 style. */
export function SpellCard({ sp }: { sp: SrdSpell }) {
  return (
    <article className="space-y-3 rounded-xl border border-violet-900/60 bg-stone-900 p-4 text-sm leading-relaxed">
      <header>
        <h2 className="text-2xl font-bold text-amber-400">{sp.name}</h2>
        <p className="italic text-stone-400">{spellLevelLine(sp)} ({sp.classes.join(', ')})</p>
      </header>
      <div className="space-y-0.5">
        <Row label="Casting Time">{castingTimeLine(sp)}</Row>
        <Row label="Range">{sp.range}</Row>
        <Row label="Components">{componentsLine(sp)}</Row>
        <Row label="Duration">{sp.concentration && !sp.duration.startsWith('Concentration') ? `Concentration, ${sp.duration}` : sp.duration}</Row>
      </div>
      <div className="whitespace-pre-line">{sp.text.replace(/\n\s+/g, '\n')}</div>
      {sp.higher && <p><b><i>{sp.level === 0 ? 'Cantrip Upgrade.' : 'Using a Higher-Level Spell Slot.'}</i></b> {sp.higher.replace(/^Using a Higher-Level Spell Slot\.\s*/, '').replace(/^Cantrip Upgrade\.\s*/, '')}</p>}
      <p className="text-xs text-stone-500">SRD 5.2.1 (CC-BY-4.0)</p>
    </article>
  )
}

export function RulesSearch() {
  const [query, setQuery] = useState('')
  const q = query.trim().toLowerCase()
  const entries = GLOSSARY_TERMS.map((t) => ({ term: t, entry: lookupTerm(t)! }))
    .filter(({ term, entry }) => !q || term.toLowerCase().includes(q) || entry.title.toLowerCase().includes(q) || entry.text.toLowerCase().includes(q))
  return (
    <div className="space-y-3">
      <TextInput value={query} placeholder="ค้นหา เช่น Prone, Grappled, Dash, Advantage, ล้มลง" onChange={setQuery} />
      <p className="text-xs text-stone-500">คำอธิบายย่อภาษาไทย (เขียนเอง ไม่ใช่ข้อความกติกาเต็ม) · {entries.length} คำ</p>
      <ul className="space-y-2">
        {entries.map(({ term, entry }) => (
          <li key={term} className="rounded-lg bg-stone-800 p-3 text-sm">
            <b className="text-amber-200">{entry.title}</b>
            <p className="mt-1 text-stone-300">{entry.text}</p>
          </li>
        ))}
      </ul>
    </div>
  )
}

export function MonsterView({ id }: { id: string }) {
  const isPlayer = useIsPlayer()
  const monsters = useMonsters()
  if (isPlayer) return <p className="text-center text-stone-400">ข้อมูลมอนสเตอร์ดูได้เฉพาะ DM · <a href="#/lookup/rules" className="underline">กลับ</a></p>
  if (!monsters) return <p className="text-stone-400">กำลังโหลด…</p>
  const m = monsters.find((x) => x.id === id)
  if (!m) return <p className="text-center text-stone-400">ไม่พบมอนสเตอร์นี้ · <a href="#/lookup/monsters" className="underline">กลับ</a></p>
  return (
    <div className="space-y-4">
      <a href="#/lookup/monsters" className="text-sm text-stone-400">← มอนสเตอร์ทั้งหมด</a>
      <AddToFight m={m} />
      <MonsterStatBlock m={m} />
    </div>
  )
}

/** Put this monster into a fight that hasn't ended (average HP; numbered copies). */
function AddToFight({ m }: { m: FullMonster }) {
  const fights = (useLiveQuery(listEncounters) ?? []).filter((e) => e.status !== 'ended')
  const [fightId, setFightId] = useState('')
  const [count, setCount] = useState(1)
  const [done, setDone] = useState<{ fightId: string; names: string[] } | null>(null)
  const chosen = fightId || fights[0]?.id || ''
  if (fights.length === 0) return <p className="text-xs text-stone-500">สร้างการต่อสู้ในแท็บ ⚔️ การต่อสู้ ก่อน แล้วจะเพิ่มมอนสเตอร์จากหน้านี้ได้</p>

  async function add() {
    if (!chosen) return
    const names = await addMonstersToFight(chosen, monsterInput(m), count)
    setDone({ fightId: chosen, names })
  }

  return (
    <Section title="➕ เพิ่มเข้าการต่อสู้">
      <div className="flex flex-wrap items-center gap-2">
        <select aria-label="การต่อสู้" className="min-w-0 flex-1 rounded-lg border border-stone-600 bg-stone-900 px-3 py-2 text-base" value={chosen} onChange={(e) => setFightId(e.target.value)}>
          {fights.map((f) => <option key={f.id} value={f.id}>{f.name}{f.status === 'active' ? ` (รอบที่ ${f.round})` : ' (เตรียมการ)'}</option>)}
        </select>
        <NumberInput value={count} min={1} max={20} onChange={setCount} />
        <Button variant="primary" onClick={add}>เพิ่ม {count} ตัว</Button>
      </div>
      {done && (
        <p className="mt-2 text-sm text-emerald-300">
          เพิ่ม {done.names.join(', ')} แล้ว (HP เฉลี่ย {m.hp}) · <a href={`#/fight/${done.fightId}`} className="underline">เปิดการต่อสู้</a>
        </p>
      )}
    </Section>
  )
}
