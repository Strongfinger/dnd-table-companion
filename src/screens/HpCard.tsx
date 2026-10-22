// HP box at the top of the sheet: current/max with a bar, damage / heal / Temp HP, Heroic Inspiration,
// and chips of every status on the character (conditions, buffs…) so nobody forgets them mid-fight.
// It sits above the sheet's tabs, so it is on screen whichever tab is open.
// HP changes: tap ดาเมจ / ฮีล / Temp first, then type the number in the box that opens, then confirm.
import { forwardRef, useState } from 'react'
import type { Character } from '../model/character'
import type { CharacterAction } from '../model/characterActions'
import { activeStatuses, hpChangePreview, type HpChange, type StatusKind } from '../model/statusSummary'
import { Button, HelpButton, HpBar } from '../ui/kit'
import { Term } from '../ui/help'
import { useCharacterAct } from './useCharacterAct'

/** Button text, the question in the number box, and colours for each HP change. */
const CHANGES: Record<HpChange, { button: string; ask: string; confirm: string; variant?: 'danger' | 'heal'; ring: string }> = {
  damage: { button: '− ดาเมจ', ask: 'โดนดาเมจเท่าไร?', confirm: 'โดนดาเมจ', variant: 'danger', ring: 'border-red-500 bg-red-950/50' },
  heal: { button: '+ ฮีล', ask: 'ฟื้น HP เท่าไร?', confirm: 'ฮีล', variant: 'heal', ring: 'border-emerald-500 bg-emerald-950/50' },
  temp: { button: '🛡 Temp', ask: 'ได้ Temp HP เท่าไร?', confirm: 'ใส่ Temp HP', ring: 'border-sky-500 bg-sky-950/50' },
}

const CHIP_STYLE: Record<StatusKind, string> = {
  condition: 'border-red-400 bg-red-900 font-bold text-red-50',
  exhaustion: 'border-red-400 bg-red-950 text-red-200',
  concentration: 'border-violet-400 bg-violet-900 text-violet-100',
  buff: 'border-emerald-600 bg-emerald-950 text-emerald-100',
  magic: 'border-violet-600 bg-violet-950 text-violet-200',
}
const CHIP_ICON: Record<StatusKind, string> = { condition: '⚠️', exhaustion: '😩', concentration: '🔮', buff: '✨', magic: '💍' }

