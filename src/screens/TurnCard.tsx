// The Turn Card: what the creature whose turn it is can do, at the top of the tracker's middle column.
// Monster: Multiattack text, attacks with 🎯 / 💥 buttons (open the dice roller), Recharge and Legendary
// chips, bonus actions. PC: name, conditions, Concentration, action economy.
// Text that can't be parsed is shown as plain text, never hidden (see model/statBlockActions.ts).
import { useState } from 'react'
import type { Character } from '../model/character'
import { sheetOnlyConditions, type Combatant, type MonsterResult } from '../model/encounter'
import { findMonsterForCombatant, type FullMonster, type StatBlockEntry } from '../model/monsterDetails'
import {
  abilityShort, firstSentence, legendaryCost, legendaryUsesMax, parseAction, rechargeMin, rechargeReady, type ParsedAction,
} from '../model/statBlockActions'
import { buffedArmorClass, FRESH_TURN, formatModifier } from '../rules'

import { requestPanelTab } from '../ui/dmPanelBus'
import { ActionEconomyBar } from '../ui/kit'
import { openRoller } from '../ui/rollerBus'
import { useMonsters } from './useSrdData'

type Update = (fn: (latest: Combatant) => MonsterResult) => void
const same = (combatant: Combatant, text = ''): MonsterResult => ({ combatant, text })
const d20 = (toHit: number) => `1d20${toHit >= 0 ? '+' : '-'}${Math.abs(toHit)}`

export default function TurnCard({ active, character, nextName, collapsed, onCollapse, hotkeysOn, onShortcuts, onUpdate }: {
  active: Combatant
  /** The linked sheet when the active creature is a PC. */
  character: Character | undefined
  nextName: string | undefined
  collapsed: boolean
  onCollapse: (v: boolean) => void
  hotkeysOn: boolean
  onShortcuts: () => void
  /** Change the active monster (Recharge / Legendary counters, notes). */
  onUpdate: Update
}) {
  const isPc = active.kind === 'pc'
  const monsters = useMonsters()
  const m = !isPc && monsters ? findMonsterForCombatant(monsters, active.name) : undefined
  return (
    <section
      aria-label={`การ์ดเทิร์น: ${active.name}`}
      className="z-10 flex max-h-[168px] flex-col overflow-hidden rounded-xl border-2 border-amber-400 bg-stone-900 lg:sticky lg:top-16"
    >
      {isPc
        ? <PcCard active={active} character={character} nextName={nextName} collapsed={collapsed} onCollapse={onCollapse} />
        : <MonsterCard active={active} monsters={monsters} m={m} nextName={nextName} collapsed={collapsed} onCollapse={onCollapse} onUpdate={onUpdate} />}
      {!collapsed && (
        <div className="flex shrink-0 items-center justify-between gap-2 border-t border-stone-800 px-3 py-0.5 text-xs text-stone-400">
          <button type="button" onClick={onShortcuts} className="text-left hover:text-amber-300">
            {hotkeysOn ? '⌨ N / Space ถัดไป · P ก่อนหน้า · ? ทางลัดทั้งหมด' : '⌨ ทางลัดแป้นพิมพ์ปิดอยู่ · กดเพื่อดูหรือเปิด'}
          </button>
          {!isPc && (
            <span className="min-w-0 text-right">
              {m && <span>Speed {m.speed} · </span>}
              <button type="button" onClick={() => requestPanelTab('stats')} className="hover:text-amber-300">ดู Stat block เต็ม ▸</button>
            </span>
          )}
        </div>
      )}
    </section>
  )
}

/** First line: whose turn, AC / HP / Speed, who is next, collapse button. */
function Header({ title, stats, nextName, collapsed, onCollapse }: {
  title: string
  stats: string
  nextName: string | undefined
  collapsed: boolean
  onCollapse: (v: boolean) => void
}) {
  return (
    <div className={`flex shrink-0 items-center gap-2 px-3 ${collapsed ? 'min-h-11' : 'pt-1.5'}`}>
      <div className="flex min-w-0 flex-1 flex-wrap items-baseline gap-x-3">
        <b className="text-amber-300">▶ ตาของ {title}</b>
        <span className="text-sm text-stone-300">{stats}</span>
      </div>
      {nextName && <span className="shrink-0 text-xs text-stone-400">ถัดไป: {nextName}</span>}
      <button
        type="button"
        aria-expanded={!collapsed}
        onClick={() => onCollapse(!collapsed)}
        className="shrink-0 rounded-lg bg-stone-800 px-2.5 py-1 text-xs hover:bg-stone-700"
      >
        {collapsed ? 'ขยาย ▼' : 'ย่อ ▲'}
      </button>
    </div>
  )
}

