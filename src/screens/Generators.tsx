// The DM's generators (Phase 3.5), on the DM tab and in the fight panel: NPC, tavern/shop, plot hook,
// loot, quick encounter, weather & event. Every part can be rerolled (🔄); NPCs, places and quests are
// saved to the campaign notebook in one tap, loot's magic items as item pages, encounters as a fight.
import { useState, type ReactNode } from 'react'
import { go } from '../app/router'
import { saveEncounter } from '../db/encounters'
import { saveNote } from '../db/notes'
import { addMonstersToFight } from '../db/turns'
import { createEncounter, createMonsters, type Combatant, type Encounter } from '../model/encounter'
import {
  DIFFICULTY_LABEL, genEncounter, genEvent, genHook, genLoot, genNpc, genTavern, genWeather, HOOK_PARTS, LOOT_BANDS,
  NPC_PARTS, reroll, TAVERN_PARTS, toPage, type Difficulty, type EventSetting, type GenEncounter, type GenHook, type GenLoot,
  type GenNpc, type GenTavern,
} from '../model/generators'
import { formatCR, monsterInput } from '../model/monsters'
import { createNote, KIND_FIELDS, QUEST_STATUS } from '../model/note'
import { sortByInitiative } from '../rules'
import { Button } from '../ui/kit'
import { useMagicItems, useMagicItemsTh, useMonsters } from './useSrdData'
import { MagicItemText } from './LookupMore'

type GenTab = 'npc' | 'tavern' | 'hook' | 'loot' | 'encounter' | 'weather'
const TABS: { id: GenTab; label: string }[] = [
  { id: 'npc', label: '🧑 NPC' }, { id: 'tavern', label: '🍺 ร้าน' }, { id: 'hook', label: '📜 ภารกิจ' },
  { id: 'loot', label: '💰 สมบัติ' }, { id: 'encounter', label: '⚔️ เผชิญหน้า' }, { id: 'weather', label: '🌦 อากาศ/เหตุการณ์' },
]
const rng = Math.random
const select = 'rounded-lg border border-stone-600 bg-stone-900 px-2 py-1.5 text-base'

/** `encounter`: in the fight panel, encounters are added to this fight instead of making a new one. */
export default function Generators({ campaignId, encounter }: { campaignId: string | null; encounter?: Encounter }) {
  const [tab, setTab] = useState<GenTab>('npc')
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-1">
        {TABS.map((t) => (
          <button key={t.id} type="button" onClick={() => setTab(t.id)} className={`rounded-full border px-2.5 py-1 text-xs ${tab === t.id ? 'border-amber-400 bg-amber-500 font-bold text-stone-900' : 'border-stone-600'}`}>
            {t.label}
          </button>
        ))}
      </div>
      {tab === 'npc' && <NpcGen campaignId={campaignId} />}
      {tab === 'tavern' && <TavernGen campaignId={campaignId} />}
      {tab === 'hook' && <HookGen campaignId={campaignId} />}
      {tab === 'loot' && <LootGen campaignId={campaignId} />}
      {tab === 'encounter' && <EncounterGen campaignId={campaignId} encounter={encounter} />}
      {tab === 'weather' && <WeatherGen />}
      <p className="text-xs text-stone-500">เนื้อหาสุ่มเป็น Homebrew ของแอปนี้ · มอนสเตอร์และไอเทมเวทจาก SRD 5.2.1</p>
    </div>
  )
}

/** One generated part with a 🔄 to roll just that part again. */
function Part({ label, children, onReroll }: { label: string; children: ReactNode; onReroll?: () => void }) {
  return (
    <div className="flex items-start gap-2 border-b border-stone-800 py-1.5 text-sm last:border-0">
      <span className="w-24 shrink-0 text-xs text-stone-400">{label}</span>
      <span className="min-w-0 flex-1">{children}</span>
      {onReroll && <button type="button" aria-label={`สุ่ม${label}ใหม่`} onClick={onReroll} className="shrink-0 rounded px-1.5 hover:bg-stone-700">🔄</button>}
    </div>
  )
}

