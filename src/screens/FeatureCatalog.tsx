// Limited-use features on the sheet's play panel: "+ จาก SRD" picks from the features this character
// qualifies for (class, subclass, level, species, feats), like adding spells. Tapping a feature's name
// opens its card: what it does, the SRD text (English), and a "ใช้" button that spends a use and the
// Action / Bonus Action it takes, then offers its dice in the roller (Second Wind, Breath Weapon…).
import { useState } from 'react'
import { useLobby } from '../app/useLobby'
import { updateCharacter } from '../db/characters'
import type { Character } from '../model/character'
import { addCatalogFeature, featureDetails, featuresToAdd, planFeatureUse, usesLabel } from '../model/featureCatalog'
import { Button } from '../ui/kit'
import { openRoller } from '../ui/rollerBus'
import { useCharacterAct } from './useCharacterAct'
import { findFeatureText, type SrdFeatureTexts } from '../model/featureTexts'

/** "+ จาก SRD": add catalog features to the sheet (one tap each, or all at once). */
export function FeaturePicker({ c, onClose }: { c: Character; onClose: () => void }) {
  const lobby = useLobby()
  const list = featuresToAdd(c)

  async function add(ids: string[]) {
    await updateCharacter(c.id, (latest) => {
      let next = latest
      for (const f of featuresToAdd(latest)) if (ids.includes(f.id)) next = addCatalogFeature(next, f)
      return { character: next, text: '' }
    })
    lobby.shareSheet(c.id)
  }

  return (
    <div className="mb-2 space-y-2 rounded-lg bg-stone-900 p-3">
      {list.length === 0 ? (
        <p className="text-sm text-stone-400">มีครบแล้ว (ตาม Class {c.className} Level {c.level}{c.subclass ? `, ${c.subclass}` : ''}{c.species ? `, ${c.species}` : ''}) · ความสามารถอื่นเพิ่มเองได้ในหน้าแก้ไข</p>
      ) : (
        <>
          <ul className="space-y-1">
            {list.map((f) => (
              <li key={f.id} className="flex items-center justify-between gap-2 rounded bg-stone-800 px-2 py-1 text-sm">
                <span className="min-w-0">
                  <span className="font-bold">{f.name}</span>
                  <span className="block text-xs text-stone-400">{usesLabel(c, f)} · {f.activation}</span>
                </span>
                <Button className="px-3 py-1 text-sm" onClick={() => add([f.id])}>+ เพิ่ม</Button>
              </li>
            ))}
          </ul>
          {list.length > 1 && <Button className="w-full text-sm" onClick={() => add(list.map((f) => f.id))}>+ เพิ่มทั้งหมด ({list.length})</Button>}
        </>
      )}
      <button type="button" className="text-xs text-stone-400 underline" onClick={onClose}>ปิด</button>
    </div>
  )
}

/** A feature's card: summary, SRD text, and the use button (with its dice). */
export function FeatureCard({ c, featureId, texts }: { c: Character; featureId: string; texts: SrdFeatureTexts | null }) {
  const { act } = useCharacterAct(c)
  const [amount, setAmount] = useState('1')
  const [note, setNote] = useState('')
  const [showText, setShowText] = useState(false)
  const x = c.features.find((f) => f.id === featureId)
  if (!x) return null
  const details = featureDetails(c, x.srdId)
  const plan = planFeatureUse(c, featureId, Number(amount) || 1)
  const textId = details?.feature.textId ?? x.srdId
  const text = textId ? findFeatureText(texts, textId) : null

  async function use() {
    if (plan.error) return setNote(plan.error)
    for (const action of plan.actions) {
      const r = await act(action)
      if (r.refused) return setNote(`🔒 ${r.refused}`)
    }
    setNote(`✓ ใช้ ${x!.name} แล้ว${plan.warnings.length ? ` · ${plan.warnings.join(' · ')}` : ''}`)
    if (!details?.roll) return
    const { expression, label, applies } = details.roll
    // Second Wind and the like: the roll's total goes straight onto this sheet (healing / Temp HP).
    openRoller({
      expression,
      label,
      ...(applies && {
        resultHint: applies === 'heal' ? 'ผลรวมจะฮีลให้ตัวละครนี้อัตโนมัติ' : 'ผลรวมจะเป็น Temp HP ของตัวละครนี้อัตโนมัติ',
        // "Minimum of 1" (Wholeness of Body, Tireless with a low WIS).
        onResult: (total: number) => void act(applies === 'heal' ? { type: 'heal', amount: Math.max(1, total) } : { type: 'tempHp', amount: Math.max(1, total) }),
      }),
    })
  }

  return (
    <div className="mt-1 mb-2 space-y-2 rounded-lg bg-amber-950/40 p-2 text-sm">
      {details ? (
        <>
          <p className="text-xs text-stone-400">{details.feature.activation} · {usesLabel(c, details.feature)}</p>
          <p className="text-stone-200">{details.summary}</p>
        </>
      ) : (
        <p className="text-xs text-stone-400">ความสามารถที่ใส่เอง (ไม่มีใน SRD)</p>
      )}
      <div className="flex flex-wrap items-center gap-2">
        {x.pool && (
          <input
            className="w-16 rounded-lg border border-stone-600 bg-stone-900 px-2 py-1 text-center text-base"
            inputMode="numeric"
            aria-label={`จำนวนแต้ม ${x.name}`}
            value={amount}
            onChange={(e) => setAmount(e.target.value.replace(/\D/g, '').slice(0, 3))}
          />
        )}
        <Button variant="primary" className={`px-4 py-1.5 ${plan.error ? 'opacity-40' : ''}`} onClick={use}>
          ใช้{x.pool ? ` ${Number(amount) || 1} แต้ม` : ''}{details?.roll ? ` + ทอย ${details.roll.expression}` : ''}
        </Button>
        {details?.roll && (
          <button type="button" className="text-xs text-stone-400 underline" onClick={() => openRoller({ expression: details.roll!.expression, label: details.roll!.label })}>
            ทอยอย่างเดียว
          </button>
        )}
      </div>
      {plan.warnings.length > 0 && !note && <p className="text-xs text-amber-300">⚠️ {plan.warnings.join(' · ')}</p>}
      {note && <p className="text-xs text-emerald-300">{note}</p>}
      {text && (
        <div>
          <button type="button" className="text-xs text-amber-400 underline" onClick={() => setShowText(!showText)}>
            {showText ? 'ซ่อนคำอธิบาย' : 'อ่านคำอธิบายเต็ม (SRD, English)'}
          </button>
          {showText && <FormattedText text={text} />}
        </div>
      )}
    </div>
  )
}

/** SRD text with **bold** run-in headings, one paragraph per line. */
export function FormattedText({ text }: { text: string }) {
  return (
    <div className="mt-1 space-y-1 text-stone-300">
      {text.split('\n').map((line, i) => (
        <p key={i}>
          {line.split(/(\*\*[^*]+\*\*)/).map((part, j) => (part.startsWith('**') ? <b key={j}>{part.slice(2, -2)}</b> : part))}
        </p>
      ))}
    </div>
  )
}
