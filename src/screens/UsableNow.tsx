// "ใช้ได้เลย" (usable now): the top of the sheet's combat tab. Everything a player reaches for during a
// fight in one place: Action / Bonus Action / Reaction, attacks, spell slots left, limited-use features by
// rest, spells by Action / Bonus Action / Reaction, and the 18 skills (tap to roll). Jump chips at the top
// reach each block in one tap. Grouping lives in model/usableNow.ts; every tap goes through the same
// checked actions as before (useCharacterAct) and every roll through the floating dice roller.
import { useState } from 'react'
import type { SuggestionKind } from '../model/actionSuggestions'
import { isDead } from '../model/actions'
import type { Character } from '../model/character'
import type { CharacterAction } from '../model/characterActions'
import { equippedWeapons } from '../model/inventory'
import { featureGroups, skillCells, slotRows, spellGroups, type SpellGroupKind, type SpellRow } from '../model/usableNow'
import { featuresToAdd } from '../model/featureCatalog'
import { formatModifier, MAX_FEATURE_USES, spellSlotsFor, type DerivedAttack, type Skill } from '../rules'
import { Term } from '../ui/help'
import { ABILITY_LABEL, RECHARGE_LABEL } from '../ui/labels'
import { openRoller } from '../ui/rollerBus'
import { ActionEconomyBar, Button, DiceRoll, Section } from '../ui/kit'
import ActionChoiceDialog from './ActionChoiceDialog'
import Attacks from './Attacks'
import { FeatureCard, FeaturePicker } from './FeatureCatalog'
import { CastPanel } from './SpellList'
import { useCharacterAct } from './useCharacterAct'
import { useEquipment, useFeatureTexts, useSpells } from './useSrdData'

const SLOT_LABEL = ['1st', '2nd', '3rd', '4th', '5th', '6th', '7th', '8th', '9th']
const GROUP_TITLE: Record<SpellGroupKind, string> = { action: 'Action', bonusAction: 'Bonus Action', reaction: 'Reaction', other: 'อื่นๆ (ใช้เวลานาน)' }

/** One tap = one use: tap a full pip to spend one, an empty pip to give one back (never several at once). */
const tapPip = (used: number, i: number) => (i < used ? used - 1 : used + 1)

/** A round pip with a 44 px touch area around the 28 px circle. */
function Pip({ label, full, color, square, disabled, onClick }: { label: string; full: boolean; color: 'violet' | 'amber'; square?: boolean; disabled?: boolean; onClick: () => void }) {
  const tone = color === 'violet' ? `border-violet-400 ${full ? 'bg-violet-500' : 'bg-transparent'}` : `border-amber-400 ${full ? 'bg-amber-500' : 'bg-transparent'}`
  return (
    <button type="button" aria-label={label} disabled={disabled} onClick={onClick} className="flex h-11 w-11 shrink-0 items-center justify-center disabled:cursor-not-allowed">
      <span className={`h-7 w-7 border-2 ${square ? 'rounded' : 'rounded-full'} ${tone}`} />
    </button>
  )
}

/** Death saves: shown above everything at 0 HP (urgent). */
export function DeathSaves({ c }: { c: Character }) {
  const { act } = useCharacterAct(c)
  const [message, setMessage] = useState('')
  if (c.hp.current !== 0) return null
  const dead = isDead(c)
  const stable = c.deathSaves.successes >= 3
  const run = async (action: CharacterAction) => {
    const r = await act(action)
    setMessage(r.refused ? `🔒 ${r.refused}` : r.text ?? '')
  }
  return (
    <div className="rounded-xl bg-red-950/60 p-4">
      <div className="mb-2 font-bold text-red-300">{dead ? '💀 ตายแล้ว' : stable ? <Term name="Stable">อาการคงที่ (Stable)</Term> : <Term name="Death Save">Death Saves (DC 10)</Term>}</div>
      {dead && <Button className="mb-2 w-full" onClick={() => run({ type: 'revive' })}>✨ ชุบชีวิต (เช่น Revivify): กลับมาที่ 1 HP</Button>}
      <div className="flex justify-between text-sm">
        <span>สำเร็จ {'●'.repeat(c.deathSaves.successes)}{'○'.repeat(3 - c.deathSaves.successes)}</span>
        <span>ล้มเหลว {'●'.repeat(c.deathSaves.failures)}{'○'.repeat(3 - c.deathSaves.failures)}</span>
      </div>
      {!dead && !stable && <div className="mt-2"><DiceRoll sides={20} label="Death Save" onRoll={(d20, manual) => run({ type: 'deathSave', d20, manual })} /></div>}
      {message && <p className="mt-2 text-sm text-amber-200">{message}</p>}
    </div>
  )
}