/** Save a generated page to the notebook, then show where it went. */
function SaveButton({ campaignId, page }: { campaignId: string | null; page: () => ReturnType<typeof toPage> }) {
  const [saved, setSaved] = useState<{ id: string; title: string } | null>(null)
  async function save() {
    const p = page()
    const base = createNote(campaignId, Date.now(), p.kind, p.title)
    const n = await saveNote({ ...base, fields: { ...base.fields, ...p.fields }, body: p.body })
    setSaved({ id: n.id, title: n.title })
  }
  return saved ? (
    <p className="text-sm text-emerald-300">
      ✓ บันทึก "{saved.title}" ลงสมุดแล้ว · <button type="button" className="underline" onClick={() => go(`/dm/note/${saved.id}`)}>เปิดหน้า</button>
    </p>
  ) : (
    <Button className="w-full text-sm" onClick={save}>📒 บันทึกลงสมุดแคมเปญ</Button>
  )
}

const ATTITUDE_LABEL = Object.fromEntries(KIND_FIELDS.npc.find((f) => f.key === 'attitude')!.choices!.map((c) => [c.value, c.label]))

function NpcGen({ campaignId }: { campaignId: string | null }) {
  const [npc, setNpc] = useState<GenNpc>(() => genNpc(rng))
  const [key, setKey] = useState(0) // a new NPC = a new save button
  const re = (k: keyof GenNpc) => () => setNpc(reroll(NPC_PARTS, npc, k, rng))
  return (
    <div className="space-y-2">
      <div className="rounded-lg bg-stone-900 px-3 py-1">
        <Part label="ชื่อ" onReroll={re('name')}><b className="text-amber-300">{npc.name}</b></Part>
        <Part label="เผ่าพันธุ์" onReroll={re('species')}>{npc.species}</Part>
        <Part label="บทบาท" onReroll={re('role')}>{npc.role}</Part>
        <Part label="ท่าทีต่อปาร์ตี้" onReroll={re('attitude')}>{ATTITUDE_LABEL[npc.attitude]}</Part>
        <Part label="ลักษณะ" onReroll={re('look')}>{npc.look}</Part>
        <Part label="น้ำเสียง" onReroll={re('voice')}>{npc.voice}</Part>
        <Part label="นิสัย" onReroll={re('personality')}>{npc.personality}</Part>
        <Part label="ต้องการ" onReroll={re('wants')}>{npc.wants}</Part>
        <Part label="ความลับ (DM)" onReroll={re('secret')}>{npc.secret}</Part>
      </div>
      <Button variant="primary" className="w-full text-sm" onClick={() => { setNpc(genNpc(rng)); setKey(key + 1) }}>🎲 สุ่ม NPC ใหม่</Button>
      <SaveButton key={key} campaignId={campaignId} page={() => toPage({ kind: 'npc', npc })} />
    </div>
  )
}

function TavernGen({ campaignId }: { campaignId: string | null }) {
  const [t, setT] = useState<GenTavern>(() => genTavern(rng))
  const [key, setKey] = useState(0)
  const re = (k: keyof GenTavern) => () => setT(reroll(TAVERN_PARTS, t, k, rng))
  return (
    <div className="space-y-2">
      <div className="rounded-lg bg-stone-900 px-3 py-1">
        <Part label="ชื่อร้าน" onReroll={re('name')}><b className="text-amber-300">{t.name}</b></Part>
        <Part label="ประเภท" onReroll={re('type')}>{t.type}</Part>
        <Part label="เจ้าของ" onReroll={re('owner')}>{t.owner}</Part>
        <Part label="บรรยากาศ" onReroll={re('atmosphere')}>{t.atmosphere}</Part>
        <Part label="ของเด่น" onReroll={re('specialty')}>{t.specialty}</Part>
        <Part label="ข่าวลือ" onReroll={re('rumour')}>{t.rumour}</Part>
      </div>
      <Button variant="primary" className="w-full text-sm" onClick={() => { setT(genTavern(rng)); setKey(key + 1) }}>🎲 สุ่มร้านใหม่</Button>
      <SaveButton key={key} campaignId={campaignId} page={() => toPage({ kind: 'tavern', tavern: t })} />
      <p className="text-xs text-stone-500">บันทึกแล้วชื่อเจ้าของเป็นลิงก์ แตะในสมุดเพื่อสร้างหน้า NPC ของเจ้าของได้</p>
    </div>
  )
}

