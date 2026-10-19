// Temporary buffs on a character (Longstrider, Shield of Faith, a blessing…): the list, and a form for the DM
// to add one. Flat numbers go straight into the sheet's numbers (rules/buffs.ts); rests end them by duration.
import { useState } from 'react'
import { newId, type Character } from '../model/character'
import { BUFF_ENDS_LABEL, BUFF_TARGET_LABEL, buffModsText, type CharacterAction } from '../model/characterActions'
import { BUFF_ENDS, BUFF_LIMIT, BUFF_TARGETS, type Buff, type BuffEnds, type BuffTarget } from '../rules'
import { Button } from '../ui/kit'

/** SRD 5.2.1 spells that are common buffs. Dice bonuses (Bless) can't be added into a number, so they're a note. */
const PRESETS: Omit<Buff, 'id'>[] = [
  { name: 'Longstrider', note: '1 ชม.', mods: { speed: 10 }, ends: 'shortRest' },
  { name: 'Shield of Faith', note: 'Concentration 10 นาที', mods: { ac: 2 }, ends: 'shortRest' },
  { name: 'Bless', note: '+1d4 ทุก Attack roll และ Saving Throw · Concentration 1 นาที', mods: {}, ends: 'shortRest' },
]

const EMPTY: Omit<Buff, 'id'> = { name: '', note: '', mods: {}, ends: 'longRest' }

/** Chips of the active buffs; a ✕ removes one when allowed. */
export function BuffChips({ buffs, onRemove }: { buffs: Buff[]; onRemove?: (id: string) => void }) {
  if (buffs.length === 0) return null
  return (
    <div className="flex flex-wrap gap-1.5">
      {buffs.map((b) => {
        const mods = buffModsText(b)
        const body = (
          <>
            ✨ <b>{b.name}</b>
            {mods && <span className="text-emerald-200"> {mods}</span>}
            {b.note && <span className="text-stone-300"> · {b.note}</span>}
            <span className="text-stone-400"> · {BUFF_ENDS_LABEL[b.ends]}</span>
            {onRemove && ' ✕'}
          </>
        )
        const cls = 'rounded-full border border-emerald-600 bg-emerald-950 px-2.5 py-1 text-left text-xs'
        return onRemove
          ? <button key={b.id} type="button" className={cls} aria-label={`เอา ${b.name} ออก`} onClick={() => onRemove(b.id)}>{body}</button>
          : <span key={b.id} className={cls}>{body}</span>
      })}
    </div>
  )
}