const HpCard = forwardRef<HTMLElement, {
  c: Character
  /** Open the full condition / buff picker (the ต่อสู้ tab). */
  onEditStatus?: () => void
}>(function HpCard({ c, onEditStatus }, ref) {
  const { act: apply } = useCharacterAct(c)
  const [change, setChange] = useState<HpChange | null>(null)
  const [amount, setAmount] = useState('')
  const [critical, setCritical] = useState(false)
  const [message, setMessage] = useState('')

  const act = async (action: CharacterAction) => {
    const { text, refused } = await apply(action)
    if (refused) setMessage(`🔒 ${refused}`)
    else if (text) setMessage(text)
  }
  const value = Math.max(0, Math.floor(Number(amount) || 0))
  const atZero = c.hp.current === 0
  const statuses = activeStatuses(c)

  function open(next: HpChange) {
    // Tapping the open one again closes it.
    setChange(change === next ? null : next)
    setAmount('')
    setCritical(false)
  }

  function confirm() {
    if (!change || !value) return
    if (change === 'damage') act({ type: 'damage', amount: value, critical })
    else if (change === 'heal') act({ type: 'heal', amount: value })
    else act({ type: 'tempHp', amount: value })
    setChange(null)
    setAmount('')
    setCritical(false)
  }

  return (
    <section ref={ref} id="hp" aria-label="HP" className="scroll-mt-28 space-y-3 rounded-xl border border-stone-700 bg-stone-800 p-3">
      <div className="flex items-end justify-between gap-2">
        <div>
          <span className={`text-4xl font-extrabold leading-none ${atZero ? 'text-red-400' : ''}`}>{c.hp.current}</span>
          <span className="text-lg text-stone-400"> / {c.hp.max} HP</span>
          {c.hp.temp > 0 && <span className="ml-2 rounded bg-sky-900 px-1 text-xs text-sky-200"><Term name="Temp HP">Temp {c.hp.temp}</Term></span>}
        </div>
        <HelpButton
          term="Heroic Inspiration"
          onClick={() => act({ type: 'setInspiration', on: !c.heroicInspiration })}
          className={`rounded-full border px-3 py-1.5 text-xs ${c.heroicInspiration ? 'border-amber-400 bg-amber-500 font-bold text-stone-900' : 'border-stone-600 text-stone-300'}`}
        >
          {c.heroicInspiration ? '★' : '☆'} Heroic Inspiration
        </HelpButton>
      </div>
      <HpBar current={c.hp.current} max={c.hp.max} />

      <div className="grid grid-cols-3 gap-2">
        {(Object.keys(CHANGES) as HpChange[]).map((k) => (
          <Button
            key={k}
            variant={CHANGES[k].variant}
            className={`min-h-11 whitespace-nowrap px-1 ${change && change !== k ? 'opacity-40' : ''} ${change === k ? 'ring-2 ring-amber-300' : ''}`}
            onClick={() => open(k)}
          >
            {CHANGES[k].button}
          </Button>
        ))}
      </div>

      {change && (
        <form
          className={`space-y-2 rounded-lg border p-3 ${CHANGES[change].ring}`}
          onSubmit={(e) => {
            e.preventDefault()
            confirm()
          }}
        >
          <label htmlFor="hp-amount" className="block text-sm font-bold">{CHANGES[change].ask}</label>
          <div className="flex gap-2">
            <input
              id="hp-amount"
              autoFocus
              className="min-w-0 flex-1 rounded-lg border border-stone-600 bg-stone-900 px-3 py-2 text-center text-2xl font-bold"
              inputMode="numeric"
              enterKeyHint="done"
              placeholder="0"
              value={amount}
              onChange={(e) => setAmount(e.target.value.replace(/\D/g, '').slice(0, 4))}
            />
            <Button onClick={confirm} variant={CHANGES[change].variant ?? 'primary'} className={`min-h-11 whitespace-nowrap px-4 ${value ? '' : 'opacity-40'}`}>
              {CHANGES[change].confirm}
            </Button>
          </div>
          {change === 'damage' && atZero && (
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" className="h-5 w-5 accent-amber-400" checked={critical} onChange={(e) => setCritical(e.target.checked)} />
              โดน Critical Hit (Death Save ล้มเหลว 2)
            </label>
          )}
          <div className="flex items-center justify-between gap-2 text-sm">
            <span className="text-stone-300">{value ? hpChangePreview(c, change, value, critical) : 'พิมพ์ตัวเลข แล้วกดยืนยัน'}</span>
            <button type="button" className="shrink-0 px-2 py-1 text-stone-400" onClick={() => setChange(null)}>ยกเลิก</button>
          </div>
        </form>
      )}

      {/* Every status on the character, always in view; tap to open the full picker. */}
      <div className="flex flex-wrap items-center gap-1.5" aria-label="สถานะที่ติดอยู่">
        {statuses.length === 0 && <span className="text-xs text-stone-500">ไม่มีสถานะติดตัว</span>}
        {statuses.map((s, i) => {
          const cls = `rounded-full border px-2.5 py-1 text-left text-xs ${CHIP_STYLE[s.kind]}`
          const body = <>{CHIP_ICON[s.kind]} {s.label}</>
          return s.term
            ? <HelpButton key={i} term={s.term} className={cls} onClick={() => onEditStatus?.()}>{body}</HelpButton>
            : <button key={i} type="button" className={cls} onClick={() => onEditStatus?.()}>{body}</button>
        })}
        {onEditStatus && (
          <button type="button" className="rounded-full border border-dashed border-stone-500 px-2.5 py-1 text-xs text-stone-300" onClick={onEditStatus}>
            ± สถานะ
          </button>
        )}
      </div>

      {message && <p className="rounded-lg bg-stone-900 p-2 text-sm text-amber-200">{message}</p>}
    </section>
  )
})

export default HpCard
