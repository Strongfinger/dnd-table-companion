// In-play tracking on the sheet: HP, death saves, rests, spell slots, features, conditions.
// Every tap saves straight to the device; the rules live in src/rules/play.ts.
import { useState } from 'react'
import { saveCharacter } from '../db/characters'
import { addLog } from '../db/log'
import type { Character } from '../model/character'
import {
  applyDamage, concentrationDC, CONDITIONS, exhaustionPenalty, gainTempHp, heal, hitDieSize, longRest, rollDeathSave,
  shortRest, spellSlotsFor, spendHitDie, type Condition,
} from '../rules'
import { Button, DiceRoll, Section } from '../ui/kit'
import { CONDITION_TH } from '../ui/labels'

const SLOT_LABEL = ['1st', '2nd', '3rd', '4th', '5th', '6th', '7th', '8th', '9th']

export default function PlayPanel({ c }: { c: Character }) {
  const [amount, setAmount] = useState('')
  const [critical, setCritical] = useState(false)
  const [message, setMessage] = useState('')
  const [resting, setResting] = useState(false)
  const [confirmLong, setConfirmLong] = useState(false)

  const save = (next: Character) => saveCharacter(next)
  /** Save the new state, show what happened, and write it to the play log. */
  const act = (next: Character, text: string) => {
    save(next)
    setMessage(text)
    addLog(c.id, text)
  }
  const hpText = (h: Character['hp']) => `HP ${h.current}/${h.max}${h.temp ? ` (+${h.temp} Temp)` : ''}`
  const rollText = (value: number, manual: boolean) => `${manual ? 'ทอยเอง' : '🎲'} ${value}`
  const value = Math.max(0, Math.floor(Number(amount) || 0))
  const atZero = c.hp.current === 0
  const dead = c.deathSaves.failures >= 3
  const stable = atZero && c.deathSaves.successes >= 3

  function damage() {
    if (!value) return
    const r = applyDamage(c, value, critical)
    const notes: string[] = [`โดน ${value} ดาเมจ${critical ? ' (Critical)' : ''} → ${hpText(r.hp)}`]
    if (r.dead) notes.push('💀 ตาย (Massive Damage หรือ Death Save ล้มเหลว 3 ครั้ง)')
    else if (r.droppedToZero) notes.push('HP เหลือ 0: หมดสติ เริ่มทอย Death Save')
    else if (atZero) notes.push(`Death Save ล้มเหลว +${critical ? 2 : 1}`)
    if (c.concentration && (r.droppedToZero || r.dead)) notes.push(`🔮 Concentration (${c.concentration}) หลุดเพราะหมดสติ`)
    else if (c.concentration) notes.push(`🔮 ทอย CON Save DC ${concentrationDC(value)} เพื่อรักษา Concentration (${c.concentration})`)
    // Dropping to 0 HP adds Unconscious automatically.
    const conditions: Condition[] = r.droppedToZero && !c.conditions.includes('Unconscious') ? [...c.conditions, 'Unconscious'] : c.conditions
    act({ ...c, hp: r.hp, deathSaves: r.deathSaves, conditions, concentration: r.droppedToZero ? '' : c.concentration }, notes.join(' · '))
    setAmount('')
    setCritical(false)
  }

  function healing() {
    if (!value) return
    const r = heal(c, value)
    // Regaining HP ends Unconscious from dropping to 0.
    act({ ...c, ...r, conditions: atZero ? c.conditions.filter((x) => x !== 'Unconscious') : c.conditions }, `ฮีล ${value} → ${hpText(r.hp)}`)
    setAmount('')
  }

  function tempHp() {
    if (!value) return
    act({ ...c, ...gainTempHp(c, value) }, c.hp.temp >= value ? `Temp HP ${value} ไม่ซ้อนกัน: ยังคง ${c.hp.temp}` : `ได้ Temp HP ${value}`)
    setAmount('')
  }

  function deathSave(d20: number, manual: boolean) {
    const r = rollDeathSave(c, d20)
    const text = {
      success: 'สำเร็จ', failure: 'ล้มเหลว', stable: 'สำเร็จครบ 3: อาการคงที่ (Stable)',
      dead: '💀 ล้มเหลวครบ 3: ตาย', revived: '✨ Nat 20! ฟื้นขึ้นมา 1 HP',
    }[r.outcome]
    const conditions = r.outcome === 'revived' ? c.conditions.filter((x) => x !== 'Unconscious') : c.conditions
    act({ ...c, hp: r.hp, deathSaves: r.deathSaves, conditions }, `Death Save: ${rollText(d20, manual)} → ${text}`)
  }

  function useHitDie(roll: number, manual: boolean) {
    const r = spendHitDie(c, roll, c.scores.con)
    if (!r) return setMessage(atZero ? 'HP 0 ใช้ Hit Dice ไม่ได้' : 'Hit Dice หมดแล้ว')
    act(r, `ใช้ Hit Die d${hitDieSize(c.className)}: ${rollText(roll, manual)} + CON → ฟื้น ${r.hp.current - c.hp.current} · ${hpText(r.hp)}`)
  }

  function finishShortRest() {
    setResting(false)
    act(shortRest(c), '☕ พักสั้นเสร็จ: ความสามารถแบบ Short Rest กลับมาแล้ว')
  }

  function doLongRest() {
    setConfirmLong(false)
    const r = longRest(c)
    if (!r) return setMessage('HP 0 พักยาวไม่ได้ (ต้องมีอย่างน้อย 1 HP)')
    act(
      { ...r, conditions: r.conditions.filter((x) => x !== 'Unconscious') },
      '🌙 พักยาวเสร็จ: ทุกอย่างกลับมาเต็ม' + (c.exhaustion > 0 ? ` · Exhaustion ลดเหลือ ${r.exhaustion}` : ''),
    )
  }

  /** Tap pip i: if it's used, give it back; otherwise use up to it. */
  const tapPip = (used: number, i: number) => (i < used ? i : i + 1)

  const slots = c.spellSlots.map((s, i) => ({ ...s, level: i })).filter((s) => s.max > 0)
  // Characters made before slots existed have none set; offer the class table in one tap.
  const tableSlots = spellSlotsFor(c.className, c.level)
  const slotsMissing = slots.length === 0 && tableSlots.some((n) => n > 0)

  function tapSlot(level: number, i: number) {
    const slot = c.spellSlots[level]
    const used = tapPip(slot.used, i)
    const verb = used > slot.used ? 'ใช้' : 'คืน'
    act(
      { ...c, spellSlots: c.spellSlots.map((x, j) => (j === level ? { ...x, used } : x)) },
      `${verb} Spell Slot ${SLOT_LABEL[level]} (เหลือ ${slot.max - used}/${slot.max})`,
    )
  }

  function tapFeature(id: string, i: number) {
    const f = c.features.find((x) => x.id === id)!
    const used = tapPip(f.used, i)
    act(
      { ...c, features: c.features.map((x) => (x.id === id ? { ...x, used } : x)) },
      `${used > f.used ? 'ใช้' : 'คืน'} ${f.name} (เหลือ ${f.max - used}/${f.max})`,
    )
  }

  function changeExhaustion(level: number) {
    const next = Math.min(6, Math.max(0, level))
    if (next !== c.exhaustion) act({ ...c, exhaustion: next }, `Exhaustion ${c.exhaustion} → ${next}`)
  }

  function toggleCondition(cond: Condition) {
    const on = c.conditions.includes(cond)
    act({ ...c, conditions: on ? c.conditions.filter((x) => x !== cond) : [...c.conditions, cond] }, `${on ? 'หาย' : 'ติด'} ${cond} (${CONDITION_TH[cond]})`)
  }
  const penalty = exhaustionPenalty(c.exhaustion)

  return (
    <Section title="ระหว่างเล่น">
      {/* HP */}
      <div className="flex items-end justify-between">
        <div>
          <div className={`text-4xl font-bold ${atZero ? 'text-red-400' : ''}`}>
            {c.hp.current}<span className="text-xl text-stone-400">/{c.hp.max}</span>
          </div>
          <div className="text-xs text-stone-400">HP{c.hp.temp > 0 && <span className="ml-2 rounded bg-sky-900 px-1 text-sky-200">Temp {c.hp.temp}</span>}</div>
        </div>
        <button
          type="button"
          onClick={() => act({ ...c, heroicInspiration: !c.heroicInspiration }, c.heroicInspiration ? 'ใช้ Heroic Inspiration' : 'ได้ Heroic Inspiration')}
          className={`rounded-lg px-3 py-2 text-sm ${c.heroicInspiration ? 'bg-amber-500 font-bold text-stone-900' : 'bg-stone-900 text-stone-400'}`}
        >
          {c.heroicInspiration ? '★' : '☆'} Heroic Inspiration
        </button>
      </div>

      <div className="mt-3 flex gap-2">
        <input
          className="w-16 rounded-lg border border-stone-600 bg-stone-900 px-2 py-2 text-center text-base"
          inputMode="numeric"
          placeholder="0"
          value={amount}
          onChange={(e) => setAmount(e.target.value.replace(/\D/g, ''))}
        />
        <Button variant="danger" className="flex-1 whitespace-nowrap px-2" onClick={damage}>− ดาเมจ</Button>
        <Button className="flex-1 whitespace-nowrap bg-emerald-800 px-2 hover:bg-emerald-700" onClick={healing}>+ ฮีล</Button>
        <Button className="whitespace-nowrap px-2" onClick={tempHp}>Temp</Button>
      </div>
      {atZero && (
        <label className="mt-2 flex items-center gap-2 text-sm">
          <input type="checkbox" className="h-5 w-5 accent-amber-400" checked={critical} onChange={(e) => setCritical(e.target.checked)} />
          โดน Critical Hit (Death Save ล้มเหลว 2)
        </label>
      )}
      {message && <p className="mt-2 rounded-lg bg-stone-900 p-2 text-sm text-amber-200">{message}</p>}

      {/* Death saves */}
      {atZero && (
        <div className="mt-3 rounded-lg bg-red-950/60 p-3">
          <div className="mb-2 font-bold text-red-300">{dead ? '💀 ตายแล้ว' : stable ? 'อาการคงที่ (Stable)' : 'Death Saves (DC 10)'}</div>
          <div className="flex justify-between text-sm">
            <span>สำเร็จ {'●'.repeat(c.deathSaves.successes)}{'○'.repeat(3 - c.deathSaves.successes)}</span>
            <span>ล้มเหลว {'●'.repeat(c.deathSaves.failures)}{'○'.repeat(3 - c.deathSaves.failures)}</span>
          </div>
          {!dead && !stable && <div className="mt-2"><DiceRoll sides={20} label="Death Save" onRoll={deathSave} /></div>}
        </div>
      )}

      {/* Concentration */}
      <div className="mt-4 flex items-center gap-2">
        <span className="text-sm text-stone-400">🔮 Concentration</span>
        <input
          className="min-w-0 flex-1 rounded-lg border border-stone-600 bg-stone-900 px-2 py-1 text-base"
          placeholder="ชื่อคาถา"
          value={c.concentration}
          onChange={(e) => save({ ...c, concentration: e.target.value })}
          onBlur={() => c.concentration && addLog(c.id, `🔮 เริ่ม Concentration: ${c.concentration}`)}
        />
        {c.concentration && <button type="button" className="text-sm text-red-400" onClick={() => act({ ...c, concentration: '' }, `🔮 เลิก Concentration: ${c.concentration}`)}>ยกเลิก</button>}
      </div>

      {/* Spell slots */}
      {slotsMissing && (
        <div className="mt-4 rounded-lg bg-stone-900 p-3 text-sm">
          <p className="mb-2 text-stone-400">Spell Slots ยังไม่ได้ตั้ง</p>
          <Button className="w-full" onClick={() => act({ ...c, spellSlots: tableSlots.map((max) => ({ max, used: 0 })) }, `ตั้ง Spell Slots ตามตาราง ${c.className} ${c.level}`)}>
            ✨ ตั้ง Spell Slots ตามตาราง {c.className} {c.level}
          </Button>
        </div>
      )}
      {slots.length > 0 && (
        <div className="mt-4">
          <div className="mb-1 text-sm text-stone-400">Spell Slots{c.className === 'Warlock' && ' (Pact Magic: คืนเมื่อพักสั้น)'} · แตะเพื่อใช้/คืน</div>
          {slots.map((s) => (
            <div key={s.level} className="flex items-center gap-2 py-1">
              <span className="w-10 text-sm">{SLOT_LABEL[s.level]}</span>
              {Array.from({ length: s.max }, (_, i) => (
                <button
                  key={i}
                  type="button"
                  aria-label={`${SLOT_LABEL[s.level]} slot ${i + 1}`}
                  onClick={() => tapSlot(s.level, i)}
                  className={`h-7 w-7 rounded-full border-2 border-violet-400 ${i < s.used ? 'bg-transparent' : 'bg-violet-500'}`}
                />
              ))}
              <span className="text-xs text-stone-400">{s.max - s.used}/{s.max}</span>
            </div>
          ))}
        </div>
      )}

      {/* Limited-use features */}
      {c.features.length > 0 && (
        <div className="mt-4">
          <div className="mb-1 text-sm text-stone-400">ความสามารถที่ใช้ได้จำกัด · แตะเพื่อใช้/คืน</div>
          {c.features.map((f) => (
            <div key={f.id} className="flex flex-wrap items-center gap-2 py-1">
              <span className="min-w-28 text-sm">{f.name}</span>
              {Array.from({ length: f.max }, (_, i) => (
                <button
                  key={i}
                  type="button"
                  aria-label={`${f.name} ${i + 1}`}
                  onClick={() => tapFeature(f.id, i)}
                  className={`h-7 w-7 rounded border-2 border-amber-400 ${i < f.used ? 'bg-transparent' : 'bg-amber-500'}`}
                />
              ))}
              <span className="text-xs text-stone-400">{f.recharge === 'short' ? 'Short Rest' : 'Long Rest'}</span>
            </div>
          ))}
        </div>
      )}

      {/* Rests */}
      <div className="mt-4 text-sm text-stone-400">Hit Dice: d{hitDieSize(c.className)} เหลือ {c.level - c.hitDiceSpent}/{c.level}</div>
      <div className="mt-2 flex gap-2">
        <Button className="flex-1" onClick={() => setResting(!resting)}>☕ พักสั้น</Button>
        <Button className="flex-1" onClick={() => setConfirmLong(!confirmLong)}>🌙 พักยาว</Button>
      </div>
      {confirmLong && (
        <div className="mt-2 space-y-2 rounded-lg bg-stone-900 p-3">
          <p className="text-sm">พักยาว 8 ชม.: HP, Hit Dice, Spell Slots และความสามารถทั้งหมดกลับมาเต็ม · Exhaustion −1</p>
          <Button variant="primary" className="w-full" onClick={doLongRest}>ยืนยันพักยาว</Button>
        </div>
      )}
      {resting && (
        <div className="mt-2 space-y-2 rounded-lg bg-stone-900 p-3">
          <p className="text-sm">ใช้ Hit Die เพื่อฟื้น HP (d{hitDieSize(c.className)} + CON) ได้ทีละลูก · เหลือ {c.level - c.hitDiceSpent} ลูก</p>
          <DiceRoll sides={hitDieSize(c.className)} label="Hit Die" onRoll={useHitDie} />
          <Button variant="primary" className="w-full" onClick={finishShortRest}>จบการพักสั้น</Button>
        </div>
      )}

      {/* Exhaustion */}
      <div className="mt-4 flex items-center gap-3">
        <span className="text-sm">Exhaustion</span>
        <button type="button" className="h-8 w-8 rounded bg-stone-700" onClick={() => changeExhaustion(c.exhaustion - 1)}>−</button>
        <span className={`w-4 text-center font-bold ${c.exhaustion ? 'text-red-400' : ''}`}>{c.exhaustion}</span>
        <button type="button" className="h-8 w-8 rounded bg-stone-700" onClick={() => changeExhaustion(c.exhaustion + 1)}>+</button>
        {c.exhaustion > 0 && (
          <span className="text-xs text-red-300">
            {c.exhaustion >= 6 ? '💀 ตาย' : `D20 −${penalty.d20} · Speed −${penalty.speed} ft. (หักในตัวเลขแล้ว)`}
          </span>
        )}
      </div>

      {/* Conditions */}
      <div className="mt-4">
        <div className="mb-1 text-sm text-stone-400">Conditions</div>
        <div className="flex flex-wrap gap-1.5">
          {CONDITIONS.filter((x): x is Condition => x !== 'Exhaustion').map((cond) => {
            const on = c.conditions.includes(cond)
            return (
              <button
                key={cond}
                type="button"
                title={CONDITION_TH[cond]}
                onClick={() => toggleCondition(cond)}
                className={`rounded-full border px-2.5 py-1 text-xs ${on ? 'border-red-400 bg-red-800 font-bold' : 'border-stone-600 text-stone-400'}`}
              >
                {cond} <span className="opacity-70">{CONDITION_TH[cond]}</span>
              </button>
            )
          })}
        </div>
      </div>
    </Section>
  )
}