function HookGen({ campaignId }: { campaignId: string | null }) {
  const [h, setH] = useState<GenHook>(() => genHook(rng))
  const [key, setKey] = useState(0)
  const re = (k: keyof GenHook) => () => setH(reroll(HOOK_PARTS, h, k, rng))
  return (
    <div className="space-y-2">
      <div className="rounded-lg bg-stone-900 px-3 py-1">
        <Part label="ผู้ว่าจ้าง" onReroll={() => setH(reroll(HOOK_PARTS, reroll(HOOK_PARTS, h, 'patron', rng), 'patronRole', rng))}>
          {h.patron} <span className="text-stone-400">({h.patronRole})</span>
        </Part>
        <Part label="ปัญหา" onReroll={re('problem')}><b className="text-amber-300">{h.problem}</b></Part>
        <Part label="สถานที่" onReroll={re('place')}>{h.place}</Part>
        <Part label="รางวัล" onReroll={re('reward')}>{h.reward}</Part>
        <Part label="จุดหักมุม (DM)" onReroll={re('twist')}>{h.twist}</Part>
      </div>
      <Button variant="primary" className="w-full text-sm" onClick={() => { setH(genHook(rng)); setKey(key + 1) }}>🎲 สุ่มภารกิจใหม่</Button>
      <SaveButton key={key} campaignId={campaignId} page={() => toPage({ kind: 'hook', hook: h })} />
      <p className="text-xs text-stone-500">บันทึกเป็นหน้าภารกิจ สถานะ "{QUEST_STATUS[0].label}"</p>
    </div>
  )
}

