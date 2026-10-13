// The character's feat slots (edit page and Level Up): one row per slot with the feats allowed there, or a
// typed name for a feat outside the SRD. Feats that raise abilities (Ability Score Improvement, Grappler, Epic
// Boons) ask how to spend the points; the increase is recorded so changing the pick takes it back.
import { useState } from 'react'
import { ABILITIES, featsForSlot, findSrdFeat, type Ability, type FeatSlot } from '../rules'
import type { Character, FeatPick } from '../model/character'
import { featSlotViews, featWarnings, increaseProblem, setFeatPick } from '../model/feats'
import { ABILITY_LABEL } from '../ui/labels'
import { Button, TextInput } from '../ui/kit'

const OTHER = '__other'

export function FeatSlotsEditor({ c, onChange, only }: { c: Character; onChange: (next: Character) => void; only?: string[] }) {
  const { slots, extra } = featSlotViews(c)
  const shown = only ? slots.filter((s) => only.includes(s.slot.id)) : slots
  const warnings = only ? [] : featWarnings(c)
  return (
    <div className="space-y-3">
      {shown.map(({ slot, pick }) => <SlotRow key={slot.id} c={c} slot={slot} pick={pick} onChange={onChange} />)}
      {!only && extra.length > 0 && (
        <div className="rounded-lg bg-stone-900 p-2 text-sm">
          <p className="text-xs text-stone-400">Feat ที่ไม่มีช่อง (เช่น Level ลดลง หรือได้จากที่อื่น):</p>
          {extra.map((p) => (
            <div key={p.slot} className="flex items-center justify-between gap-2 py-1">
              <span>{p.feat}{p.increase && ` (${increaseText(p.increase)})`}</span>
              <button type="button" className="text-red-400" onClick={() => onChange(setFeatPick(c, p.slot, null))}>ลบ</button>
            </div>
          ))}
        </div>
      )}
      {warnings.length > 0 && <ul className="space-y-0.5 text-xs text-amber-300">{warnings.map((w) => <li key={w}>⚠️ {w}</li>)}</ul>}
    </div>
  )
}

const increaseText = (inc: NonNullable<FeatPick['increase']>) =>
  (Object.entries(inc) as [Ability, number][]).map(([a, n]) => `+${n} ${ABILITY_LABEL[a].short}`).join(', ')

function SlotRow({ c, slot, pick, onChange }: { c: Character; slot: FeatSlot; pick: FeatPick | null; onChange: (next: Character) => void }) {
  const options = featsForSlot(slot.kind, c)
  const isSrd = !!pick && options.some((f) => f.name === pick.feat)
  const [choice, setChoice] = useState<string>(pick ? (isSrd ? pick.feat : OTHER) : '')
  const [typed, setTyped] = useState(pick && !isSrd ? pick.feat : '')
  const [increase, setIncrease] = useState<Partial<Record<Ability, number>>>(pick?.increase ?? {})
  const feat = choice === OTHER ? typed.trim() : choice
  const rule = findSrdFeat(feat)?.increase
  // Typed feats may also raise an ability (e.g. +1 from a Player's Handbook half-feat): up to 1 point, optional.
  const wantsIncrease = !!rule || (choice === OTHER && !!feat)
  // Scores without this slot's current increase, to check the maximum.
  const base = { ...c.scores }
  for (const [a, n] of Object.entries(pick?.increase ?? {}) as [Ability, number][]) base[a] -= n
  const problem = rule ? increaseProblem(feat, increase, base) : null
  const changed = feat !== (pick?.feat ?? '') || JSON.stringify(increase) !== JSON.stringify(pick?.increase ?? {})

  function save() {
    if (problem) return
    onChange(setFeatPick(c, slot.id, feat || null, wantsIncrease ? clean(increase) : undefined))
  }
  function pickFeat(v: string) {
    setChoice(v)
    setIncrease({})
    // Feats with nothing more to choose are saved straight away.
    if (v && v !== OTHER && !findSrdFeat(v)?.increase) onChange(setFeatPick(c, slot.id, v))
    if (!v) onChange(setFeatPick(c, slot.id, null))
  }
  const points = rule?.points ?? 1
  const used = Object.values(increase).reduce((n, v) => n + (v ?? 0), 0)

  return (
    <div className="rounded-lg bg-stone-900 p-2">
      <div className="mb-1 flex items-baseline justify-between gap-2 text-sm">
        <span className="font-bold">{slot.label}</span>
        {pick?.increase && <span className="text-xs text-emerald-300">{increaseText(pick.increase)}</span>}
      </div>
      <select className="w-full rounded-lg border border-stone-600 bg-stone-950 px-3 py-2" value={choice} onChange={(e) => pickFeat(e.target.value)} aria-label={slot.label}>
        <option value="">— ยังไม่เลือก —</option>
        {options.map((f) => <option key={f.name} value={f.name}>{f.name} · {f.category}{f.prerequisite ? ` (ต้อง ${f.prerequisite})` : ''}</option>)}
        <option value={OTHER}>อื่นๆ (พิมพ์ชื่อเอง เช่น Feat จาก Player's Handbook)</option>
      </select>
      {choice === OTHER && <div className="mt-2"><TextInput value={typed} placeholder="ชื่อ Feat เช่น Lucky, Tough" onChange={setTyped} /></div>}
      {wantsIncrease && (
        <div className="mt-2 space-y-1">
          <p className="text-xs text-stone-400">
            {rule
              ? `เพิ่ม Ability รวม ${points} แต้ม${rule.split ? ' (+2 ค่าเดียว หรือ +1 สองค่า)' : ''} · สูงสุด ${rule.max}`
              : 'ถ้า Feat นี้เพิ่ม Ability ให้เลือกได้ (ไม่บังคับ)'}
          </p>
          <div className="grid grid-cols-6 gap-1">
            {ABILITIES.filter((a) => !rule || rule.abilities.includes(a)).map((a) => {
              const n = increase[a] ?? 0
              const can = used < points && (rule?.split !== false || used === 0) && n < 2
              return (
                <button key={a} type="button" className={`rounded py-1 text-xs ${n ? 'bg-emerald-800 font-bold' : 'bg-stone-800'}`}
                  onClick={() => setIncrease({ ...increase, [a]: can ? n + 1 : 0 })} aria-label={`${ABILITY_LABEL[a].short} +${n}`}>
                  {ABILITY_LABEL[a].short}{n ? ` +${n}` : ''}
                  <span className="block text-stone-400">{base[a] + n}</span>
                </button>
              )
            })}
          </div>
          {problem && <p className="text-xs text-amber-300">⚠️ {problem}</p>}
        </div>
      )}
      {(wantsIncrease || choice === OTHER) && changed && (
        <Button variant="primary" className={`mt-2 w-full text-sm ${problem || !feat ? 'opacity-40' : ''}`} onClick={save}>บันทึก {feat || 'Feat'}</Button>
      )}
    </div>
  )
}

function clean(inc: Partial<Record<Ability, number>>): Partial<Record<Ability, number>> | undefined {
  const out = Object.fromEntries(Object.entries(inc).filter(([, v]) => v)) as Partial<Record<Ability, number>>
  return Object.keys(out).length ? out : undefined
}
