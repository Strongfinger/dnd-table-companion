// Several creatures at once: select shortcuts, one damage number with a preview, a condition for all,
// and one undo for the whole batch. DM-only: nothing here is sent to players (they never see monster HP).
import { useState, type RefObject } from 'react'
import { groupChips, planHp, QUICK_CONDITIONS, type BatchTarget, type DamageMode, type HpPlan } from '../model/batch'
import type { Character } from '../model/character'
import type { Combatant } from '../model/encounter'
import { CONDITION_TH } from '../ui/labels'
import type { Condition } from '../rules'

const DURATIONS: { label: string; rounds: number | null }[] = [
  { label: 'ไม่จำกัด', rounds: null },
  { label: '1 รอบ', rounds: 1 },
  { label: '10 รอบ', rounds: 10 },
]

const touch = 'min-h-11 lg:min-h-9'
const chip = `${touch} rounded-full border border-stone-600 px-3 text-sm hover:bg-stone-700`

export default function BatchBar({
  combatants, characters, selectedIds, onGroup, onSelectAll, onClear, amountRef, condOpen, onCondOpen,
  onDamage, onHeal, onCondition, undoText, onUndo, onDismissUndo,
}: {
  combatants: Combatant[]
  characters: Map<string, Character>
  selectedIds: string[]
  /** A group chip: add (or take out) these creatures. */
  onGroup: (ids: string[]) => void
  /** "All monsters" / "All players": select exactly these. */
  onSelectAll: (ids: string[]) => void
  onClear: () => void
  amountRef: RefObject<HTMLInputElement | null>
  condOpen: boolean
  onCondOpen: (open: boolean) => void
  onDamage: (amount: number, modes: Record<string, DamageMode>) => Promise<void>
  onHeal: (amount: number) => Promise<void>
  onCondition: (name: Condition, rounds: number | null) => Promise<void>
  /** What the last batch did, with an undo (empty = nothing to undo). */
  undoText: string
  onUndo: () => void
  onDismissUndo: () => void
}) {
  const [amount, setAmount] = useState('')
  const [modes, setModes] = useState<Record<string, DamageMode>>({})
  const [rounds, setRounds] = useState<number | null>(null)

  const selected = selectedIds.flatMap((id) => combatants.find((c) => c.id === id) ?? [])
  const targets: BatchTarget[] = selected.map((c) => ({ combatant: c, character: c.characterId ? characters.get(c.characterId) : undefined }))
  const value = Math.max(0, Math.floor(Number(amount) || 0))
  const plans = value > 0 ? planHp('damage', targets, value, modes) : []

  const alive = combatants.filter((c) => !c.defeated)
  const monsters = alive.filter((c) => c.kind === 'monster').map((c) => c.id)
  const players = combatants.filter((c) => c.kind === 'pc').map((c) => c.id)
  const groups = groupChips(combatants)

  async function applyDamage() {
    if (!value || selected.length === 0) return
    const m = modes
    setAmount('')
    setModes({})
    await onDamage(value, m)
    amountRef.current?.focus()
  }
  async function applyHeal() {
    if (!value || selected.length === 0) return
    setAmount('')
    setModes({})
    await onHeal(value)
    amountRef.current?.focus()
  }
  const toggle = (id: string, mode: DamageMode) => setModes((m) => ({ ...m, [id]: m[id] === mode ? 'full' : mode }))

  return (
    <div className="space-y-2">
      {/* Select shortcuts: always shown while a fight is running. */}
      <div className="flex flex-wrap items-center gap-1.5" role="group" aria-label="เลือกหลายตัว">
        <span className="text-xs text-stone-400">เลือก:</span>
        {groups.map((g) => <button key={g.label} type="button" className={chip} onClick={() => onGroup(g.ids)}>{g.label}</button>)}
        {monsters.length > 0 && <button type="button" className={chip} onClick={() => onSelectAll(monsters)}>มอนสเตอร์ทั้งหมด</button>}
        {players.length > 0 && <button type="button" className={chip} onClick={() => onSelectAll(players)}>ผู้เล่นทั้งหมด</button>}
        <span className="text-xs text-stone-500">· ติ๊กช่องหน้าแถว หรือ Shift+คลิกเพื่อเลือกช่วง</span>
      </div>

      {selected.length > 0 && (
        <section role="region" aria-label="ตัวที่เลือก" className="relative space-y-2 rounded-xl border border-sky-500/70 bg-stone-900 p-3">
          <div className="flex items-start gap-2">
            <p className="min-w-0 flex-1 text-sm"><b className="text-sky-300">✔ เลือก {selected.length}</b> · {selected.map((c) => c.name).join(', ')}</p>
            <button type="button" className={`${touch} shrink-0 rounded-lg bg-stone-800 px-3 text-sm hover:bg-stone-700`} onClick={onClear}>ล้าง (Esc)</button>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <label className="flex items-center gap-2 text-sm">
              ดาเมจ
              <input
                ref={amountRef}
                className={`${touch} w-20 rounded-lg border border-stone-600 bg-stone-950 px-2 text-center text-base`}
                inputMode="numeric"
                placeholder="0"
                aria-label="ดาเมจหรือฮีลที่ใส่ให้ตัวที่เลือก"
                value={amount}
                onChange={(e) => setAmount(e.target.value.replace(/\D/g, ''))}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.nativeEvent.isComposing) void applyDamage()
                  // Esc: first clear the number, then (when empty) the selection.
                  if (e.key === 'Escape') { if (amount) { setAmount(''); setModes({}) } else onClear() }
                }}
              />
            </label>
            <button type="button" aria-disabled={!value} onClick={() => void applyDamage()} className={`${touch} rounded-lg bg-red-800 px-3 font-bold text-white hover:bg-red-700 ${value ? '' : 'opacity-50'}`}>− ดาเมจ (Enter)</button>
            <button type="button" aria-disabled={!value} onClick={() => void applyHeal()} className={`${touch} rounded-lg bg-emerald-800 px-3 font-bold text-white hover:bg-emerald-700 ${value ? '' : 'opacity-50'}`}>+ ฮีล</button>
            <button type="button" aria-expanded={condOpen} onClick={() => onCondOpen(!condOpen)} className={`${touch} rounded-lg bg-stone-700 px-3 font-bold hover:bg-stone-600`}>🌀 Condition ▾</button>
            {!value && <span className="text-xs text-stone-400">ใส่ตัวเลขดาเมจ แล้วกด Enter</span>}
          </div>

          {condOpen && (
            <div className="absolute left-3 top-full z-30 mt-1 w-[min(34rem,calc(100%-1.5rem))] space-y-2 rounded-xl border border-stone-600 bg-stone-900 p-3 shadow-2xl" role="group" aria-label="ใส่ Condition ให้ตัวที่เลือก">
              <div className="flex flex-wrap items-center gap-1.5 text-sm">
                <span className="text-stone-400">ระยะเวลา:</span>
                {DURATIONS.map((d) => (
                  <button key={d.label} type="button" aria-pressed={rounds === d.rounds} onClick={() => setRounds(d.rounds)}
                    className={`${touch} rounded-full border px-3 ${rounds === d.rounds ? 'border-amber-400 bg-amber-500 font-bold text-stone-900' : 'border-stone-600'}`}>
                    {d.label}
                  </button>
                ))}
              </div>
              <div className="flex flex-wrap gap-1.5">
                {QUICK_CONDITIONS.map((c) => (
                  <button key={c} type="button" className={`${touch} rounded-full border border-red-400 bg-red-900/60 px-3 text-sm hover:bg-red-800`} onClick={() => { onCondOpen(false); void onCondition(c, rounds) }}>
                    {c} <span className="text-xs text-red-200">{CONDITION_TH[c]}</span>
                  </button>
                ))}
              </div>
              <p className="text-xs text-stone-400">แตะ Condition = ใส่ให้ทุกตัวที่เลือกทันที (ตัวที่มีอยู่แล้วจะถูกข้าม) · Condition อื่นๆ หรือกำหนดเอง: เปิดแถวของตัวนั้น</p>
            </div>
          )}

          {plans.length > 0 && (
            <div className="space-y-1 border-t border-stone-700 pt-2" aria-label="ตัวอย่างผลดาเมจ">
              <p className="text-xs text-stone-400">ตัวอย่างผล (ยังไม่ใช้) · ใช้ ½ Save ถ้าสำเร็จ Saving Throw แล้วลดครึ่ง · ต้านทาน/อ่อนแอ/อมตะ ใส่ด้วยมือ</p>
              {plans.map((p) => <PreviewRow key={p.id} p={p} value={value} onToggle={(mode) => toggle(p.id, mode)} />)}
            </div>
          )}
        </section>
      )}

      {undoText && (
        <div role="status" className="flex flex-wrap items-center gap-2 rounded-xl bg-stone-800 px-3 py-1.5 text-sm">
          <span className="min-w-0 flex-1">{undoText}</span>
          <button type="button" className={`${touch} rounded-lg bg-amber-500 px-3 font-bold text-stone-900 hover:bg-amber-400`} onClick={onUndo}>↩︎ เลิกทำ (Z)</button>
          <button type="button" aria-label="ซ่อนแถบเลิกทำ" className={`${touch} rounded-lg px-2 text-stone-400 hover:text-stone-200`} onClick={onDismissUndo}>✕</button>
        </div>
      )}
    </div>
  )
}