function MonsterCard({ active, monsters, m, nextName, collapsed, onCollapse, onUpdate }: {
  active: Combatant
  /** All SRD monsters (null while loading) and the one this combatant is (undefined = homebrew or renamed). */
  monsters: FullMonster[] | null
  m: FullMonster | undefined
  nextName: string | undefined
  collapsed: boolean
  onCollapse: (v: boolean) => void
  onUpdate: Update
}) {
  const stats = `AC ${active.ac} · HP ${active.hp.current}/${active.hp.max}${active.hp.temp ? ` (+${active.hp.temp})` : ''}`
  return (
    <>
      <Header title={active.name} stats={stats} nextName={nextName} collapsed={collapsed} onCollapse={onCollapse} />
      {!collapsed && (
        <div className="min-h-0 flex-1 space-y-1 overflow-y-auto px-3 py-1 text-sm">
          {!monsters && <p className="text-stone-400">กำลังโหลด Stat block…</p>}
          {monsters && !m && <NoStatBlock active={active} onUpdate={onUpdate} />}
          {m && <MonsterActions active={active} m={m} onUpdate={onUpdate} />}
        </div>
      )}
    </>
  )
}

/** Homebrew or renamed monster: no empty box, a short note the DM can type. */
function NoStatBlock({ active, onUpdate }: { active: Combatant; onUpdate: Update }) {
  const [text, setText] = useState(active.notes)
  const save = () => text !== active.notes && onUpdate((c) => same({ ...c, notes: text }))
  return (
    <div className="flex items-center gap-2">
      <span className="shrink-0 text-stone-400">ไม่พบ Stat block ใน SRD · โน้ตสั้นๆ</span>
      <input
        aria-label={`โน้ตของ ${active.name}`}
        className="min-w-0 flex-1 rounded-lg border border-stone-600 bg-stone-800 px-2 py-1 text-base"
        value={text}
        placeholder="เช่น โจมตี +5 ดาเมจ 1d8+3"
        onChange={(e) => setText(e.target.value)}
        onBlur={save}
        onKeyDown={(e) => { if (e.key === 'Enter') e.currentTarget.blur() }}
      />
    </div>
  )
}

const rollBtn = 'rounded-md bg-stone-700 px-2 py-0.5 text-sm font-bold hover:bg-stone-600'

function MonsterActions({ active, m, onUpdate }: { active: Combatant; m: FullMonster; onUpdate: Update }) {
  const [openText, setOpenText] = useState<string | null>(null)
  const multi = m.actions.find((a) => a.name === 'Multiattack')
  const rest = m.actions.filter((a) => a !== multi && a.name !== 'Spellcasting')
  const spent = active.spent ?? []

  return (
    <>
      {multi && <p><b>Multiattack</b> <span className="text-stone-200">{multi.text}</span></p>}
      {rest.map((entry) => (
        <ActionLine key={entry.name} who={active.name} entry={entry} spent={spent.includes(entry.name)} onUpdate={onUpdate} />
      ))}
      {m.bonusActions.map((entry) => (
        <div key={entry.name}>
          <button type="button" className="text-left" aria-expanded={openText === entry.name} onClick={() => setOpenText(openText === entry.name ? null : entry.name)}>
            <b className="text-sky-300">Bonus</b> <b>{entry.name}</b> <span className="text-stone-300">{openText === entry.name ? entry.text : firstSentence(entry.text)}</span>
          </button>
        </div>
      ))}
      <LegendaryRow c={active} m={m} onUpdate={onUpdate} />
    </>
  )
}

