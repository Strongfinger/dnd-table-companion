// The DM's side panel next to the fight tracker (Phase 3.3), so nothing at the table needs leaving the fight:
// - Stat block: follows the active monster's turn (or pick one of this fight's monsters)
// - Lookup: monsters, spells and rules, opened right here
// - Notes: this campaign's session notes, edited in place
// - Fight log
import { useLiveQuery } from 'dexie-react-hooks'
import { useState, type ReactNode } from 'react'
import { listNotes, saveNote } from '../db/notes'
import { addMonstersToFight } from '../db/turns'
import type { Encounter } from '../model/encounter'
import { findMonsterForCombatant, type FullMonster } from '../model/monsterDetails'
import { monsterInput } from '../model/monsters'
import { createNote, noteTitle, thaiDate } from '../model/note'
import MonsterStatBlock from '../ui/MonsterStatBlock'
import { Button } from '../ui/kit'
import { MonsterSearch, RulesSearch, SpellCard, SpellSearch, type OpenResult } from './Lookup'
import { NoteEditor } from './NoteEdit'
import { useMonsters, useSpells } from './useSrdData'

type PanelTab = 'stats' | 'lookup' | 'notes' | 'log'
const TABS: { id: PanelTab; label: string }[] = [
  { id: 'stats', label: '👹 Stat block' },
  { id: 'lookup', label: '🔎 ค้นหา' },
  { id: 'notes', label: '📝 โน้ต' },
  { id: 'log', label: '📜 บันทึก' },
]
const TAB_KEY = 'dm-panel-tab'

/** The tab is remembered on this device (a convenience only: storage may be unavailable). */
function savedTab(): PanelTab {
  try {
    const t = localStorage.getItem(TAB_KEY)
    return TABS.some((x) => x.id === t) ? (t as PanelTab) : 'stats'
  } catch {
    return 'stats'
  }
}

export default function DmPanel({ encounter, log }: { encounter: Encounter; log: ReactNode }) {
  const [tab, setTab] = useState<PanelTab>(savedTab)
  const choose = (t: PanelTab) => {
    setTab(t)
    try {
      localStorage.setItem(TAB_KEY, t)
    } catch {
      // not saved: fine
    }
  }

  return (
    <section className="rounded-xl bg-stone-800 lg:sticky lg:top-16 lg:flex lg:max-h-[calc(100dvh-9rem)] lg:flex-col">
      <div className="flex flex-wrap gap-1 border-b border-stone-700 p-2">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => choose(t.id)}
            className={`rounded-lg px-2.5 py-1.5 text-sm ${tab === t.id ? 'bg-amber-500 font-bold text-stone-900' : 'text-stone-300 hover:bg-stone-700'}`}
          >
            {t.label}
          </button>
        ))}
      </div>
      <div className="p-3 lg:min-h-0 lg:flex-1 lg:overflow-y-auto">
        {tab === 'stats' && <StatsTab encounter={encounter} />}
        {tab === 'lookup' && <LookupTab encounter={encounter} />}
        {tab === 'notes' && <NotesTab campaignId={encounter.campaignId} />}
        {tab === 'log' && log}
      </div>
    </section>
  )
}

/** The active monster's stat block (follows the turn), or one picked from this fight. */
function StatsTab({ encounter }: { encounter: Encounter }) {
  const monsters = useMonsters()
  const [picked, setPicked] = useState<string | null>(null) // SRD id; null = follow the turn
  if (!monsters) return <p className="text-sm text-stone-400">กำลังโหลดข้อมูลมอนสเตอร์…</p>

  // This fight's monsters that are SRD monsters, once each ("Goblin Warrior ×3").
  const inFight = new Map<string, { m: FullMonster; count: number }>()
  for (const c of encounter.combatants) {
    if (c.kind !== 'monster') continue
    const m = findMonsterForCombatant(monsters, c.name)
    if (m) inFight.set(m.id, { m, count: (inFight.get(m.id)?.count ?? 0) + 1 })
  }
  const active = encounter.combatants.find((c) => c.id === encounter.activeId)
  const activeMonster = active?.kind === 'monster' ? findMonsterForCombatant(monsters, active.name) : undefined
  const shown = picked ? inFight.get(picked)?.m ?? monsters.find((m) => m.id === picked) : activeMonster

  return (
    <div className="space-y-3">
      <select
        aria-label="Stat block ที่แสดง"
        className="w-full rounded-lg border border-stone-600 bg-stone-900 px-3 py-2 text-base"
        value={picked ?? ''}
        onChange={(e) => setPicked(e.target.value || null)}
      >
        <option value="">▶ ตามเทิร์น (มอนสเตอร์ที่กำลังเล่น)</option>
        {[...inFight.values()].map(({ m, count }) => <option key={m.id} value={m.id}>{m.name}{count > 1 ? ` ×${count}` : ''}</option>)}
      </select>
      {shown ? (
        <>
          {!picked && active && <p className="text-xs text-amber-300">ตาของ {active.name}</p>}
          <MonsterStatBlock m={shown} />
        </>
      ) : (
        <p className="rounded-lg bg-stone-900 p-3 text-sm text-stone-400">
          {encounter.status !== 'active' ? 'เริ่มการต่อสู้แล้ว Stat block ของมอนสเตอร์จะขึ้นที่นี่ตามเทิร์น'
            : active?.kind === 'pc' ? `ตาของ ${active.name} (ผู้เล่น) · เลือกมอนสเตอร์ด้านบนเพื่อดู Stat block`
              : active ? `"${active.name}" ไม่ตรงกับมอนสเตอร์ใน SRD (เปลี่ยนชื่อหรือ Homebrew) · ค้นหาได้ในแท็บ 🔎`
                : 'เลือกมอนสเตอร์ด้านบน'}
          {inFight.size === 0 && ' · ยังไม่มีมอนสเตอร์ SRD ในการต่อสู้นี้'}
        </p>
      )}
    </div>
  )
}