const OUTCOME: Record<HpPlan['outcome'], (p: HpPlan) => string> = {
  same: () => '',
  hurt: () => '',
  healed: () => '',
  up: () => '↑ กลับเข้าต่อสู้',
  down: (p) => (p.kind === 'pc' ? '⚠️ 0 HP หมดสติ' : '☠️ ล้ม'),
  dead: () => '💀 ตาย',
}

function PreviewRow({ p, value, onToggle }: { p: HpPlan; value: number; onToggle: (mode: DamageMode) => void }) {
  const dmg = p.mode === 'full' ? String(value) : p.mode === 'half' ? `${value} → ${p.amount}` : '0'
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
      <span className="min-w-0 flex-1">
        <b>{p.name}</b>{p.hidden && ' 🙈'}{' '}
        <span className="text-stone-300">HP {p.before.current} → {p.after.current}</span>{' '}
        <span className="text-xs text-stone-400">(ดาเมจ {dmg})</span>{' '}
        <span className="font-bold text-red-300">{OUTCOME[p.outcome](p)}</span>
      </span>
      <button type="button" aria-pressed={p.mode === 'half'} onClick={() => onToggle('half')}
        className={`${touch} rounded-lg border px-2.5 text-xs ${p.mode === 'half' ? 'border-amber-400 bg-amber-500 font-bold text-stone-900' : 'border-stone-600'}`}>
        ½ Save สำเร็จ{p.mode === 'half' && ' ✔'}
      </button>
      <button type="button" aria-pressed={p.mode === 'none'} onClick={() => onToggle('none')}
        className={`${touch} rounded-lg border px-2.5 text-xs ${p.mode === 'none' ? 'border-amber-400 bg-amber-500 font-bold text-stone-900' : 'border-stone-600'}`}>
        ไม่โดน{p.mode === 'none' && ' ✔'}
      </button>
    </div>
  )
}
