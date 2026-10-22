// In-play tracking on the sheet: Concentration, rests, Exhaustion, conditions, buffs.
// (Action economy, death saves, spell slots and features moved to UsableNow.tsx.)
// Every tap saves straight to the device; the rules live in src/rules/play.ts.
import { useState } from 'react'
import { useLobby } from '../app/useLobby'
import type { SuggestionKind } from '../model/actionSuggestions'
import type { Character } from '../model/character'
import type { CharacterAction } from '../model/characterActions'
import { CONDITIONS, exhaustionPenalty, hitDieSize, type Condition } from '../rules'
import { Button, DiceRoll, HelpButton, Section } from '../ui/kit'
import { Term } from '../ui/help'
import ActionChoiceDialog from './ActionChoiceDialog'
import BuffPanel from './BuffPanel'
import { useCharacterAct } from './useCharacterAct'
import { CONDITION_TH } from '../ui/labels'

export default function PlayPanel({ c }: { c: Character }) {
  const lobby = useLobby()
  const [message, setMessage] = useState('')
  const [resting, setResting] = useState(false)
  const [confirmLong, setConfirmLong] = useState(false)
  // The Concentration confirm dialog (Action / Bonus Action / Reaction live in UsableNow).
  const [pending, setPending] = useState<SuggestionKind | null>(null)

  const { act: apply, asPlayer } = useCharacterAct(c)
  /** Send one action and show what happened (or why it was refused). */
  const act = async (action: CharacterAction) => {
    const { text, refused } = await apply(action)
    if (refused) setMessage(`🔒 ${refused}`)
    else if (text) setMessage(text)
  }
  const atZero = c.hp.current === 0

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

  const changeExhaustion = (delta: number) => act({ type: 'setExhaustion', level: c.exhaustion + delta })
  const toggleCondition = (cond: Condition) => act({ type: 'setCondition', condition: cond, on: !c.conditions.includes(cond) })
  const penalty = exhaustionPenalty(c.exhaustion)

  return (
    <Section title="ระหว่างเล่น">
      {/* HP sits above the tabs on the sheet (HpCard), so it never scrolls away. */}
      {message && <p className="mb-2 rounded-lg bg-stone-900 p-2 text-sm text-amber-200">{message}</p>}

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

      {/* Rests */}
      <div className="mt-4 text-sm text-stone-400"><Term name="Hit Dice" />: d{hitDieSize(c)} เหลือ {c.level - c.hitDiceSpent}/{c.level}</div>
      {asPlayer ? (
        lobby.shortRestSince ? (
          // The DM started a short rest: Hit Dice can be spent until the DM ends it.
          <div id="short-rest" className="mt-2 space-y-2 rounded-lg bg-sky-950 p-3">
            <p className="text-sm font-bold text-sky-200">☕ กำลังพักสั้น (DM เริ่มแล้ว)</p>
            <p className="text-sm">ใช้ Hit Die เพื่อฟื้น HP (d{hitDieSize(c)} + CON) ได้ทีละลูก · เหลือ {c.level - c.hitDiceSpent} ลูก · DM จะกดจบการพักให้</p>
            <DiceRoll sides={hitDieSize(c)} label="Hit Die" onRoll={useHitDie} />
          </div>
        ) : (
          <p className="mt-2 rounded-lg bg-stone-900 p-2 text-xs text-stone-400">🔒 พักสั้น/พักยาว: DM เป็นคนเริ่มให้ทั้งปาร์ตี้ · ใช้ Hit Dice ได้ระหว่างพักสั้นที่ DM เริ่ม</p>
        )
      ) : (
        <div className="mt-2 flex gap-2">
          <HelpButton term="Short Rest" className="flex-1 rounded-lg bg-stone-700 px-4 py-2 font-bold hover:bg-stone-600" onClick={() => setResting(!resting)}>☕ พักสั้น</HelpButton>
          <HelpButton term="Long Rest" className="flex-1 rounded-lg bg-stone-700 px-4 py-2 font-bold hover:bg-stone-600" onClick={() => setConfirmLong(!confirmLong)}>🌙 พักยาว</HelpButton>
        </div>
      )}
      {confirmLong && (
        <div className="mt-2 space-y-2 rounded-lg bg-stone-900 p-3">
          <p className="text-sm">พักยาว 8 ชม.: HP, Hit Dice, Spell Slots และความสามารถทั้งหมดกลับมาเต็ม · Exhaustion −1</p>
          <Button variant="primary" className="w-full" onClick={doLongRest}>ยืนยันพักยาว</Button>
        </div>
      )}
      {resting && (
        <div className="mt-2 space-y-2 rounded-lg bg-stone-900 p-3">
          <p className="text-sm">ใช้ Hit Die เพื่อฟื้น HP (d{hitDieSize(c)} + CON) ได้ทีละลูก · เหลือ {c.level - c.hitDiceSpent} ลูก</p>
          <DiceRoll sides={hitDieSize(c)} label="Hit Die" onRoll={useHitDie} />
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
      <BuffPanel c={c} act={act} canAdd={!asPlayer} canRemove />
      {pending && (
        <ActionChoiceDialog
          kind={pending}
          character={c}
          title={pending === 'concentration' ? '🔮 เริ่ม Concentration: คาถาอะไร?' : `⚡ ใช้ ${pending === 'action' ? 'Action' : pending === 'bonusAction' ? 'Bonus Action' : 'Reaction'} ทำอะไร?`}
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