export default function UsableNow({ c, manualAttacks, skillBonuses }: { c: Character; manualAttacks: DerivedAttack[]; skillBonuses: Record<Skill, number> }) {
  const { act: apply, asPlayer, waitingForTurn } = useCharacterAct(c)
  const [message, setMessage] = useState('')
  const [pending, setPending] = useState<SuggestionKind | null>(null)
  const [picking, setPicking] = useState(false)
  const [openFeature, setOpenFeature] = useState<string | null>(null)
  const [casting, setCasting] = useState<string | null>(null)
  const featureTexts = useFeatureTexts()
  const srd = useSpells()
  const equipment = useEquipment()

  const act = async (action: CharacterAction) => {
    const { text, refused } = await apply(action)
    setMessage(refused ? `🔒 ${refused}` : text ?? '')
  }

  const slots = slotRows(c)
  // Characters made before slots existed have none set; offer the class table in one tap.
  const slotsMissing = slots.length === 0 && spellSlotsFor(c.className, c.level).some((n) => n > 0)
  const features = featureGroups(c.features)
  const canAddFeatures = featuresToAdd(c).length > 0
  const spells = spellGroups(c, srd)
  const hasAttacks = manualAttacks.length > 0 || (!!equipment && equippedWeapons(c, equipment).length > 0)
  const skills = skillCells(c, skillBonuses)

  const chips = [
    hasAttacks && { id: 'un-attacks', label: 'โจมตี' },
    (slots.length > 0 || slotsMissing) && { id: 'un-slots', label: `ช่อง ${slots.reduce((n, r) => n + r.left, 0)}` },
    (features.length > 0 || canAddFeatures) && { id: 'un-features', label: `พลัง ${c.features.length}` },
    spells.length > 0 && { id: 'un-spells', label: `คาถา ${c.spells.length}` },
    { id: 'un-skills', label: 'Skills 18' },
  ].filter((x): x is { id: string; label: string } => !!x)

  return (
    <>
      <Section title="ใช้ได้เลย">
        {message && <p className="mb-2 rounded-lg bg-stone-900 p-2 text-sm text-amber-200">{message}</p>}
        {/* Action economy for this turn (the combat tracker resets it automatically) */}
        <div className="flex items-center gap-2">
          <div className="min-w-0 flex-1">
            <ActionEconomyBar
              economy={c.turn}
              // Using one asks what for (then logs it); tapping a used one gives it back (not for players in a room).
              onToggle={(kind) => {
                if (c.turn[kind]) return act({ type: 'setActionUsed', kind, used: false })
                if (waitingForTurn && kind !== 'reaction') return setMessage('🔒 ใช้ Action / Bonus Action ได้เฉพาะตาของตัวเอง (Reaction ใช้ได้ตลอด)')
                setPending(kind)
              }}
              locked={waitingForTurn ? ['action', 'bonusAction'] : []}
            />
          </div>
          {!asPlayer && (
            <Button className="whitespace-nowrap px-2 text-sm" onClick={() => act({ type: 'resetTurn' })}>
              ↻ เทิร์นใหม่
            </Button>
          )}
        </div>
        <nav aria-label="ไปที่" className="mt-3 flex flex-wrap items-center gap-1.5">
          <span className="text-xs text-stone-400">ไปที่</span>
          {chips.map((x) => (
            <button
              key={x.id}
              type="button"
              className="min-h-11 rounded-full border border-stone-500 px-3 text-sm text-stone-200"
              onClick={() => document.getElementById(x.id)?.scrollIntoView({ block: 'start' })}
            >
              {x.label}
            </button>
          ))}
        </nav>
      </Section>

      {hasAttacks && <div id="un-attacks" className="scroll-mt-32"><Attacks c={c} manual={manualAttacks} /></div>}

      {(slots.length > 0 || slotsMissing) && (
        <div id="un-slots" className="scroll-mt-32">
          <Section title="ช่องคาถาที่เหลือ (Spell Slots)">
            {slotsMissing && (
              <div className="rounded-lg bg-stone-900 p-3 text-sm">
                <p className="mb-2 text-stone-400">Spell Slots ยังไม่ได้ตั้ง</p>
                <Button className="w-full" onClick={() => act({ type: 'setSlotsFromTable' })}>
                  ✨ ตั้ง Spell Slots ตามตาราง {c.className} {c.level}
                </Button>
              </div>
            )}
            {slots.length > 0 && (
              <>
                <p className="mb-1 text-xs text-stone-400">{c.className === 'Warlock' ? 'Pact Magic: คืนเมื่อพักสั้น · ' : ''}{asPlayer ? 'แตะวงกลมเพื่อใช้ (DM เป็นคนคืน)' : 'แตะวงกลมเพื่อใช้/คืน'}</p>
                {slots.map((s) => (
                  <div key={s.level} className={`flex flex-wrap items-center ${s.spent ? 'opacity-60' : ''}`}>
                    <span className="w-9 text-sm">{SLOT_LABEL[s.level - 1]}</span>
                    <span className={`w-10 text-sm font-bold ${s.spent ? 'text-stone-400' : 'text-violet-200'}`}>{s.left}/{s.max}</span>
                    {Array.from({ length: s.max }, (_, i) => (
                      <Pip key={i} color="violet" label={`${SLOT_LABEL[s.level - 1]} slot ${i + 1}`} full={i >= s.used}
                        // A player in a room can't give a slot back: the DM does that.
                        disabled={asPlayer && i >= s.used}
                        onClick={() => act({ type: 'setSlotUsed', level: s.level - 1, used: tapPip(s.used, i) })} />
                    ))}
                    {s.spent && <span className="text-xs text-stone-400">หมด · คืนเมื่อ {c.className === 'Warlock' ? 'Short/Long Rest' : 'Long Rest'}</span>}
                  </div>
                ))}
              </>
            )}
          </Section>
        </div>
      )}

      {(features.length > 0 || canAddFeatures) && (
        <div id="un-features" className="scroll-mt-32">
          <Section
            title="ความสามารถที่ใช้ได้จำกัด"
            action={canAddFeatures && !picking ? <Button className="min-h-11 shrink-0 px-2 py-1 text-xs" onClick={() => setPicking(true)}>+ จาก SRD</Button> : undefined}
          >
            {picking && <FeaturePicker c={c} onClose={() => setPicking(false)} />}
            <p className="mb-1 text-xs text-stone-400">เหลือ/ทั้งหมด · แตะชื่อเพื่อดูรายละเอียด{asPlayer ? ' · DM เป็นคนคืน' : ''}</p>
            {features.map((g) => (
              <div key={g.recharge} className="mt-2">
                <div className="text-xs font-bold text-amber-400">{g.recharge === 'short' ? 'คืนเมื่อ Short Rest' : 'คืนเมื่อ Long Rest'}</div>
                {g.items.map(({ feature: f, left, spent }) => (
                  <div key={f.id} className={spent ? 'opacity-50' : ''}>
                    <div className="flex flex-wrap items-center gap-x-2">
                      <button type="button" className="min-h-11 min-w-24 text-left text-sm underline decoration-stone-600 underline-offset-4" onClick={() => setOpenFeature(openFeature === f.id ? null : f.id)}>
                        {f.name}
                      </button>
                      <span className="text-sm font-bold text-amber-300">{left}/{f.max}</span>
                      {f.pool || f.max > 10 ? (
                        <PoolControls f={f} left={left} canGiveBack={!asPlayer} onSet={(used) => act({ type: 'setFeatureUsed', featureId: f.id, used })} />
                      ) : (
                        Array.from({ length: f.max }, (_, i) => (
                          <Pip key={i} color="amber" square label={`${f.name} ${i + 1}`} full={i >= f.used}
                            disabled={asPlayer && i >= f.used}
                            onClick={() => act({ type: 'setFeatureUsed', featureId: f.id, used: tapPip(f.used, i) })} />
                        ))
                      )}
                    </div>
                    {/* Used up: say when it comes back. */}
                    {spent && <p className="-mt-1 mb-1 text-xs text-stone-300">หมดแล้ว · {RECHARGE_LABEL[f.recharge]}</p>}
                    {!spent && f.recharge === 'shortOne' && <p className="-mt-1 mb-1 text-xs text-stone-400">{RECHARGE_LABEL[f.recharge]}</p>}
                    {openFeature === f.id && <FeatureCard c={c} featureId={f.id} texts={featureTexts} />}
                  </div>
                ))}
              </div>
            ))}
          </Section>
        </div>
      )}

      {spells.length > 0 && (
        <div id="un-spells" className="scroll-mt-32">
          <Section title="คาถาที่ใช้ได้">
            <p className="mb-1 text-xs text-stone-400">★ เตรียมไว้แล้ว · สีเทา = ไม่มี Slot เหลือ · แตะ "ร่าย" เพื่อเลือก Slot</p>
            {!srd && <p className="min-h-6 text-xs text-stone-400">กำลังโหลดเวลาร่ายของคาถา…</p>}
            {spells.map((g) => (
              <div key={g.kind} className="mt-2">
                <div className="text-xs font-bold text-amber-400">{GROUP_TITLE[g.kind]}</div>
                {g.items.map((row) => (
                  <SpellLine key={row.spell.id} c={c} row={row} open={casting === row.spell.id}
                    onToggle={() => setCasting(casting === row.spell.id ? null : row.spell.id)}
                    onDone={(note) => { setCasting(null); if (note) setMessage(note) }} />
                ))}
              </div>
            ))}
          </Section>
        </div>
      )}

      <div id="un-skills" className="scroll-mt-32">
        <Section title="Skills (แตะเพื่อทอย d20)">
          <p className="mb-2 text-xs text-stone-400">● ถนัด · ★ Expertise · ตัวเลขรวม Proficiency และ Exhaustion แล้ว · ดูว่า Skill ใช้ทำอะไรได้ที่แท็บ ความสามารถ</p>
          <ul className="grid grid-cols-1 gap-x-3 min-[360px]:grid-cols-2">
            {skills.map((s) => {
              const mark = s.level === 'expertise' ? '★' : s.level === 'proficient' ? '●' : ''
              const levelText = s.level === 'expertise' ? ' Expertise' : s.level === 'proficient' ? ' ถนัด' : ''
              return (
                <li key={s.skill}>
                  <button
                    type="button"
                    aria-label={`${s.skill} ${formatModifier(s.bonus)}${levelText} ทอย d20`}
                    onClick={() => openRoller({ expression: s.bonus === 0 ? '1d20' : `1d20${formatModifier(s.bonus)}`, label: s.skill })}
                    className="flex min-h-11 w-full items-center gap-1.5 border-b border-stone-700/60 py-1 text-left"
                  >
                    <span className={`w-10 shrink-0 rounded-md py-1 text-center text-sm font-bold ${s.level === 'none' ? 'bg-stone-700 text-stone-100' : 'bg-amber-700 text-amber-50'}`}>{formatModifier(s.bonus)}</span>
                    <span className="w-3 shrink-0 text-xs text-amber-300" aria-hidden="true">{mark}</span>
                    <span className="min-w-0 text-sm leading-tight">
                      {s.skill} <span className="text-[11px] text-stone-400">{ABILITY_LABEL[s.ability].short}</span>
                    </span>
                  </button>
                </li>
              )
            })}
          </ul>
        </Section>
      </div>

      {pending && (
        <ActionChoiceDialog
          kind={pending}
          character={c}
          title={`⚡ ใช้ ${pending === 'action' ? 'Action' : pending === 'bonusAction' ? 'Bonus Action' : 'Reaction'} ทำอะไร?`}
          placeholder="เลือกด้านบน หรือพิมพ์เอง (เว้นว่างได้)"
          required={false}
          onCancel={() => setPending(null)}
          onConfirm={(detail) => {
            act({ type: 'setActionUsed', kind: pending as 'action' | 'bonusAction' | 'reaction', used: true, detail })
            setPending(null)
          }}
        />
      )}
    </>
  )
}