/** One action: an attack (🎯 💥), a save (DC + 💥), or plain text. Recharge actions get a ready / used chip. */
function ActionLine({ who, entry, spent, onUpdate }: { who: string; entry: StatBlockEntry; spent: boolean; onUpdate: Update }) {
  const a: ParsedAction = parseAction(entry)
  const min = rechargeMin(entry.usage)
  const label = (what: string) => `${who} · ${entry.name} · ${what}`
  return (
    <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
      <b>{entry.name}</b>
      {entry.usage && min === null && <span className="rounded bg-stone-800 px-1.5 text-xs text-stone-300">{entry.usage}</span>}
      {min !== null && <RechargeChip who={who} name={entry.name} usage={entry.usage ?? ''} min={min} spent={spent} onUpdate={onUpdate} />}
      {a.kind === 'attack' && (
        <>
          <span className="text-xs text-stone-400">{a.range} · {a.reach}</span>
          <button type="button" className={rollBtn} aria-label={`${entry.name} ทอยโจมตี ${formatModifier(a.toHit)}`} onClick={() => openRoller({ expression: d20(a.toHit), label: label('โจมตี') })}>🎯 {formatModifier(a.toHit)}</button>
          {a.damage && (
            <button type="button" className={rollBtn} aria-label={`${entry.name} ทอยดาเมจ ${a.damage.dice}`} onClick={() => openRoller({ expression: a.damage!.dice, label: label(`ดาเมจ (${a.damage!.type})`) })}>
              💥 {a.damage.average} ({a.damage.dice}) {a.damage.type}
            </button>
          )}
          {a.extra && <span className="text-xs text-stone-400">{a.extra}</span>}
        </>
      )}
      {a.kind === 'save' && (
        <>
          <span className="text-xs text-stone-300">DC {a.dc} {abilityShort(a.ability)} · {a.target}</span>
          {a.damage && (
            <button type="button" className={rollBtn} aria-label={`${entry.name} ทอยดาเมจ ${a.damage.dice}`} onClick={() => openRoller({ expression: a.damage!.dice, label: label(`ดาเมจ (${a.damage!.type})`) })}>
              💥 {a.damage.average} ({a.damage.dice}) {a.damage.type}
            </button>
          )}
          {a.onSuccess && <span className="text-xs text-stone-400">สำเร็จ: {a.onSuccess}</span>}
          {!a.damage && <span className="text-xs text-stone-300">{entry.text.replace(/^.*?Failure: /s, 'Failure: ')}</span>}
        </>
      )}
      {/* Anything we could not read stays as the book wrote it. */}
      {a.kind === 'text' && <span className="text-stone-200">{a.text}</span>}
    </div>
  )
}

/** Recharge: ready (green) or used (dim). When used, "ทอย Recharge" rolls a d6 and flips it back on a success. */
function RechargeChip({ who, name, usage, min, spent, onUpdate }: {
  who: string
  name: string
  usage: string
  min: number
  spent: boolean
  onUpdate: Update
}) {
  const setSpent = (used: boolean, text = '') =>
    onUpdate((c) => same({ ...c, spent: used ? [...new Set([...(c.spent ?? []), name])] : (c.spent ?? []).filter((x) => x !== name) }, text))
  return (
    <>
      <button
        type="button"
        aria-pressed={spent}
        title="แตะเพื่อสลับ พร้อม / ใช้แล้ว"
        onClick={() => setSpent(!spent, !spent ? `🔥 ${who} ใช้ ${name} (${usage}): ต้องทอย Recharge` : '')}
        className={`rounded-full border px-2 text-xs ${spent ? 'border-stone-600 text-stone-500 line-through' : 'border-emerald-500 bg-emerald-900/60 text-emerald-100'}`}
      >
        {usage} · {spent ? 'ใช้แล้ว' : 'พร้อม'}
      </button>
      {spent && (
        <button
          type="button"
          className={rollBtn}
          onClick={() => openRoller({
            expression: '1d6',
            label: `${who} · ทอย Recharge ${name} (d6 ≥ ${min})`,
            resultHint: 'ถ้าได้ถึงเกณฑ์ ท่านี้จะกลับมาพร้อมใช้',
            onResult: (total) => onUpdate((c) => rechargeReady(total, min)
              ? same({ ...c, spent: (c.spent ?? []).filter((x) => x !== name) }, `🔋 ${who}: ${name} กลับมาพร้อมใช้ (Recharge d6 = ${total})`)
              : same(c, `${who}: Recharge ${name} ไม่ติด (d6 = ${total})`)),
          })}
        >
          🎲 ทอย Recharge (d6 ≥ {min})
        </button>
      )}
    </>
  )
}

