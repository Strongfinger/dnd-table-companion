// Floating dice roller: any expression ("2d6+3"), advantage/disadvantage, Critical Hit,
// rolled in the app or typed in from real dice. History stays while the app is open.
// In a live lobby, rolls can be shared with the room (players: on by default; DM: off, DM rolls are often secret).
import { useState } from 'react'
import {
  addDie, addModifier, canBeCritical, canUseAdvantage, criticalDice, diceRange, formatDice, naturalD20, naturalFromManual,
  parseDice, resolveRollMode, rollDice, totalFromManualDice, type RollMode,
} from '../rules'
import { useLobby } from '../app/useLobby'
import { rollEventText } from '../model/rollEvent'
import { Button } from '../ui/kit'

export interface RollRecord {
  id: number
  expression: string
  mode: RollMode
  critical: boolean
  /** Dice faces per term; null when the player typed the sum from real dice. */
  faces: number[][] | null
  total: number
  natural: 20 | 1 | null
}

const QUICK_DICE = [4, 6, 8, 10, 12, 20, 100]
const MODE_LABEL: Record<RollMode, string> = { normal: 'ปกติ', advantage: 'Advantage', disadvantage: 'Disadvantage' }

export default function DiceRoller({ history, onRoll }: { history: RollRecord[]; onRoll: (r: Omit<RollRecord, 'id'>) => void }) {
  const [open, setOpen] = useState(false)
  const [text, setText] = useState('1d20')
  const [advantage, setAdvantage] = useState(false)
  const [disadvantage, setDisadvantage] = useState(false)
  const [critical, setCritical] = useState(false)
  const [manual, setManual] = useState('')
  const lobby = useLobby()
  // null = the default for my role in the room.
  const [shareChoice, setShareChoice] = useState<boolean | null>(null)
  const share = !!lobby.session && (shareChoice ?? lobby.session.role === 'player')
  const roomRolls = lobby.rolls.filter((r) => !r.mine)

  /** Keep it here, and share it with the room if sharing is on. */
  function record(r: Omit<RollRecord, 'id'>) {
    onRoll(r)
    if (share) lobby.shareRoll(r)
  }

  const parsed = parseDice(text)
  // Advantage/disadvantage: single d20 only. Both at once cancel out (2024).
  const advOk = parsed !== null && canUseAdvantage(parsed)
  const effectiveMode = advOk ? resolveRollMode(advantage, disadvantage) : 'normal'
  // A Critical Hit doubles damage dice only (not the modifier, never a d20 roll).
  const critOk = parsed !== null && canBeCritical(parsed)
  const crit = critical && critOk
  const expr = parsed && crit ? criticalDice(parsed) : parsed
  const range = expr ? diceRange(expr) : null
  const manualSum = Number(manual)
  const manualTotal = expr && manual.trim() !== '' ? totalFromManualDice(expr, manualSum) : null
  const last = history[0]

  function roll() {
    if (!expr) return
    const r = rollDice(expr, effectiveMode)
    record({ expression: formatDice(expr), mode: effectiveMode, critical: crit, faces: r.rolls, total: r.total, natural: naturalD20(expr, r) })
  }

  function useManual() {
    if (!expr || manualTotal === null) return
    // With advantage at the table, the player rolls two d20s and types the one they keep.
    record({ expression: formatDice(expr), mode: effectiveMode, critical: crit, faces: null, total: manualTotal, natural: naturalFromManual(expr, manualSum) })
    setManual('')
  }

  return (
    <>
      {/* Hidden while open, so it never covers the roller's own buttons. */}
      {!open && (
        <button
          type="button"
          aria-label="เปิดตัวทอยลูกเต๋า"
          onClick={() => setOpen(true)}
          className="fixed right-4 bottom-20 z-30 flex h-14 w-14 items-center justify-center rounded-full bg-amber-500 text-2xl shadow-lg shadow-black/50"
        >
          🎲
        </button>
      )}

      {open && (
        <div className="fixed inset-x-0 bottom-0 z-30 max-h-[85dvh] overflow-y-auto rounded-t-2xl border-t border-stone-700 bg-stone-900 p-4 pb-8 shadow-2xl">
          <div className="mx-auto max-w-xl space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="font-bold text-amber-400">🎲 ทอยลูกเต๋า</h2>
              <button type="button" aria-label="ปิดตัวทอยลูกเต๋า" onClick={() => setOpen(false)} className="h-10 w-10 rounded-full bg-stone-700 text-lg">✕</button>
            </div>

            {/* Last result, big */}
            {last && (
              <div className={`rounded-xl p-3 text-center ${last.natural === 20 ? 'bg-emerald-900' : last.natural === 1 ? 'bg-red-900' : 'bg-stone-800'}`}>
                <div className="text-5xl font-bold">{last.total}</div>
                <div className="text-sm text-stone-300">
                  {last.expression}{last.mode !== 'normal' && ` · ${MODE_LABEL[last.mode]}`}{last.critical && ' · Critical'}
                  {last.faces ? ` · 🎲 [${last.faces.map((f) => f.join(', ')).join(' | ')}]` : ' · ทอยเอง'}
                  {last.natural === 20 && ' · Nat 20!'}{last.natural === 1 && ' · Nat 1'}
                </div>
              </div>
            )}

            {/* Expression */}
            <div className="flex gap-2">
              <input
                className={`min-w-0 flex-1 rounded-lg border bg-stone-950 px-3 py-2 text-center font-mono text-lg ${parsed ? 'border-stone-600' : 'border-red-500'}`}
                value={text}
                aria-label="สูตรลูกเต๋า"
                onChange={(e) => setText(e.target.value)}
              />
              <Button className="px-3" onClick={() => setText('')}>ล้าง</Button>
            </div>
            {!parsed && <p className="text-xs text-red-300">พิมพ์แบบ 2d6+3, d20+5 หรือ 1d8+1d6</p>}
            <div className="flex flex-wrap gap-1.5">
              {QUICK_DICE.map((d) => (
                <button key={d} type="button" className="rounded-lg bg-stone-700 px-3 py-2 font-bold" onClick={() => setText(addDie(text, d))}>d{d}</button>
              ))}
              <button type="button" className="rounded-lg bg-stone-700 px-3 py-2 font-bold" onClick={() => setText(addModifier(text, -1))}>−1</button>
              <button type="button" className="rounded-lg bg-stone-700 px-3 py-2 font-bold" onClick={() => setText(addModifier(text, 1))}>+1</button>
            </div>

            {/* Options */}
            <div className="flex flex-wrap gap-1.5 text-sm">
              <button
                type="button"
                disabled={!advOk}
                onClick={() => setAdvantage(!advantage)}
                className={`rounded-full border px-3 py-1 ${advantage && advOk ? 'border-emerald-400 bg-emerald-800 font-bold' : 'border-stone-600'} disabled:opacity-30`}
              >
                Advantage
              </button>
              <button
                type="button"
                disabled={!advOk}
                onClick={() => setDisadvantage(!disadvantage)}
                className={`rounded-full border px-3 py-1 ${disadvantage && advOk ? 'border-red-400 bg-red-800 font-bold' : 'border-stone-600'} disabled:opacity-30`}
              >
                Disadvantage
              </button>
              <button
                type="button"
                disabled={!critOk}
                onClick={() => setCritical(!critical)}
                className={`rounded-full border px-3 py-1 ${crit ? 'border-red-400 bg-red-800 font-bold' : 'border-stone-600'} disabled:opacity-30`}
              >
                Critical (ลูกเต๋าดาเมจ ×2)
              </button>
            </div>
            {advOk && advantage && disadvantage && <p className="text-xs text-amber-300">มีทั้ง Advantage และ Disadvantage: หักล้างกัน ทอยปกติ</p>}
            {!advOk && <p className="text-xs text-stone-500">Advantage/Disadvantage ใช้กับการทอย d20 ลูกเดียว (เช่น d20+5) · Critical ใช้กับลูกเต๋าดาเมจ</p>}

            {/* Roll in the app, or type what the real dice show */}
            <Button variant="primary" className={`w-full py-3 text-lg ${expr ? '' : 'opacity-50'}`} onClick={roll}>
              🎲 ทอย {expr ? formatDice(expr) : ''}
            </Button>
            <div className="flex gap-2">
              <input
                className="min-w-0 flex-1 rounded-lg border border-stone-600 bg-stone-950 px-3 py-2 text-center text-base"
                inputMode="numeric"
                placeholder={range ? `ผลรวมลูกเต๋าจริง (${range.min}–${range.max})` : 'ผลรวมลูกเต๋าจริง'}
                aria-label="ผลรวมลูกเต๋าที่ทอยได้จริง"
                value={manual}
                onChange={(e) => setManual(e.target.value.replace(/[^\d-]/g, ''))}
              />
              <Button className={`whitespace-nowrap px-3 ${manualTotal === null ? 'opacity-40' : ''}`} onClick={useManual}>
                ใช้ค่านี้{manualTotal !== null && expr && expr.modifier !== 0 ? ` (=${manualTotal})` : ''}
              </Button>
            </div>
            {effectiveMode !== 'normal' && <p className="text-xs text-stone-500">ทอยจริง: ทอย d20 สองลูก แล้วใส่ลูกที่{effectiveMode === 'advantage' ? 'สูงกว่า' : 'ต่ำกว่า'}</p>}

            {lobby.session && (
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={share} onChange={(e) => setShareChoice(e.target.checked)} />
                🌐 แชร์ผลทอยให้ทุกคนในห้อง {lobby.session.code} เห็น{lobby.session.role === 'dm' && ' (ปกติ DM ทอยลับ)'}
              </label>
            )}

            {/* Rolls from others in the room */}
            {roomRolls.length > 0 && (
              <div>
                <div className="mb-1 text-xs text-stone-400">🌐 ทอยล่าสุดในห้อง</div>
                <ul className="space-y-1 text-sm">
                  {roomRolls.slice(0, 8).map((r) => (
                    <li key={r.id} className={`rounded bg-sky-950 px-2 py-1 ${r.roll.natural === 20 ? 'text-emerald-300' : r.roll.natural === 1 ? 'text-red-300' : ''}`}>
                      {rollEventText(r.roll)}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* History */}
            {history.length > 1 && (
              <ul className="space-y-1 text-sm">
                {history.slice(1, 15).map((h) => (
                  <li key={h.id} className="flex justify-between rounded bg-stone-800 px-2 py-1">
                    <span className="text-stone-400">
                      {h.expression}{h.mode !== 'normal' && ` (${MODE_LABEL[h.mode]})`}{h.critical && ' Crit'}{!h.faces && ' · ทอยเอง'}
                    </span>
                    <span className={`font-bold ${h.natural === 20 ? 'text-emerald-400' : h.natural === 1 ? 'text-red-400' : ''}`}>{h.total}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}
    </>
  )
}
