// The character's spells on the sheet: cantrips and spells by level, each linked to its SRD card,
// with a "prepared" mark and a ✨ cast button (spends the Action, a slot, Concentration).
// Counts are checked against the 2024 class tables (warn, never block). Add from the 339 SRD 5.2.1
// spells (or type a homebrew one). Changes save at once; in a live room they go to the DM like other
// sheet edits, and casting goes through the same checked actions as the play panel.
import { useEffect, useState } from 'react'
import { useLobby } from '../app/useLobby'
import { updateCharacter } from '../db/characters'
import type { Character } from '../model/character'
import { castableSlotLevels, castPlan, type CastableSpell } from '../model/castSpell'
import { addSpell, highestSlotLevel, removeSpell, setPrepared, spellCounts, spellsByLevel, type CharacterSpell } from '../model/characterSpells'
import { spellLimits } from '../rules'
import { useCharacterAct } from './useCharacterAct'
import { findSpellByName, loadSrdSpells, searchSpells, spellLevelLine, type SrdSpell } from '../model/spells'
import { Button, Section, TextInput } from '../ui/kit'
import { useSpellsTh } from './useSrdData'

const CASTER_CLASSES = ['Bard', 'Cleric', 'Druid', 'Paladin', 'Ranger', 'Sorcerer', 'Warlock', 'Wizard']
const levelTitle = (level: number) => (level === 0 ? 'Cantrips' : `Level ${level}`)

export default function SpellList({ c }: { c: Character }) {
  const lobby = useLobby()
  const [srd, setSrd] = useState<SrdSpell[] | null>(null)
  const thai = useSpellsTh()
  const [adding, setAdding] = useState(false)
  const [editing, setEditing] = useState(false)
  /** The spell whose cast panel is open. */
  const [casting, setCasting] = useState<string | null>(null)
  /** What the last cast spent, shown under the header. */
  const [castNote, setCastNote] = useState('')
  useEffect(() => {
    loadSrdSpells().then(setSrd)
  }, [])

  /** Save a change to the spell list (from the newest copy), and share it in a live room. */
  async function change(fn: (latest: Character) => Character | null) {
    await updateCharacter(c.id, (latest) => ({ character: fn(latest) ?? latest, text: '' }))
    lobby.shareSheet(c.id)
  }

  const counts = spellCounts(c.spells)
  const limits = spellLimits(c.className, c.level)
  const tooMany = limits && (counts.cantrips > limits.cantrips || counts.prepared > limits.prepared)
  return (
    <Section
      title="✨ คาถา (Spells)"
      action={
        <div className="flex gap-2">
          {c.spells.length > 0 && <Button className="text-sm" onClick={() => setEditing(!editing)}>{editing ? 'เสร็จ' : 'แก้ไข'}</Button>}
          <Button variant="primary" className="text-sm" onClick={() => setAdding(!adding)}>{adding ? 'ปิด' : '+ เพิ่มคาถา'}</Button>
        </div>
      }
    >
      {adding && <SpellPicker c={c} srd={srd} onAdd={(s) => change((latest) => addSpell(latest, s))} />}

      {c.spells.length === 0 && !adding && (
        <p className="text-sm text-stone-500">ยังไม่มีคาถา กด "+ เพิ่มคาถา" เพื่อเลือกจาก SRD 5.2.1</p>
      )}
      {c.spells.length > 0 && (
        <p className="mb-2 text-xs text-stone-400">
          {limits ? (
            <>
              <span className={counts.cantrips > limits.cantrips ? 'font-bold text-amber-300' : ''}>Cantrips {counts.cantrips}/{limits.cantrips}</span>
              {' · '}
              <span className={counts.prepared > limits.prepared ? 'font-bold text-amber-300' : ''}>เตรียมไว้ {counts.prepared}/{limits.prepared}</span>
              {' · '}คาถาทั้งหมด {counts.leveled}
            </>
          ) : (
            <>Cantrips {counts.cantrips} · คาถา {counts.leveled} (เตรียมไว้ {counts.prepared})</>
          )}
          {' · '}แตะชื่อเพื่อดูรายละเอียด
        </p>
      )}
      {castNote && <p className="mb-2 rounded-lg bg-violet-950 p-2 text-sm text-violet-100">{castNote}</p>}
      {tooMany && (
        <p className="mb-2 rounded-lg bg-amber-950 p-2 text-xs text-amber-200">
          ⚠️ เกินจำนวนตามตาราง {c.className} Level {c.level} (2024) · ไม่นับคาถาที่ได้จาก Feat หรือที่เตรียมไว้เสมอจาก Subclass · DM ตัดสินได้
        </p>
      )}
      <div className="space-y-3">
        {spellsByLevel(c.spells).map(([level, list]) => (
          <div key={level}>
            <div className="mb-1 text-xs font-bold text-amber-400">{levelTitle(level)}</div>
            <ul className="space-y-1">
              {list.map((s) => {
                const info = srd ? findSpellByName(srd, s.name) ?? null : null
                return (
                  <li key={s.id} className="rounded-lg bg-stone-900 px-2 py-1.5 text-sm">
                  <div className="flex items-center gap-2">
                    {level > 0 && (
                      <input
                        type="checkbox"
                        className="h-5 w-5 accent-amber-400"
                        aria-label={`เตรียม ${s.name}`}
                        title="เตรียมไว้ (Prepared)"
                        checked={s.prepared}
                        onChange={(e) => {
                          // Read it now: the save runs later, when the box already shows the saved value again.
                          const prepared = e.target.checked
                          change((latest) => setPrepared(latest, s.id, prepared))
                        }}
                      />
                    )}
                    <span className="min-w-0 flex-1">
                      {info ? <a href={`#/lookup/spell/${info.id}`} className="font-bold underline decoration-stone-600">{s.name}</a> : <b>{s.name}</b>}
                      {info && thai[info.id] && <span className="ml-1 text-xs text-stone-400">{thai[info.id].name}</span>}
                      {info?.concentration && <span className="ml-1 rounded bg-violet-900 px-1 text-xs">C</span>}
                      {info?.ritual && <span className="ml-1 rounded bg-sky-900 px-1 text-xs">R</span>}
                      <span className="block text-xs text-stone-400">
                        {info ? `${info.castingTime.split(',')[0]} · ${info.range}` : srd ? 'Homebrew (ไม่มีใน SRD)' : ''}
                      </span>
                    </span>
                    {!editing && (
                      <button
                        type="button"
                        aria-label={`ร่าย ${s.name}`}
                        className={`rounded-lg px-2 py-1 text-xs font-bold ${casting === s.id ? 'bg-violet-500 text-stone-900' : 'bg-violet-900 text-violet-100'}`}
                        onClick={() => setCasting(casting === s.id ? null : s.id)}
                      >
                        ✨ ร่าย
                      </button>
                    )}
                    {editing && (
                      <button type="button" aria-label={`ลบ ${s.name}`} className="rounded px-2 py-1 text-red-300 hover:bg-red-950" onClick={() => change((latest) => removeSpell(latest, s.id))}>
                        ✕
                      </button>
                    )}
                  </div>
                  {casting === s.id && <CastPanel c={c} spell={s} info={info} onDone={(note) => { setCasting(null); if (note) setCastNote(note) }} />}
                  </li>
                )
              })}
            </ul>
          </div>
        ))}
      </div>
    </Section>
  )
}

