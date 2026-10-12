// In-play tracking on the sheet: HP, death saves, rests, spell slots, features, conditions.
// Every tap saves straight to the device; the rules live in src/rules/play.ts.
import { useState } from 'react'
import { useLobby } from '../app/useLobby'
import { updateCharacter } from '../db/characters'
import { logCharacterEvent } from '../db/log'
import { actionSuggestions, type SuggestionKind } from '../model/actionSuggestions'
import { isDead } from '../model/actions'
import type { Character } from '../model/character'
import { applyCharacterAction, type CharacterAction } from '../model/characterActions'
import { CONDITIONS, exhaustionPenalty, hitDieSize, spellSlotsFor, type Condition } from '../rules'
import { ActionEconomyBar, Button, DiceRoll, HelpButton, Section } from '../ui/kit'
import { Term } from '../ui/help'
import UseActionDialog from '../ui/UseActionDialog'
import { CONDITION_TH } from '../ui/labels'

const SLOT_LABEL = ['1st', '2nd', '3rd', '4th', '5th', '6th', '7th', '8th', '9th']

export default function PlayPanel({ c }: { c: Character }) {
  const lobby = useLobby()
  const [amount, setAmount] = useState('')
  const [critical, setCritical] = useState(false)
  const [message, setMessage] = useState('')
  const [resting, setResting] = useState(false)
  const [confirmLong, setConfirmLong] = useState(false)
  // Which confirm dialog is open: an Action / Bonus Action / Reaction, or Concentration.
  const [pending, setPending] = useState<SuggestionKind | null>(null)

  /**
   * Send one action (see model/characterActions.ts): it's applied to the newest saved copy,
   * shown, and logged. In a live lobby a player's action also goes to the DM's device.
   */
  const act = async (action: CharacterAction) => {
    const text = await updateCharacter(c.id, (ch) => applyCharacterAction(ch, action) ?? { character: ch, text: '' })
    lobby.shareAction(c.id, action)
    if (text) {
      setMessage(text)
      // Also lands in the fight log if this character is in a running fight on this device.
      logCharacterEvent(c.id, text)
    }
  }
  const value = Math.max(0, Math.floor(Number(amount) || 0))
  const atZero = c.hp.current === 0
  const dead = isDead(c)
  const stable = atZero && c.deathSaves.successes >= 3

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

  const deathSave = (d20: number, manual: boolean) => act({ type: 'deathSave', d20, manual })

  function useHitDie(roll: number, manual: boolean) {
    if (atZero || c.hitDiceSpent >= c.level) return setMessage(atZero ? 'HP 0 ใช้ Hit Dice ไม่ได้' : 'Hit Dice หมดแล้ว')
    act({ type: 'spendHitDie', roll, manual })
  }

  function finishShortRest() {
    setResting(false)
    act({ type: 'shortRest' })
  }

  function doLongRest() {
    setConfirmLong(false)
    if (atZero) return setMessage('HP 0 พักยาวไม่ได้ (ต้องมีอย่างน้อย 1 HP)')
    act({ type: 'longRest' })
  }

  /** Tap pip i: if it's used, give it back; otherwise use up to it. */
  const tapPip = (used: number, i: number) => (i < used ? i : i + 1)

  const slots = c.spellSlots.map((s, i) => ({ ...s, level: i })).filter((s) => s.max > 0)
  // Characters made before slots existed have none set; offer the class table in one tap.
  const slotsMissing = slots.length === 0 && spellSlotsFor(c.className, c.level).some((n) => n > 0)

  const tapSlot = (level: number, i: number) => act({ type: 'setSlotUsed', level, used: tapPip(c.spellSlots[level].used, i) })

  function tapFeature(id: string, i: number) {
    const f = c.features.find((x) => x.id === id)
    if (f) act({ type: 'setFeatureUsed', featureId: id, used: tapPip(f.used, i) })
  }

  const changeExhaustion = (delta: number) => act({ type: 'setExhaustion', level: c.exhaustion + delta })
  const toggleCondition = (cond: Condition) => act({ type: 'setCondition', condition: cond, on: !c.conditions.includes(cond) })
  const penalty = exhaustionPenalty(c.exhaustion)

  return (
    <Section title="ระหว่างเล่น">
      {/* HP */}
      <div className="flex items-end justify-between">
        <div>
          <div className={`text-4xl font-bold ${atZero ? 'text-red-400' : ''}`}>
            {c.hp.current}<span className="text-xl text-stone-400">/{c.hp.max}</span>
          </div>
          <div className="text-xs text-stone-400">HP{c.hp.temp > 0 && <span className="ml-2 rounded bg-sky-900 px-1 text-sky-200"><Term name="Temp HP">Temp {c.hp.temp}</Term></span>}</div>
        </div>
        <HelpButton
          term="Heroic Inspiration"
          onClick={() => act({ type: 'setInspiration', on: !c.heroicInspiration })}
          className={`rounded-lg px-3 py-2 text-sm ${c.heroicInspiration ? 'bg-amber-500 font-bold text-stone-900' : 'bg-stone-900 text-stone-400'}`}
        >
          {c.heroicInspiration ? '★' : '☆'} Heroic Inspiration
        </HelpButton>
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

      {/* Action economy for this turn (the combat tracker resets it automatically) */}
      <div className="mt-3 flex items-center gap-2">
        <div className="flex-1">
          <ActionEconomyBar
            economy={c.turn}
            // Using one asks what for (then logs it); tapping a used one gives it back.
            onToggle={(kind) => (c.turn[kind] ? act({ type: 'setActionUsed', kind, used: false }) : setPending(kind))}
          />
        </div>
        <Button className="whitespace-nowrap px-2 text-sm" onClick={() => act({ type: 'resetTurn' })}>
          ↻ เทิร์นใหม่
        </Button>
      </div>

      {/* Death saves */}
      {atZero && (
        <div className="mt-3 rounded-lg bg-red-950/60 p-3">
          <div className="mb-2 font-bold text-red-300">{dead ? '💀 ตายแล้ว' : stable ? <Term name="Stable">อาการคงที่ (Stable)</Term> : <Term name="Death Save">Death Saves (DC 10)</Term>}</div>
          {dead && <Button className="mb-2 w-full" onClick={() => act({ type: 'revive' })}>✨ ชุบชีวิต (เช่น Revivify): กลับมาที่ 1 HP</Button>}
          <div className="flex justify-between text-sm">
            <span>สำเร็จ {'●'.repeat(c.deathSaves.successes)}{'○'.repeat(3 - c.deathSaves.successes)}</span>
            <span>ล้มเหลว {'●'.repeat(c.deathSaves.failures)}{'○'.repeat(3 - c.deathSaves.failures)}</span>
          </div>
          {!dead && !stable && <div className="mt-2"><DiceRoll sides={20} label="Death Save" onRoll={deathSave} /></div>}
        </div>
      )}

      {/* Concentration: started through the confirm dialog, so it's always logged */}
      <div className="mt-4 flex items-center gap-2">
        {c.concentration ? (
          <>
            <span className="flex-1 rounded-lg bg-violet-900/60 px-3 py-2 text-sm">🔮 <Term name="Concentration" />: <b>{c.concentration}</b></span>
            <button type="button" className="text-sm text-red-400" onClick={() => act({ type: 'setConcentration', spell: '' })}>เลิก</button>
          </>
        ) : (
          <Button className="flex-1 text-sm" onClick={() => setPending('concentration')}>🔮 เริ่ม Concentration</Button>
        )}
      </div>

      {/* Spell slots */}
      {slotsMissing && (
        <div className="mt-4 rounded-lg bg-stone-900 p-3 text-sm">
          <p className="mb-2 text-stone-400">Spell Slots ยังไม่ได้ตั้ง</p>
          <Button className="w-full" onClick={() => act({ type: 'setSlotsFromTable' })}>
            ✨ ตั้ง Spell Slots ตามตาราง {c.className} {c.level}
          </Button>
        </div>
      )}
      {slots.length > 0 && (
        <div className="mt-4">
          <div className="mb-1 text-sm text-stone-400"><Term name="Spell Slots" />{c.className === 'Warlock' && ' (Pact Magic: คืนเมื่อพักสั้น)'} · แตะเพื่อใช้/คืน</div>
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
      <div className="mt-4 text-sm text-stone-400"><Term name="Hit Dice" />: d{hitDieSize(c.className)} เหลือ {c.level - c.hitDiceSpent}/{c.level}</div>
      <div className="mt-2 flex gap-2">
        <HelpButton term="Short Rest" className="flex-1 rounded-lg bg-stone-700 px-4 py-2 font-bold hover:bg-stone-600" onClick={() => setResting(!resting)}>☕ พักสั้น</HelpButton>
        <HelpButton term="Long Rest" className="flex-1 rounded-lg bg-stone-700 px-4 py-2 font-bold hover:bg-stone-600" onClick={() => setConfirmLong(!confirmLong)}>🌙 พักยาว</HelpButton>
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
        <span className="text-sm"><Term name="Exhaustion" /></span>
        <button type="button" className="h-8 w-8 rounded bg-stone-700" onClick={() => changeExhaustion(-1)}>−</button>
        <span className={`w-4 text-center font-bold ${c.exhaustion ? 'text-red-400' : ''}`}>{c.exhaustion}</span>
        <button type="button" className="h-8 w-8 rounded bg-stone-700" onClick={() => changeExhaustion(1)}>+</button>
        {c.exhaustion > 0 && (
          <span className="text-xs text-red-300">
            {c.exhaustion >= 6 ? '💀 ตาย' : `D20 −${penalty.d20} · Speed −${penalty.speed} ft. (หักในตัวเลขแล้ว)`}
          </span>
        )}
      </div>

      {/* Conditions */}
      <div className="mt-4">
        <div className="mb-1 text-sm text-stone-400">Conditions <span className="text-xs text-stone-600">· กดค้าง/ชี้เมาส์ เพื่อดูคำอธิบาย</span></div>
        <div className="flex flex-wrap gap-1.5">
          {CONDITIONS.filter((x): x is Condition => x !== 'Exhaustion').map((cond) => {
            const on = c.conditions.includes(cond)
            return (
              <HelpButton
                key={cond}
                term={cond}
                onClick={() => toggleCondition(cond)}
                className={`rounded-full border px-2.5 py-1 text-xs ${on ? 'border-red-400 bg-red-800 font-bold' : 'border-stone-600 text-stone-400'}`}
              >
                {cond} <span className="opacity-70">{CONDITION_TH[cond]}</span>
              </HelpButton>
            )
          })}
        </div>
      </div>
      {pending && (
        <UseActionDialog
          title={pending === 'concentration' ? '🔮 เริ่ม Concentration: คาถาอะไร?' : `⚡ ใช้ ${pending === 'action' ? 'Action' : pending === 'bonusAction' ? 'Bonus Action' : 'Reaction'} ทำอะไร?`}
          suggestions={actionSuggestions(pending, c)}
          placeholder={pending === 'concentration' ? 'พิมพ์ชื่อคาถา เช่น Bless' : 'เลือกด้านบน หรือพิมพ์เอง (เว้นว่างได้)'}
          required={pending === 'concentration'}
          onCancel={() => setPending(null)}
          onConfirm={(detail) => {
            act(pending === 'concentration'
              ? { type: 'setConcentration', spell: detail }
              : { type: 'setActionUsed', kind: pending, used: true, detail })
            setPending(null)
          }}
        />
      )}
    </Section>
  )
}
