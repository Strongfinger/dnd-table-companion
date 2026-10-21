// HP box at the top of the sheet: current/max with a bar, damage / heal / Temp HP, Heroic Inspiration.
// It sits above the sheet's tabs, so it is on screen whichever tab is open.
import { forwardRef, useState } from 'react'
import type { Character } from '../model/character'
import type { CharacterAction } from '../model/characterActions'
import { Button, HelpButton, HpBar } from '../ui/kit'
import { Term } from '../ui/help'
import { useCharacterAct } from './useCharacterAct'

const HpCard = forwardRef<HTMLElement, { c: Character }>(function HpCard({ c }, ref) {
  const { act: apply } = useCharacterAct(c)
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

  function damage() {
    if (!value) return
    act({ type: 'damage', amount: value, critical })
    setAmount('')
    setCritical(false)
  }

  function healing() {
    if (!value) return
    act({ type: 'heal', amount: value })
    setAmount('')
  }

  function tempHp() {
    if (!value) return
    act({ type: 'tempHp', amount: value })
    setAmount('')
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
      <div className="flex gap-2">
        <input
          id="hp-amount"
          aria-label="จำนวน HP"
          className="w-16 rounded-lg border border-stone-600 bg-stone-900 px-2 py-2 text-center text-base"
          inputMode="numeric"
          placeholder="0"
          value={amount}
          onChange={(e) => setAmount(e.target.value.replace(/\D/g, ''))}
        />
        <Button variant="danger" className="min-h-11 flex-1 whitespace-nowrap px-2" onClick={damage}>− ดาเมจ</Button>
        <Button variant="heal" className="min-h-11 flex-1 whitespace-nowrap px-2" onClick={healing}>+ ฮีล</Button>
        <Button className="min-h-11 whitespace-nowrap px-3" onClick={tempHp}>Temp</Button>
      </div>
      {atZero && (
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" className="h-5 w-5 accent-amber-400" checked={critical} onChange={(e) => setCritical(e.target.checked)} />
          โดน Critical Hit (Death Save ล้มเหลว 2)
        </label>
      )}
      {message && <p className="rounded-lg bg-stone-900 p-2 text-sm text-amber-200">{message}</p>}
    </section>
  )
})

export default HpCard