/** Pick SRD spells for this character's class and slot levels (or any), or type a homebrew spell. */
function SpellPicker({ c, srd, onAdd }: { c: Character; srd: SrdSpell[] | null; onAdd: (s: { name: string; level: number }) => void }) {
  const ownClass = CASTER_CLASSES.includes(c.className) ? c.className : null
  // Up to the highest slot level (at least level 1, for characters whose slots aren't set yet).
  const maxLevel = Math.max(1, highestSlotLevel(c))
  const [query, setQuery] = useState('')
  const [all, setAll] = useState(!ownClass)
  const [customName, setCustomName] = useState('')
  const [customLevel, setCustomLevel] = useState(0)
  const thai = useSpellsTh()
  if (!srd) return <p className="mb-3 text-sm text-stone-400">กำลังโหลดคาถา…</p>

  const thaiNames = Object.fromEntries(Object.entries(thai).map(([id, t]) => [id, t.name]))
  const found = searchSpells(srd, { query, level: null, className: all ? null : ownClass, thaiNames })
    .filter((s) => all || s.level <= maxLevel)
  const has = (name: string) => c.spells.some((s) => s.name.toLowerCase() === name.toLowerCase())

  return (
    <div className="mb-4 space-y-2 rounded-lg bg-stone-900 p-3">
      <TextInput value={query} placeholder="ค้นหาคาถา เช่น fire, cure, shield" onChange={setQuery} />
      {ownClass && (
        <label className="flex items-center gap-2 text-xs text-stone-400">
          <input type="checkbox" checked={all} onChange={(e) => setAll(e.target.checked)} />
          แสดงทุก Class และทุก Level (ปกติแสดงคาถาของ {ownClass} ถึง Level {maxLevel})
        </label>
      )}
      <ul className="max-h-72 space-y-1 overflow-y-auto">
        {found.slice(0, 100).map((s) => (
          <li key={s.id} className="flex items-center justify-between gap-2 rounded bg-stone-800 px-2 py-1 text-sm">
            <span className="min-w-0">
              <a href={`#/lookup/spell/${s.id}`} className="font-bold">{s.name}</a>
              {thai[s.id] && <span className="ml-1 text-xs text-stone-400">{thai[s.id].name}</span>}
              {s.concentration && <span className="ml-1 rounded bg-violet-900 px-1 text-xs">C</span>}
              <span className="block text-xs text-stone-400">{spellLevelLine(s)}</span>
            </span>
            {has(s.name)
              ? <span className="text-xs text-emerald-400">✓ มีแล้ว</span>
              : <Button className="px-3 py-1 text-sm" onClick={() => onAdd({ name: s.name, level: s.level })}>+ เพิ่ม</Button>}
          </li>
        ))}
      </ul>
      {found.length === 0 && <p className="text-xs text-stone-500">ไม่พบ · ลองติ๊ก "แสดงทุก Class และทุก Level"</p>}
      <details className="text-sm">
        <summary className="cursor-pointer text-stone-400">คาถา Homebrew (ไม่มีใน SRD)</summary>
        <div className="mt-2 flex gap-2">
          <div className="flex-1"><TextInput value={customName} placeholder="ชื่อคาถา" onChange={setCustomName} /></div>
          <select aria-label="Level ของคาถา" className="rounded-lg border border-stone-600 bg-stone-900 px-2 text-base" value={customLevel} onChange={(e) => setCustomLevel(Number(e.target.value))}>
            {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map((n) => <option key={n} value={n}>{levelTitle(n)}</option>)}
          </select>
          <Button onClick={() => { if (customName.trim()) { onAdd({ name: customName, level: customLevel }); setCustomName('') } }}>เพิ่ม</Button>
        </div>
      </details>
    </div>
  )
}