function LootGen({ campaignId }: { campaignId: string | null }) {
  const items = useMagicItems()
  const thai = useMagicItemsTh()
  const [band, setBand] = useState(0)
  const [hoard, setHoard] = useState(true)
  const [loot, setLoot] = useState<GenLoot | null>(null)
  const [open, setOpen] = useState<string | null>(null)
  const [saved, setSaved] = useState('')
  if (!items) return <p className="text-sm text-stone-400">กำลังโหลดไอเทมเวท…</p>

  const roll = () => {
    setLoot(genLoot(items, band, hoard, rng))
    setSaved('')
  }
  async function saveItems() {
    if (!loot) return
    for (const it of loot.items) {
      const base = createNote(campaignId, Date.now(), 'item', it.name)
      await saveNote({ ...base, fields: { rarity: it.rarity, holder: 'ปาร์ตี้' }, body: it.attunement ? 'ต้อง Attune' : '' })
    }
    setSaved(`✓ บันทึกไอเทมเวท ${loot.items.length} ชิ้นลงสมุดแล้ว`)
  }
  const coinText = loot && [loot.coins.pp && `${loot.coins.pp.toLocaleString()} pp`, loot.coins.gp && `${loot.coins.gp.toLocaleString()} gp`, loot.coins.sp && `${loot.coins.sp} sp`].filter(Boolean).join(' · ')
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-2">
        <select aria-label="ระดับ" className={`flex-1 ${select}`} value={band} onChange={(e) => setBand(Number(e.target.value))}>
          {LOOT_BANDS.map((b, i) => <option key={b.label} value={i}>{b.label}</option>)}
        </select>
        <select aria-label="แบบสมบัติ" className={`flex-1 ${select}`} value={hoard ? 'hoard' : 'pocket'} onChange={(e) => setHoard(e.target.value === 'hoard')}>
          <option value="hoard">กองสมบัติ (หลังภารกิจ/บอส)</option>
          <option value="pocket">ของติดตัวศัตรูหนึ่งตัว</option>
        </select>
      </div>
      <Button variant="primary" className="w-full text-sm" onClick={roll}>🎲 สุ่มสมบัติ</Button>
      {loot && (
        <div className="space-y-1 rounded-lg bg-stone-900 p-3 text-sm">
          <p><b className="text-amber-300">💰 {coinText || '—'}</b></p>
          {loot.valuables.map((v, i) => <p key={i}>💎 {v.text} <span className="text-stone-400">({v.value} gp)</span></p>)}
          {loot.items.map((it, i) => (
            <div key={i}>
              <button type="button" className="text-left" onClick={() => setOpen(open === `${i}` ? null : `${i}`)}>
                ✨ <b>{it.name}</b>{thai[it.id] && <span className="text-stone-400"> · {thai[it.id].name}</span>} <span className="text-xs text-stone-400">{it.rarity} · {it.category}{it.attunement ? ' · ต้อง Attune' : ''}</span>
              </button>
              {open === `${i}` && <div className="mt-1 rounded bg-stone-800 p-2"><MagicItemText item={it} th={thai[it.id]?.text} /></div>}
            </div>
          ))}
          {loot.items.length > 0 && (saved ? <p className="text-emerald-300">{saved}</p> : <Button className="mt-2 w-full text-sm" onClick={saveItems}>📒 บันทึกไอเทมเวทลงสมุด</Button>)}
        </div>
      )}
      <p className="text-xs text-stone-500">จำนวนเงินเป็นแนวทางแบบง่าย (Homebrew) · แตะชื่อไอเทมเวทเพื่ออ่านรายละเอียด</p>
    </div>
  )
}

