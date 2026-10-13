// "⬆️ Level Up" on the sheet: one level at a time. HP (roll in the app, type real dice, or take the fixed value),
// the subclass at level 3, the new feat slot (Ability Score Improvement etc.), then confirm. Features that become
// available are added; spell slots, saves, AC follow. Nothing is saved until "ยืนยัน".
import { useState } from 'react'
import { useLobby } from '../app/useLobby'
import { updateCharacter } from '../db/characters'
import type { Character, FeatPick } from '../model/character'
import { setFeatPick } from '../model/feats'
import { applyAutoAC } from '../model/inventory'
import { finishLevelUp, hpGain, levelUpDraft, levelUpInfo } from '../model/levelUp'
import { CLASS_INFO } from '../rules'
import { Button, DiceRoll, Section, TextInput } from '../ui/kit'
import { FeatSlotsEditor } from './FeatSlots'
import { useEquipment, useFeatureTexts } from './useSrdData'

interface Choices {
  subclass: string
  picks: FeatPick[]
}

/** The draft for these choices, built on any copy of the character (the newest one when saving). */
function draftFor(c: Character, ch: Choices): Character {
  const base = { ...levelUpDraft(c), subclass: c.subclass.trim() ? c.subclass : ch.subclass }
  return ch.picks.reduce((d, p) => setFeatPick(d, p.slot, p.feat, p.increase), base)
}

export default function LevelUp({ c, onClose }: { c: Character; onClose: () => void }) {
  const lobby = useLobby()
  const texts = useFeatureTexts()
  const equipment = useEquipment()
  const [choices, setChoices] = useState<Choices>({ subclass: '', picks: [] })
  const [die, setDie] = useState<{ value: number; how: string } | null>(null)
  const draft = draftFor(c, choices)
  const info = levelUpInfo(c, draft, texts)
  const srdSubclass = CLASS_INFO[c.className].subclass

  async function confirm() {
    if (!die) return
    let text = ''
    await updateCharacter(c.id, (latest) => {
      let next = finishLevelUp(latest, draftFor(latest, choices), die.value)
      if (equipment) next = applyAutoAC(next, equipment)
      text = `⬆️ ${latest.name} ขึ้น Level ${next.level} (HP +${next.hp.max - latest.hp.max}, ${die.how})`
      return { character: next, text }
    })
    lobby.shareSheet(c.id)
    onClose()
  }

  return (
    <Section title={`⬆️ Level Up: ${c.className} ${c.level} → ${draft.level}`}>
      <div className="space-y-4 text-sm">
        <div>
          <p className="mb-1 font-bold">1. Hit Points (d{info.hitDie} + CON)</p>
          {die ? (
            <p className="rounded-lg bg-emerald-950 p-2">
              HP +{hpGain(c, draft, die.value)} ({die.how}) · Max HP {c.hp.max} → {c.hp.max + hpGain(c, draft, die.value)}
              <button type="button" className="ml-2 text-xs underline" onClick={() => setDie(null)}>เปลี่ยน</button>
            </p>
          ) : (
            <div className="space-y-2">
              <DiceRoll sides={info.hitDie} label="ทอย HP" onRoll={(v, manual) => setDie({ value: v, how: `${manual ? 'ทอยเอง' : '🎲'} ${v}` })} />
              <Button className="w-full" onClick={() => setDie({ value: info.fixed, how: `ค่าคงที่ ${info.fixed}` })}>ใช้ค่าคงที่ {info.fixed} (ไม่ทอย)</Button>
            </div>
          )}
        </div>

        {info.needsSubclass && (
          <div>
            <p className="mb-1 font-bold">2. Subclass</p>
            <div className="flex flex-wrap gap-2">
              <Button className={choices.subclass === srdSubclass ? 'ring-2 ring-amber-400' : ''} onClick={() => setChoices({ ...choices, subclass: srdSubclass })}>{srdSubclass} (SRD)</Button>
            </div>
            <div className="mt-2"><TextInput value={choices.subclass === srdSubclass ? '' : choices.subclass} placeholder="หรือพิมพ์ Subclass อื่น (เช่นจาก Player's Handbook)" onChange={(v) => setChoices({ ...choices, subclass: v })} /></div>
          </div>
        )}

        {info.newSlots.length > 0 && (
          <div>
            <p className="mb-1 font-bold">{info.needsSubclass ? '3' : '2'}. Feat</p>
            <FeatSlotsEditor
              c={draft}
              only={info.newSlots.map((s) => s.id)}
              onChange={(next) => setChoices({ ...choices, picks: (next.featPicks ?? []).filter((p) => info.newSlots.some((s) => s.id === p.slot)) })}
            />
          </div>
        )}

        <div className="rounded-lg bg-stone-900 p-2">
          <p className="font-bold">Level {draft.level} ได้อะไรบ้าง</p>
          <ul className="mt-1 list-inside list-disc text-stone-300">
            {info.newFeatures.map((f) => <li key={f}>{f}</li>)}
            {info.slotsChanged && <li>Spell Slots ตามตาราง {c.className} {draft.level}</li>}
            {info.expertiseGain > 0 && <li>Expertise เพิ่ม {info.expertiseGain} อย่าง: เลือกในหน้าแก้ไข (Skills)</li>}
            <li>Proficiency Bonus +{Math.ceil(draft.level / 4) + 1}, Hit Dice {draft.level}</li>
          </ul>
          <p className="mt-1 text-xs text-stone-500">ความสามารถที่ใช้ได้จำกัด (เช่น Action Surge) จะถูกเพิ่มให้ · อ่านรายละเอียดได้ใน "ความสามารถจาก Class"</p>
        </div>

        <div className="flex gap-2">
          <Button variant="primary" className={`flex-1 ${die ? '' : 'opacity-40'}`} onClick={confirm}>ยืนยัน Level {draft.level}</Button>
          <Button className="flex-1" onClick={onClose}>ยกเลิก</Button>
        </div>
        {!die && <p className="text-xs text-amber-300">เลือก HP ก่อน (ทอย หรือค่าคงที่)</p>}
      </div>
    </Section>
  )
}