/** 👑 Legendary 3/3: tap an action to spend its uses (they come back at the start of the monster's own turn). */
export function LegendaryRow({ c, m, onUpdate }: { c: Combatant; m: FullMonster; onUpdate: Update }) {
  const max = legendaryUsesMax(m.legendaryUses)
  const [shown, setShown] = useState<string | null>(null)
  if (!max || m.legendaryActions.length === 0) return null
  const used = Math.min(max, c.legendaryUsed ?? 0)
  const left = max - used
  const spend = (entry: StatBlockEntry) => {
    setShown(shown === entry.name ? null : entry.name)
    const cost = legendaryCost(entry.text)
    if (cost > left) return
    onUpdate((x) => same({ ...x, legendaryUsed: used + cost }, `👑 ${c.name} ใช้ Legendary Action: ${entry.name} (เหลือ ${left - cost}/${max})`))
  }
  const entry = m.legendaryActions.find((e) => e.name === shown)
  return (
    <div>
      <div className="flex flex-wrap items-center gap-1">
        <b className="text-amber-300">👑 Legendary {left}/{max}</b>
        {m.legendaryActions.map((e) => (
          <button
            key={e.name}
            type="button"
            aria-expanded={shown === e.name}
            onClick={() => spend(e)}
            className={`rounded-full border px-2 text-xs ${legendaryCost(e.text) > left ? 'border-stone-700 text-stone-500' : 'border-amber-500 text-amber-100 hover:bg-amber-900/40'}`}
          >
            {e.name}{legendaryCost(e.text) > 1 && ` (${legendaryCost(e.text)})`}
          </button>
        ))}
        {used > 0 && (
          <button type="button" className="rounded-full border border-stone-600 px-2 text-xs text-stone-300" onClick={() => onUpdate((x) => same({ ...x, legendaryUsed: Math.max(0, used - 1) }))}>
            คืน 1
          </button>
        )}
      </div>
      {entry && <p className="text-xs text-stone-300"><b>{entry.name}</b> {entry.text}</p>}
    </div>
  )
}

/**
 * Under the card while it is someone else's turn: legendary monsters can act on any creature's turn,
 * which is the part that is easy to forget at the table.
 */
export function LegendaryStrip({ combatants, activeId, onUpdate }: {
  combatants: Combatant[]
  activeId: string | null
  onUpdate: (cid: string, fn: (latest: Combatant) => MonsterResult) => void
}) {
  const monsters = useMonsters()
  if (!monsters) return null
  const rows = combatants.flatMap((c) => {
    if (c.kind !== 'monster' || c.defeated || c.id === activeId) return []
    const m = findMonsterForCombatant(monsters, c.name)
    return m && legendaryUsesMax(m.legendaryUses) > 0 ? [{ c, m }] : []
  })
  if (rows.length === 0) return null
  return (
    <div className="space-y-1 rounded-xl border border-amber-700/60 bg-stone-900 px-3 py-1.5 text-sm">
      {rows.map(({ c, m }) => (
        <div key={c.id} className="flex flex-wrap items-baseline gap-2">
          <span className="font-bold">{c.name}</span>
          <LegendaryRow c={c} m={m} onUpdate={(fn) => onUpdate(c.id, fn)} />
        </div>
      ))}
    </div>
  )
}

function PcCard({ active, character, nextName, collapsed, onCollapse }: {
  active: Combatant
  character: Character | undefined
  nextName: string | undefined
  collapsed: boolean
  onCollapse: (v: boolean) => void
}) {
  const hp = character ? character.hp : active.hp
  const ac = character ? buffedArmorClass(character.ac, character.buffs) : active.ac
  const conditions = [...new Set([...active.effects.map((e) => e.name), ...sheetOnlyConditions(active.effects, character)])]
  const concentration = character ? character.concentration : active.concentration
  const who = character ? `${active.name} · ${character.className} ${character.level} (ผู้เล่น)` : `${active.name} (ผู้เล่น)`
  return (
    <>
      <Header title={who} stats={`AC ${ac} · HP ${hp.current}/${hp.max}${hp.temp ? ` (+${hp.temp})` : ''}`} nextName={nextName} collapsed={collapsed} onCollapse={onCollapse} />
      {!collapsed && (
        <div className="min-h-0 flex-1 space-y-1.5 overflow-y-auto px-3 py-1 text-sm">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-stone-400">Condition:</span>
            {conditions.length === 0 && <span className="text-stone-400">ไม่มี</span>}
            {conditions.map((n) => <span key={n} className="rounded-full bg-red-900 px-2 text-xs">{n}</span>)}
            {concentration && <span className="rounded-full bg-violet-900 px-2 text-xs">🔮 Concentration: {concentration}</span>}
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <ActionEconomyBar economy={character ? character.turn : (active.turn ?? FRESH_TURN)} compact />
            {character && <a href={`#/c/${character.id}`} className="rounded-lg bg-stone-800 px-2 py-0.5 text-xs hover:bg-stone-700">ดูใบตัวละคร</a>}
            <span className="text-xs text-stone-400">ผู้เล่นกด "จบเทิร์น" เองได้</span>
          </div>
        </div>
      )}
    </>
  )
}