function EncounterGen({ campaignId, encounter }: { campaignId: string | null; encounter?: Encounter }) {
  const monsters = useMonsters()
  const [level, setLevel] = useState(3)
  const [size, setSize] = useState(4)
  const [difficulty, setDifficulty] = useState<Difficulty>('medium')
  const [type, setType] = useState('')
  const [result, setResult] = useState<GenEncounter | null>(null)
  const [done, setDone] = useState('')
  if (!monsters) return <p className="text-sm text-stone-400">กำลังโหลดมอนสเตอร์…</p>
  const types = [...new Set(monsters.map((m) => m.type))].sort()

  const roll = () => {
    setResult(genEncounter(monsters, { level, partySize: size, difficulty, type: type || null }, rng))
    setDone('')
  }
  async function addToThisFight() {
    if (!result || !encounter) return
    const names: string[] = []
    for (const g of result.groups) names.push(...(await addMonstersToFight(encounter.id, monsterInput(g.monster), g.count)))
    setDone(`✓ เพิ่ม ${names.join(', ')} แล้ว`)
  }
  async function newFight() {
    if (!result) return
    let combatants: Combatant[] = []
    for (const g of result.groups) combatants = sortByInitiative([...combatants, ...createMonsters(monsterInput(g.monster), g.count, combatants)])
    const title = `เผชิญหน้า: ${result.groups.map((g) => `${g.count}× ${g.monster.name}`).join(', ')}`
    const e = await saveEncounter({ ...createEncounter(title.slice(0, 100), campaignId), combatants })
    go(`/fight/${e.id}`)
  }
  return (
    <div className="space-y-2">
      <div className="grid grid-cols-2 gap-2 text-sm">
        <label>Level ปาร์ตี้
          <select className={`mt-1 w-full ${select}`} value={level} onChange={(e) => setLevel(Number(e.target.value))}>
            {Array.from({ length: 20 }, (_, i) => <option key={i} value={i + 1}>{i + 1}</option>)}
          </select>
        </label>
        <label>จำนวนผู้เล่น
          <select className={`mt-1 w-full ${select}`} value={size} onChange={(e) => setSize(Number(e.target.value))}>
            {[1, 2, 3, 4, 5, 6, 7, 8].map((n) => <option key={n} value={n}>{n}</option>)}
          </select>
        </label>
        <label>ความยาก
          <select className={`mt-1 w-full ${select}`} value={difficulty} onChange={(e) => setDifficulty(e.target.value as Difficulty)}>
            {(['easy', 'medium', 'hard'] as const).map((d) => <option key={d} value={d}>{DIFFICULTY_LABEL[d]}</option>)}
          </select>
        </label>
        <label>ประเภท
          <select className={`mt-1 w-full ${select}`} value={type} onChange={(e) => setType(e.target.value)}>
            <option value="">ทุกประเภท</option>
            {types.map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
        </label>
      </div>
      <Button variant="primary" className="w-full text-sm" onClick={roll}>🎲 สุ่มการเผชิญหน้า</Button>
      {result && (
        <div className="space-y-1 rounded-lg bg-stone-900 p-3 text-sm">
          {result.groups.length === 0 && <p className="text-stone-400">ไม่มีมอนสเตอร์ที่เข้ากับเงื่อนไขนี้ ลองเปลี่ยนประเภทหรือ Level</p>}
          {result.groups.map((g) => (
            <p key={g.monster.id}>
              <b>{g.count} × {g.monster.name}</b> <span className="text-stone-400">CR {formatCR(g.monster.cr)} · {g.monster.xp} XP · AC {g.monster.ac} · HP {g.monster.hp}</span>
            </p>
          ))}
          <p className="text-xs text-stone-400">XP รวม {result.totalXp.toLocaleString()} จากเป้า {result.budget.toLocaleString()} ({DIFFICULTY_LABEL[difficulty]})</p>
          {result.groups.length > 0 && (done
            ? <p className="text-emerald-300">{done}</p>
            : encounter && encounter.status !== 'ended'
              ? <Button className="mt-2 w-full text-sm" onClick={addToThisFight}>➕ เพิ่มเข้าการต่อสู้นี้</Button>
              : <Button className="mt-2 w-full text-sm" onClick={newFight}>⚔️ สร้างการต่อสู้จากผลนี้</Button>)}
        </div>
      )}
      <p className="text-xs text-stone-500">เป้า XP เป็นแนวทางแบบง่าย (Homebrew) ไม่ใช่ตารางในหนังสือ · ดู Stat block ได้ในแผง DM ระหว่างสู้</p>
    </div>
  )
}

function WeatherGen() {
  const [setting, setSetting] = useState<EventSetting>('road')
  const [weather, setWeather] = useState(() => genWeather(rng))
  const [event, setEvent] = useState(() => genEvent('road', rng))
  const names: Record<EventSetting, string> = { road: 'ระหว่างเดินทาง', town: 'ในเมือง', wild: 'ในป่า/ธรรมชาติ', dungeon: 'ในดันเจี้ยน' }
  return (
    <div className="space-y-2">
      <select aria-label="สถานการณ์" className={`w-full ${select}`} value={setting} onChange={(e) => { const s = e.target.value as EventSetting; setSetting(s); setEvent(genEvent(s, rng)) }}>
        {(Object.keys(names) as EventSetting[]).map((s) => <option key={s} value={s}>{names[s]}</option>)}
      </select>
      <div className="rounded-lg bg-stone-900 px-3 py-1">
        <Part label="อากาศ" onReroll={() => setWeather(genWeather(rng))}>{weather}</Part>
        <Part label="เหตุการณ์" onReroll={() => setEvent(genEvent(setting, rng))}>{event}</Part>
      </div>
    </div>
  )
}
