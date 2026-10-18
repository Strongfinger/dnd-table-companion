// The DM's side panel next to the fight tracker (Phase 3.3), so nothing at the table needs leaving the fight:
// - Stat block: follows the active monster's turn (or pick one of this fight's monsters)
// - Lookup: monsters, spells and rules, opened right here
// - Generators: NPCs, places, loot, encounters (added to this fight)…
// - Notebook: this campaign's pages (sessions, NPCs, places, quests…), read and edited in place
// - Fight log
import { useState, type ReactNode } from 'react'
import { addMonstersToFight } from '../db/turns'
import type { Encounter } from '../model/encounter'
import { findMonsterForCombatant, type FullMonster } from '../model/monsterDetails'
import { monsterInput } from '../model/monsters'
import MonsterStatBlock from '../ui/MonsterStatBlock'
import { Button } from '../ui/kit'
import { MonsterSearch, RulesSearch, SpellCard, SpellSearch, type OpenResult } from './Lookup'
import Generators from './Generators'
import { NotebookList, NotebookPage } from './Notebook'
import { useMonsters, useMonstersTh, useSpells } from './useSrdData'

type PanelTab = 'stats' | 'lookup' | 'gen' | 'notes' | 'log'
const TABS: { id: PanelTab; label: string }[] = [
  { id: 'stats', label: '👹 Stat block' },
  { id: 'lookup', label: '🔎 ค้นหา' },
  { id: 'gen', label: '🎲 สุ่ม' },
  { id: 'notes', label: '📒 สมุด' },
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
      {/* Extra bottom padding (lg) so the last buttons can scroll clear of the floating 🎲 button */}
      <div className="p-3 lg:min-h-0 lg:flex-1 lg:overflow-y-auto lg:pb-20">
        {tab === 'stats' && <StatsTab encounter={encounter} />}
        {tab === 'lookup' && <LookupTab encounter={encounter} />}
        {tab === 'gen' && <Generators campaignId={encounter.campaignId} encounter={encounter} />}
        {tab === 'notes' && <NotesTab campaignId={encounter.campaignId} />}
        {tab === 'log' && log}
      </div>
    </section>
  )
}

/** The active monster's stat block (follows the turn), or one picked from this fight. */
function StatsTab({ encounter }: { encounter: Encounter }) {
  const monsters = useMonsters()
  const thai = useMonstersTh()
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
          <MonsterStatBlock m={shown} th={thai[shown.id]} />
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
  const thai = useMonstersTh()
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
        {m && <MonsterStatBlock m={m} th={thai[m.id]} />}
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

/** This campaign's notebook (all pages if the fight has no campaign); pages open and edit in place. */
function NotesTab({ campaignId }: { campaignId: string | null }) {
  const [open, setOpen] = useState<string | null>(null)
  if (open) return <NotebookPage key={open} id={open} onBack={() => setOpen(null)} onOpen={setOpen} backLabel="← สมุดแคมเปญ" />
  return <NotebookList campaignId={campaignId} onOpen={setOpen} />
}
