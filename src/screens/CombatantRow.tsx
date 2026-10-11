// One line in the initiative order; tap to open its controls.
import { useState } from 'react'
import {
  damageCharacter, deathSaveCharacter, healCharacter, isDead, reviveCharacter, tempHpCharacter, type ActionResult,
} from '../model/actions'
import type { Character } from '../model/character'
import {
  addEffect, conditionsToClear, damageMonster, healMonster, isConditionName, removeEffect, rollInitiative, tempHpMonster,
  type Combatant, type MonsterResult,
} from '../model/encounter'
import { CONDITIONS, deriveSheet, formatModifier, type Condition } from '../rules'
import { Button, DiceRoll } from '../ui/kit'
import { CONDITION_TH } from '../ui/labels'

const CONDITION_LIST = CONDITIONS.filter((x): x is Condition => x !== 'Exhaustion')

export default function CombatantRow({ c, character, active, open, onToggle, onInitiative, onUpdate, onCharacter, onRemove }: {
  c: Combatant
  character: Character | undefined
  active: boolean
  open: boolean
  onToggle: () => void
  onInitiative: (total: number, how: string) => void
  /** Change this combatant, starting from its newest saved state. */
  onUpdate: (fn: (latest: Combatant) => MonsterResult) => void
  /** Change the linked PC sheet, starting from its newest saved state. */
  onCharacter: (fn: (latest: Character) => ActionResult) => void
  onRemove: () => void
}) {
  const [amount, setAmount] = useState('')
  const [initText, setInitText] = useState('')
  const [effectName, setEffectName] = useState<string>('Prone')
  const [customEffect, setCustomEffect] = useState('')
  const [rounds, setRounds] = useState('')
  const [ends, setEnds] = useState<'start' | 'end'>('end')
  const [confirmRemove, setConfirmRemove] = useState(false)

  const isPc = c.kind === 'pc'
  const missing = isPc && !character
  // A PC's HP and Concentration are read from the linked sheet.
  const hp = isPc && character ? character.hp : c.hp
  const concentration = isPc && character ? character.concentration : c.concentration
  const value = Math.max(0, Math.floor(Number(amount) || 0))
  const down = hp.current === 0
  const pct = Math.round((hp.current / Math.max(1, hp.max)) * 100)
  const dead = isPc && character ? isDead(character) : false
  // A PC's initiative bonus follows its sheet (Alert, DEX, Exhaustion can change).
  const initBonus = isPc && character ? deriveSheet(character).initiative : c.initBonus
  const same = (combatant: Combatant, text = ''): MonsterResult => ({ combatant, text })

  function damage() {
    if (!value) return
    if (isPc && character) onCharacter((ch) => damageCharacter(ch, value))
    else onUpdate((m) => damageMonster(m, value))
    setAmount('')
  }

  function healing() {
    if (!value) return
    if (isPc && character) onCharacter((ch) => healCharacter(ch, value))
    else onUpdate((m) => healMonster(m, value))
    setAmount('')
  }

  function temp() {
    if (!value) return
    if (isPc && character) onCharacter((ch) => tempHpCharacter(ch, value))
    else onUpdate((m) => tempHpMonster(m, value))
    setAmount('')
  }

  function addTimedEffect() {
    const name = effectName === '__custom' ? customEffect.trim() : effectName
    if (!name) return
    const n = Number(rounds)
    const r = Number.isInteger(n) && n > 0 ? n : null
    const text = `${c.name}: ${name}${r ? ` ${r} รอบ (นับ${ends === 'start' ? 'ต้น' : 'ท้าย'}เทิร์น)` : ''}`
    onUpdate((m) => same(addEffect(m, name, r, ends), `🌀 ${text}`))
    // A PC's conditions also show on its sheet.
    if (isPc && character && isConditionName(name)) {
      onCharacter((ch) => ({
        character: ch.conditions.includes(name) ? ch : { ...ch, conditions: [...ch.conditions, name] },
        text: `ติด ${name} (${CONDITION_TH[name]})`,
      }))
    }
    setRounds('')
    setCustomEffect('')
  }

  function dropEffect(effectId: string, name: string) {
    const removed = c.effects.filter((e) => e.id === effectId)
    const remaining = c.effects.filter((e) => e.id !== effectId)
    onUpdate((m) => same(removeEffect(m, effectId), `${c.name}: ${name} หมดผล`))
    // Take it off the sheet too, unless another effect still applies the same condition.
    const clear = conditionsToClear(removed, remaining)
    if (isPc && character && clear.length) {
      onCharacter((ch) => ({ character: { ...ch, conditions: ch.conditions.filter((x) => !clear.includes(x)) }, text: `หาย ${name}` }))
    }
  }

  function deathSave(d20: number, manual: boolean) {
    onCharacter((ch) => deathSaveCharacter(ch, d20, manual))
  }

  function setConcentration(text: string) {
    const line = text ? `🔮 ${c.name} Concentration: ${text}` : `🔮 ${c.name} เลิก Concentration`
    if (isPc && character) onCharacter((ch) => ({ character: { ...ch, concentration: text }, text: line }))
    else onUpdate((m) => same({ ...m, concentration: text }, line))
  }

  const manualInit = Number(initText)
  const manualOk = initText.trim() !== '' && Number.isInteger(manualInit) && manualInit >= -10 && manualInit <= 50

  return (
    <div className={`rounded-xl border-2 ${active ? 'border-amber-400 bg-stone-800' : 'border-transparent bg-stone-800/70'} ${c.defeated ? 'opacity-50' : ''}`}>
      <button type="button" onClick={onToggle} className="flex w-full items-center gap-3 p-3 text-left">
        <div className="w-10 text-center">
          <div className="text-xl font-bold">{c.initiative ?? '–'}</div>
          <div className="text-[10px] text-stone-500">INIT</div>
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="truncate font-bold">{active && '▶ '}{isPc ? '🧑' : '👹'} {c.name}</span>
            {(c.defeated || dead) && <span className="text-xs">☠️</span>}
          </div>
          <div className="mt-1 h-2 overflow-hidden rounded bg-stone-900">
            <div className={`h-full ${pct > 50 ? 'bg-emerald-500' : pct > 25 ? 'bg-amber-500' : 'bg-red-500'}`} style={{ width: `${pct}%` }} />
          </div>
          <div className="mt-1 flex flex-wrap gap-1">
            {c.effects.map((ef) => (
              <span key={ef.id} className="rounded-full bg-red-900 px-2 text-xs">{ef.name}{ef.rounds !== null && ` (${ef.rounds})`}</span>
            ))}
            {concentration && <span className="rounded-full bg-violet-900 px-2 text-xs">🔮 {concentration}</span>}
          </div>
        </div>
        <div className="text-right text-sm">
          <div className="font-bold">{hp.current}/{hp.max}{hp.temp > 0 && <span className="text-sky-300"> +{hp.temp}</span>}</div>
          <div className="text-stone-400">AC {isPc && character ? character.ac : c.ac}</div>
        </div>
      </button>

      {/* Initiative entry: roll in the app, or type the total the player rolled at the table. */}
      {c.initiative === null && (
        <div className="flex gap-2 px-3 pb-3">
          <Button variant="primary" className="flex-1 whitespace-nowrap px-2" onClick={() => {
            const r = rollInitiative(initBonus)
            onInitiative(r.total, r.how)
          }}>
            🎲 Initiative (d20{formatModifier(initBonus)})
          </Button>
          <input
            className="w-20 rounded-lg border border-stone-600 bg-stone-900 px-2 text-center text-base"
            inputMode="numeric"
            placeholder="รวม"
            aria-label={`Initiative ที่ทอยได้ของ ${c.name}`}
            value={initText}
            onChange={(e) => setInitText(e.target.value.replace(/[^\d-]/g, ''))}
          />
          <Button className={`px-3 ${manualOk ? '' : 'opacity-40'}`} onClick={() => manualOk && onInitiative(manualInit, 'ทอยเอง')}>ตั้ง</Button>
        </div>
      )}

      {open && (
        <div className="space-y-3 border-t border-stone-700 p-3">
          {missing && <p className="text-sm text-red-300">ไม่พบใบตัวละครนี้ในเครื่องแล้ว</p>}

          {/* HP */}
          <div className="flex gap-2">
            <input
              className="w-16 rounded-lg border border-stone-600 bg-stone-900 px-2 py-2 text-center text-base"
              inputMode="numeric"
              placeholder="0"
              value={amount}
              onChange={(e) => setAmount(e.target.value.replace(/\D/g, ''))}
            />
            <Button variant="danger" className="flex-1 whitespace-nowrap px-2" onClick={damage}>− ดาเมจ</Button>
            <Button className="flex-1 whitespace-nowrap bg-emerald-800 px-2 hover:bg-emerald-700" onClick={healing}>+ ฮีล</Button>
            <Button className="whitespace-nowrap px-2" onClick={temp}>Temp</Button>
          </div>

          {/* A PC at 0 HP rolls death saves (the DM can record them here too). */}
          {dead && character && (
            <div className="flex items-center gap-2 rounded-lg bg-red-950/60 p-2 text-sm">
              <span className="flex-1">💀 ตายแล้ว (Death Save ล้มเหลว 3 ครั้ง)</span>
              <Button className="text-sm" onClick={() => onCharacter(reviveCharacter)}>✨ ชุบชีวิต (1 HP)</Button>
            </div>
          )}
          {isPc && character && down && character.deathSaves.failures < 3 && character.deathSaves.successes < 3 && (
            <div className="rounded-lg bg-red-950/60 p-2">
              <div className="mb-1 text-sm">
                Death Saves · สำเร็จ {'●'.repeat(character.deathSaves.successes)}{'○'.repeat(3 - character.deathSaves.successes)}
                {' '}· ล้มเหลว {'●'.repeat(character.deathSaves.failures)}{'○'.repeat(3 - character.deathSaves.failures)}
              </div>
              <DiceRoll sides={20} label="Death Save" onRoll={deathSave} />
            </div>
          )}

          {/* Effects with durations */}
          <div className="space-y-2">
            <div className="flex flex-wrap gap-1">
              {c.effects.map((ef) => (
                <button key={ef.id} type="button" onClick={() => dropEffect(ef.id, ef.name)} className="rounded-full border border-red-400 bg-red-900 px-2 py-0.5 text-xs">
                  {ef.name}{ef.rounds !== null ? ` · เหลือ ${ef.rounds}` : ''} ✕
                </button>
              ))}
            </div>
            <div className="flex flex-wrap gap-2">
              <select className="rounded-lg border border-stone-600 bg-stone-900 px-2 py-1 text-base" value={effectName} onChange={(e) => setEffectName(e.target.value)}>
                {CONDITION_LIST.map((x) => <option key={x} value={x}>{x} ({CONDITION_TH[x]})</option>)}
                <option value="__custom">อื่นๆ (เช่น Bless, Hold Person)…</option>
              </select>
              {effectName === '__custom' && (
                <input className="min-w-0 flex-1 rounded-lg border border-stone-600 bg-stone-900 px-2 text-base" placeholder="ชื่อ" value={customEffect} onChange={(e) => setCustomEffect(e.target.value)} />
              )}
              <input
                className="w-16 rounded-lg border border-stone-600 bg-stone-900 px-2 text-center text-base"
                inputMode="numeric"
                placeholder="∞"
                aria-label="จำนวนเทิร์น"
                value={rounds}
                onChange={(e) => setRounds(e.target.value.replace(/\D/g, ''))}
              />
              <select className="rounded-lg border border-stone-600 bg-stone-900 px-2 py-1 text-base" value={ends} onChange={(e) => setEnds(e.target.value as 'start' | 'end')}>
                <option value="end">นับท้ายเทิร์น</option>
                <option value="start">นับต้นเทิร์น</option>
              </select>
              <Button className="px-3" onClick={addTimedEffect}>+ เพิ่ม</Button>
            </div>
            <p className="text-xs text-stone-500">
              รอบ = จำนวนเทิร์นของตัวนี้ (เว้นว่าง = จนกว่าจะเอาออก) · "จนจบเทิร์นถัดไป" = 1 รอบ นับท้ายเทิร์น
              {active && ' · ตอนนี้เป็นเทิร์นของตัวนี้: เทิร์นนี้นับด้วย ให้ใส่ +1 รอบ'}
            </p>
          </div>

          {/* Concentration */}
          <div className="flex items-center gap-2">
            <span className="text-sm text-stone-400">🔮</span>
            <input
              // key: show the new value when Concentration changes elsewhere (e.g. dropped at 0 HP).
              key={concentration}
              className="min-w-0 flex-1 rounded-lg border border-stone-600 bg-stone-900 px-2 py-1 text-base"
              placeholder="Concentration (ชื่อคาถา)"
              defaultValue={concentration}
              onBlur={(e) => e.target.value !== concentration && setConcentration(e.target.value.trim())}
            />
          </div>

          {/* Order and removal */}
          <div className="flex flex-wrap items-center gap-2 text-sm">
            {c.initiative !== null && !active && (
              <>
                <span className="text-stone-400">ลำดับเมื่อเสมอ</span>
                <button type="button" className="h-8 w-8 rounded bg-stone-700" onClick={() => onUpdate((m) => same({ ...m, tieBreak: m.tieBreak + 1 }))}>▲</button>
                <button type="button" className="h-8 w-8 rounded bg-stone-700" onClick={() => onUpdate((m) => same({ ...m, tieBreak: m.tieBreak - 1 }))}>▼</button>
                <button type="button" className="rounded bg-stone-700 px-2 py-1" onClick={() => onUpdate((m) => same({ ...m, initiative: null }, `${c.name}: ทอย Initiative ใหม่`))}>ทอยใหม่</button>
              </>
            )}
            {c.initiative !== null && active && <span className="text-xs text-stone-500">ย้ายลำดับ/ทอยใหม่ได้เมื่อไม่ใช่เทิร์นของตัวนี้</span>}
            {!isPc && (
              <button type="button" className="rounded bg-stone-700 px-2 py-1" onClick={() => onUpdate((m) => same({ ...m, defeated: !m.defeated }, m.defeated ? `${c.name} กลับเข้าสู่การต่อสู้` : `☠️ ${c.name} ออกจากการต่อสู้ (ล้ม/หนี)`))}>
                {c.defeated ? 'กลับเข้าต่อสู้' : '☠️ ล้ม/หนี'}
              </button>
            )}
            {isPc && character && <a href={`#/c/${character.id}`} className="rounded bg-stone-700 px-2 py-1">ดูใบตัวละคร</a>}
            <button type="button" className="ml-auto text-red-400" onClick={() => setConfirmRemove(!confirmRemove)}>เอาออก</button>
            {confirmRemove && <Button variant="danger" className="text-sm" onClick={onRemove}>ยืนยันเอาออก</Button>}
          </div>
        </div>
      )}
    </div>
  )
}