/** Monster / spell / rule search; results open inside the panel. Monsters can be added to this fight. */
function LookupTab({ encounter }: { encounter: Encounter }) {
  const [sub, setSub] = useState<'monsters' | 'spells' | 'rules'>('monsters')
  const [open, setOpen] = useState<Parameters<OpenResult>[0] | null>(null)
  const monsters = useMonsters()
  const spells = useSpells()
  const [added, setAdded] = useState('')

  if (open) {
    const m = open.kind === 'monster' ? monsters?.find((x) => x.id === open.id) : undefined
    const sp = open.kind === 'spell' ? spells?.find((x) => x.id === open.id) : undefined
    return (
      <div className="space-y-3">
        <button type="button" className="text-sm text-stone-400" onClick={() => { setOpen(null); setAdded('') }}>← กลับไปผลค้นหา</button>
        {m && encounter.status !== 'ended' && (
          <div className="flex items-center gap-2">
            <Button className="text-sm" onClick={async () => setAdded((await addMonstersToFight(encounter.id, monsterInput(m), 1)).join(', '))}>
              ➕ เพิ่มเข้าการต่อสู้นี้
            </Button>
            {added && <span className="text-xs text-emerald-300">เพิ่ม {added} แล้ว</span>}
          </div>
        )}
        {m && <MonsterStatBlock m={m} />}
        {sp && <SpellCard sp={sp} />}
      </div>
    )
  }
  return (
    <div className="space-y-3">
      <div className="flex gap-1">
        {(['monsters', 'spells', 'rules'] as const).map((s) => (
          <button key={s} type="button" onClick={() => setSub(s)} className={`rounded-full border px-3 py-1 text-xs ${sub === s ? 'border-amber-400 bg-amber-500 font-bold text-stone-900' : 'border-stone-600'}`}>
            {s === 'monsters' ? '👹 มอนสเตอร์' : s === 'spells' ? '✨ คาถา' : '📖 กติกา'}
          </button>
        ))}
      </div>
      {sub === 'monsters' && <MonsterSearch onOpen={setOpen} />}
      {sub === 'spells' && <SpellSearch onOpen={setOpen} />}
      {sub === 'rules' && <RulesSearch />}
    </div>
  )
}

/** This campaign's session notes (all notes if the fight has no campaign), edited in place. */
function NotesTab({ campaignId }: { campaignId: string | null }) {
  const all = useLiveQuery(listNotes) ?? []
  const notes = campaignId ? all.filter((n) => n.campaignId === campaignId) : all
  const [open, setOpen] = useState<string | null>(null)

  if (open) return <NoteEditor id={open} onBack={() => setOpen(null)} backLabel="← โน้ตทั้งหมด" />
  return (
    <div className="space-y-2">
      <Button variant="primary" className="w-full text-sm" onClick={async () => setOpen((await saveNote(createNote(campaignId))).id)}>+ บันทึกใหม่</Button>
      {notes.length === 0 && <p className="text-sm text-stone-500">ยังไม่มีบันทึก{campaignId ? 'ในแคมเปญนี้' : ''}</p>}
      <ul className="space-y-1">
        {notes.map((n) => (
          <li key={n.id}>
            <button type="button" onClick={() => setOpen(n.id)} className="w-full rounded-lg bg-stone-900 p-2 text-left hover:bg-stone-700">
              <div className="flex justify-between gap-2 text-sm">
                <b>{noteTitle(n)}</b>
                <span className="shrink-0 text-xs text-stone-400">{thaiDate(n.sessionDate)}</span>
              </div>
              {n.body && <p className="line-clamp-3 whitespace-pre-line text-xs text-stone-400">{n.body}</p>}
            </button>
          </li>
        ))}
      </ul>
    </div>
  )
}