/**
 * Cast one spell: pick the slot (lowest free one first; higher = upcast) or a Ritual, see what it costs,
 * then apply it as the usual checked actions (Action / Bonus Action / Reaction, slot, Concentration).
 */
function CastPanel({ c, spell, info, onDone }: { c: Character; spell: CharacterSpell; info: SrdSpell | null; onDone: (note?: string) => void }) {
  const { act } = useCharacterAct(c)
  // Homebrew spells (not in the SRD) are taken as a 1-Action spell without Concentration.
  const castable: CastableSpell = {
    name: spell.name,
    level: spell.level,
    castingTime: info?.castingTime ?? 'Action',
    concentration: info?.concentration ?? false,
    ritual: info?.ritual ?? false,
    prepared: spell.prepared,
  }
  const levels = castableSlotLevels(c, spell.level)
  const [slotLevel, setSlotLevel] = useState<number | null>(spell.level > 0 ? levels[0] ?? null : null)
  const [asRitual, setAsRitual] = useState(false)
  const [result, setResult] = useState('')
  const plan = castPlan(c, castable, { slotLevel, asRitual })

  async function cast() {
    if (plan.error) return
    // In order: the Action first (a player out of turn is refused there, before any slot is spent).
    const spent: string[] = []
    for (const action of plan.actions) {
      const r = await act(action)
      if (r.refused) return setResult(`🔒 ${r.refused}`)
      if (action.type === 'setActionUsed') spent.push(action.kind === 'action' ? 'Action' : action.kind === 'bonusAction' ? 'Bonus Action' : 'Reaction')
      if (action.type === 'setSlotUsed') spent.push(`Spell Slot Level ${action.level + 1}`)
      if (action.type === 'setConcentration') spent.push('Concentration')
    }
    onDone(`✨ ร่าย ${spell.name}${asRitual ? ' (Ritual)' : ''} แล้ว${spent.length ? ` · ใช้ ${spent.join(', ')}` : ''}`)
  }

  return (
    <div className="mt-2 space-y-2 rounded-lg bg-violet-950/60 p-2">
      {spell.level > 0 && !asRitual && (
        levels.length > 0 ? (
          <div className="flex flex-wrap items-center gap-1 text-xs">
            <span className="text-stone-300">ใช้ Spell Slot:</span>
            {levels.map((l) => (
              <button
                key={l}
                type="button"
                onClick={() => setSlotLevel(l)}
                className={`rounded-full border px-2 py-0.5 ${slotLevel === l ? 'border-violet-300 bg-violet-600 font-bold' : 'border-stone-600'}`}
              >
                Level {l}{l > spell.level && ' ⬆'} · เหลือ {c.spellSlots[l - 1].max - c.spellSlots[l - 1].used}
              </button>
            ))}
          </div>
        ) : null
      )}
      {castable.ritual && spell.level > 0 && (
        <label className="flex items-center gap-2 text-xs">
          <input type="checkbox" checked={asRitual} onChange={(e) => setAsRitual(e.target.checked)} />
          ร่ายแบบ Ritual (ไม่ใช้ Spell Slot, ใช้เวลาเพิ่ม 10 นาที)
        </label>
      )}
      {plan.error && <p className="text-xs font-bold text-red-300">{plan.error}</p>}
      {plan.warnings.map((w) => <p key={w} className="text-xs text-amber-200">⚠️ {w}</p>)}
      {result && <p className="text-xs text-red-300">{result}</p>}
      <div className="flex gap-2">
        <Button variant="primary" className={`flex-1 py-1 text-sm ${plan.error ? 'opacity-40' : ''}`} onClick={cast}>
          ✨ ร่าย {spell.name}{!plan.error && slotLevel && spell.level > 0 && !asRitual ? ` (Slot Level ${slotLevel})` : ''}
        </Button>
        <Button className="py-1 text-sm" onClick={() => onDone()}>ยกเลิก</Button>
      </div>
    </div>
  )
}