export default function BuffPanel({ c, act, canAdd, canRemove }: {
  c: Character
  act: (a: CharacterAction) => void
  /** The DM (or play outside a room): players in a room ask the DM. */
  canAdd: boolean
  canRemove: boolean
}) {
  const [draft, setDraft] = useState<Omit<Buff, 'id'> | null>(null)
  // The number fields as typed (so "-" can be typed before "-2"); read when saving.
  const [modText, setModText] = useState<Partial<Record<BuffTarget, string>>>({})
  const start = (b: Omit<Buff, 'id'>) => {
    setDraft({ ...b, mods: { ...b.mods } })
    setModText(Object.fromEntries(Object.entries(b.mods).map(([t, n]) => [t, String(n)])))
  }
  const buffs = c.buffs ?? []

  function save() {
    if (!draft || !draft.name.trim()) return
    const mods: Buff['mods'] = {}
    for (const t of BUFF_TARGETS) {
      const n = Math.trunc(Number(modText[t]) || 0)
      if (n) mods[t] = Math.max(-BUFF_LIMIT[t], Math.min(BUFF_LIMIT[t], n))
    }
    act({ type: 'addBuff', buff: { ...draft, id: newId(), name: draft.name.trim().slice(0, 60), note: draft.note.trim().slice(0, 200), mods } })
    setDraft(null)
  }

  const setMod = (t: BuffTarget, text: string) => setModText({ ...modText, [t]: text.replace(/[^\d-]/g, '').slice(0, 4) })

  return (
    <div className="mt-4">
      <div className="mb-1 flex items-center justify-between gap-2">
        <span className="text-sm text-stone-400">บัฟ/เอฟเฟกต์ชั่วคราว <span className="text-xs text-stone-600">· ตัวเลขบวกในใบตัวละครแล้ว</span></span>
        {canAdd && !draft && <Button aria-label="เพิ่มบัฟ" className="px-3 py-1 text-sm" onClick={() => start(EMPTY)}>+ เพิ่ม</Button>}
      </div>
      {buffs.length === 0 && !draft && (
        <p className="text-xs text-stone-500">{canAdd ? 'ยังไม่มี · เช่น Longstrider (Speed +10 ft.) หรือพรที่ +1 Skill Check จนพักยาว' : 'ยังไม่มี · DM เป็นคนใส่ให้'}</p>
      )}
      <BuffChips buffs={buffs} onRemove={canRemove ? (id) => act({ type: 'removeBuff', buffId: id }) : undefined} />

      {draft && (
        <div className="mt-2 space-y-2 rounded-lg bg-stone-900 p-3 text-sm">
          <div className="flex flex-wrap gap-1.5">
            {PRESETS.map((p) => (
              <button key={p.name} type="button" className="rounded-full border border-stone-600 px-2.5 py-1 text-xs" onClick={() => start(p)}>
                {p.name}
              </button>
            ))}
            <button type="button" className="rounded-full border border-stone-600 px-2.5 py-1 text-xs text-stone-400" onClick={() => start(EMPTY)}>ล้าง (ตั้งเอง)</button>
          </div>
          <input
            className="w-full rounded-lg border border-stone-600 bg-stone-800 px-2 py-1.5 text-base"
            placeholder="ชื่อ เช่น Longstrider, พรของเทพ"
            maxLength={60}
            value={draft.name}
            onChange={(e) => setDraft({ ...draft, name: e.target.value })}
          />
          <input
            className="w-full rounded-lg border border-stone-600 bg-stone-800 px-2 py-1.5 text-base"
            placeholder="หมายเหตุ (ไม่บังคับ) เช่น +1d4 Attack roll, Advantage ใน Stealth"
            maxLength={200}
            value={draft.note}
            onChange={(e) => setDraft({ ...draft, note: e.target.value })}
          />
          <div className="grid grid-cols-3 gap-2">
            {BUFF_TARGETS.map((t) => (
              <label key={t} className="text-xs text-stone-400">
                {BUFF_TARGET_LABEL[t]}{t === 'speed' && ' (ft.)'}
                <input
                  className="mt-0.5 w-full rounded-lg border border-stone-600 bg-stone-800 px-2 py-1 text-center text-base text-stone-100"
                  inputMode="numeric"
                  placeholder="0"
                  value={modText[t] ?? ''}
                  onChange={(e) => setMod(t, e.target.value)}
                />
              </label>
            ))}
          </div>
          <div className="flex flex-wrap gap-1.5">
            {BUFF_ENDS.map((e: BuffEnds) => (
              <button
                key={e}
                type="button"
                className={`rounded-full border px-2.5 py-1 text-xs ${draft.ends === e ? 'border-amber-400 bg-amber-900 font-bold' : 'border-stone-600 text-stone-400'}`}
                onClick={() => setDraft({ ...draft, ends: e })}
              >
                {BUFF_ENDS_LABEL[e]}
              </button>
            ))}
          </div>
          <p className="text-xs text-stone-500">
            ใส่ตัวเลข (ติดลบได้) เฉพาะที่บวกเป็นค่าคงที่ · โบนัสเป็นลูกเต๋า (เช่น Bless) หรือ Advantage ให้เขียนในหมายเหตุ · ชื่อซ้ำ = แทนอันเดิม (ไม่ซ้อนกัน)
          </p>
          <div className="flex gap-2">
            <Button variant="primary" className={`flex-1 ${draft.name.trim() ? '' : 'opacity-40'}`} onClick={save}>ใส่ให้ {c.name}</Button>
            <Button className="flex-1" onClick={() => setDraft(null)}>ยกเลิก</Button>
          </div>
        </div>
      )}
    </div>
  )
}