/** One spell: ready mark, name, level and slot state, and the ร่าย button (opens the cast panel under the row). */
function SpellLine({ c, row, open, onToggle, onDone }: { c: Character; row: SpellRow; open: boolean; onToggle: () => void; onDone: (note?: string) => void }) {
  const { spell, info, ready, noSlot } = row
  const grey = noSlot
  return (
    <div className="border-b border-stone-700/60 py-0.5">
      <div className="flex items-center gap-2">
        <span className={`w-4 shrink-0 text-center ${ready ? 'text-amber-300' : 'text-stone-500'}`} aria-label={ready ? 'เตรียมไว้แล้ว' : 'ยังไม่ได้เตรียม'}>{ready ? '★' : '○'}</span>
        <span className={`min-w-0 flex-1 text-sm ${grey ? 'text-stone-400' : ''}`}>
          <b>{spell.name}</b>
          <span className="ml-1 text-xs text-stone-400">{spell.level === 0 ? 'Cantrip' : `L${spell.level}`}</span>
          {info?.concentration && <span className="ml-1 rounded bg-violet-900 px-1 text-xs text-violet-100">C</span>}
          {noSlot && <span className="block text-xs text-stone-400">ช่อง Level {spell.level} ขึ้นไปหมด</span>}
          {!ready && !noSlot && <span className="block text-xs text-stone-400">ยังไม่ได้เตรียม</span>}
        </span>
        <button
          type="button"
          aria-label={`ร่าย ${spell.name}`}
          aria-expanded={open}
          className={`min-h-11 min-w-11 shrink-0 rounded-lg px-2 text-sm font-bold ${open ? 'bg-violet-500 text-stone-900' : grey ? 'bg-stone-700 text-stone-300' : 'bg-violet-900 text-violet-100'}`}
          onClick={onToggle}
        >
          ร่าย
        </button>
      </div>
      {open && <CastPanel c={c} spell={spell} info={info} onDone={onDone} />}
    </div>
  )
}

/** Pool features (Lay On Hands, Focus Points…): spend any amount; the DM (or offline play) can give some back. */
function PoolControls({ f, left, canGiveBack, onSet }: { f: Character['features'][number]; left: number; canGiveBack: boolean; onSet: (used: number) => void }) {
  const [amount, setAmount] = useState('1')
  const n = Math.max(1, Math.min(MAX_FEATURE_USES, Number(amount) || 1))
  return (
    <>
      <input
        className="h-11 w-14 rounded-lg border border-stone-600 bg-stone-900 px-2 text-center text-base"
        inputMode="numeric"
        aria-label={`จำนวน ${f.name}`}
        value={amount}
        onChange={(e) => setAmount(e.target.value.replace(/\D/g, '').slice(0, 3))}
      />
      <Button className={`min-h-11 px-3 text-sm ${left < n ? 'opacity-40' : ''}`} onClick={() => left >= n && onSet(f.used + n)}>ใช้</Button>
      {canGiveBack && <Button className={`min-h-11 px-3 text-sm ${f.used < n ? 'opacity-40' : ''}`} onClick={() => f.used >= n && onSet(f.used - n)}>คืน</Button>}
    </>
  )
}
