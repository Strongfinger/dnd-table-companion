import { useLiveQuery } from 'dexie-react-hooks'
import { useState } from 'react'
import { go } from '../app/router'
import { useLobby } from '../app/useLobby'
import { getCharacter } from '../db/characters'
import { ABILITIES, deriveSheet, formatModifier, SKILL_ABILITY, SKILLS } from '../rules'
import { ABILITY_LABEL } from '../ui/labels'
import Attacks from './Attacks'
import ClassFeatures from './ClassFeatures'
import ExportPanel from './ExportPanel'
import Inventory from './Inventory'
import LevelUp from './LevelUp'
import UpgradePanel from './UpgradePanel'
import { characterArmorClass } from '../model/inventory'
import { useEquipment } from './useSrdData'
import PlayLog from './PlayLog'
import PlayPanel from './PlayPanel'
import SpellList from './SpellList'
import { Button, Section, Stat } from '../ui/kit'
import { Term } from '../ui/help'
import { classLabel } from '../model/monsterCharacter'

export default function CharacterSheet({ id }: { id: string }) {
  // null = not found, undefined = still loading.
  const c = useLiveQuery(() => getCharacter(id).then((found) => found ?? null), [id])
  const [exporting, setExporting] = useState(false)
  const [levelingUp, setLevelingUp] = useState(false)
  const equipment = useEquipment()

  if (c === undefined) return null
  if (c === null) return <NotFound />

  const s = deriveSheet(c)
  // Armor details (formula, Strength/Stealth/training drawbacks) when AC is worked out from armor.
  const armor = c.acAuto && equipment ? characterArmorClass(c, equipment) : null
  const speed = Math.max(0, (s.speed ?? c.speed) - (armor?.speedPenalty ?? 0))
  const mod = formatModifier

  return (
    <div className="space-y-4">
      <a href="#/" className="text-sm text-stone-400">← ตัวละครทั้งหมด</a>

      <header className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold text-amber-400">{c.name || '(ไม่มีชื่อ)'}</h1>
          <p className="text-stone-400">
            {classLabel(c)}
            {c.subclass && ` (${c.subclass})`}
            {c.species && <> · <Term name={c.species} /></>}
            {c.background && <> · <Term name={c.background} /></>}
          </p>
          {c.feats.length > 0 && (
            <p className="text-sm text-stone-400">Feats: {c.feats.map((f, i) => <span key={f + i}>{i > 0 && ', '}<Term name={f} /></span>)}</p>
          )}
        </div>
        <div className="flex shrink-0 gap-2">
          {!c.monster && c.level < 20 && <Button aria-label="Level Up" onClick={() => setLevelingUp(!levelingUp)}>⬆️</Button>}
          <Button onClick={() => setExporting(!exporting)}>📤</Button>
          <Button onClick={() => go(`/c/${c.id}/edit`)}>แก้ไข</Button>
        </div>
      </header>

      <LiveBadge characterId={c.id} />
      <UpgradePanel c={c} />
      {exporting && <ExportPanel c={c} />}
      {levelingUp && <LevelUp key={c.level} c={c} onClose={() => setLevelingUp(false)} />}

      <div className="grid grid-cols-4 gap-2">
        <Stat label="AC" value={c.ac} />
        <Stat label="Initiative" value={mod(s.initiative)} />
        <Stat label="Speed" value={`${speed} ft.`} />
        <Stat label="Proficiency" value={mod(s.proficiencyBonus)} />
      </div>

      {armor && (
        <div className="space-y-1 text-xs">
          <p className="text-stone-400">AC {c.ac} = {armor.formula}</p>
          {armor.untrainedArmor && <p className="rounded bg-red-950/60 p-1.5 text-red-300">⚠️ ไม่ได้ฝึกใช้เกราะนี้: Disadvantage ทุก D20 Test ที่ใช้ STR หรือ DEX และร่ายคาถาไม่ได้</p>}
          {armor.untrainedShield && <p className="rounded bg-amber-950/60 p-1.5 text-amber-200">⚠️ ไม่ได้ฝึกใช้ Shield: ไม่ได้ +2 AC</p>}
          {armor.speedPenalty > 0 && <p className="rounded bg-amber-950/60 p-1.5 text-amber-200">เกราะหนักเกิน STR: Speed −{armor.speedPenalty} ft. (หักแล้ว)</p>}
          {armor.stealthDisadvantage && <p className="text-stone-400">เกราะนี้: Disadvantage ใน Dexterity (Stealth)</p>}
        </div>
      )}

      {s.d20Penalty > 0 && (
        <p className="rounded-lg bg-red-950/60 p-2 text-sm text-red-300">Exhaustion {c.exhaustion}: ทุก D20 Test −{s.d20Penalty} (ตัวเลขด้านล่างหักแล้ว)</p>
      )}

      <PlayPanel c={c} />
      <PlayLog characterId={c.id} />

      <Section title="Ability Scores · Saving Throws">
        <div className="grid grid-cols-3 gap-2">
          {ABILITIES.map((a) => (
            <div key={a} className="rounded-lg bg-stone-900 p-2 text-center" title={`${ABILITY_LABEL[a].name} (${ABILITY_LABEL[a].th})`}>
              <div className="text-xs text-stone-400">{ABILITY_LABEL[a].short}</div>
              <div className="text-2xl font-bold">{mod(s.modifiers[a])}</div>
              <div className="text-sm text-stone-400">{c.scores[a]}</div>
              <div className={`mt-1 text-xs ${c.saveProficiencies.includes(a) ? 'text-amber-400' : 'text-stone-400'}`}>
                Save {mod(s.saves[a])}
                {c.saveProficiencies.includes(a) && ' ●'}
              </div>
            </div>
          ))}
        </div>
      </Section>

      <Section title="Skills">
        <ul className="divide-y divide-stone-700">
          {SKILLS.map((skill) => {
            const level = c.skills[skill] ?? 'none'
            return (
              <li key={skill} className={`flex justify-between py-1.5 ${level === 'none' ? 'text-stone-300' : 'font-bold text-amber-300'}`}>
                <span>
                  {skill} <span className="text-xs font-normal text-stone-500">{ABILITY_LABEL[SKILL_ABILITY[skill]].short}</span>
                  {level === 'expertise' && <span className="ml-1 text-xs">★ Expertise</span>}
                </span>
                <span>{mod(s.skills[skill])}</span>
              </li>
            )
          })}
        </ul>
        <div className="mt-3 grid grid-cols-3 gap-2">
          <Stat label="Passive Perception" value={s.passivePerception} />
          <Stat label="Passive Insight" value={s.passiveInsight} />
          <Stat label="Passive Investigation" value={s.passiveInvestigation} />
        </div>
      </Section>

      <Attacks c={c} manual={s.attacks} />

      {c.spellcastingAbility && (
        <Section title="Spellcasting">
          <div className="grid grid-cols-3 gap-2">
            <Stat label="Ability" value={ABILITY_LABEL[c.spellcastingAbility].short} />
            <Stat label="Spell Save DC" value={s.spellSaveDC} />
            <Stat label="Spell Attack" value={mod(s.spellAttack ?? 0)} />
          </div>
        </Section>
      )}

      {/* Spells: shown for casters, or anyone who already has spells (e.g. from a feat). */}
      {(c.spellcastingAbility || c.spells.length > 0) && <SpellList c={c} />}

      <Inventory c={c} />

      <ClassFeatures c={c} />
      <TextBlock title="ความสามารถพิเศษ (Features & Traits)" text={c.featuresText} />
      <TextBlock title="ความชำนาญอื่นๆ และภาษา" text={c.proficienciesText} />
      <TextBlock title="โน้ต" text={c.notes} />
    </div>
  )
}

function TextBlock({ title, text }: { title: string; text: string }) {
  if (!text.trim()) return null
  return (
    <Section title={title}>
      <p className="whitespace-pre-wrap text-stone-200">{text}</p>
    </Section>
  )
}

function NotFound() {
  return (
    <div className="space-y-4 text-center">
      <p className="text-stone-400">ไม่พบตัวละครนี้ในเครื่อง</p>
      <Button onClick={() => go('/')}>กลับหน้าหลัก</Button>
    </div>
  )
}

/** In a live lobby: shows that this sheet is synced with the room (player: with the DM; DM: who plays it). */
function LiveBadge({ characterId }: { characterId: string }) {
  const { session, members, status, pending, myCharacterIds } = useLobby()
  if (!session) return null
  // DM: the player who picked it, or the one it was handed to.
  const grantedTo = session.grants.find((g) => g.characterId === characterId)?.deviceId
  const player = members.find((m) => m.role === 'player' && (m.characterId === characterId || m.deviceId === grantedTo))
  const text = session.role === 'player'
    ? myCharacterIds.includes(characterId) && `ซิงค์กับ DM ในห้อง ${session.code}${session.characterId === characterId ? '' : ' · DM ให้คุณควบคุมตัวนี้'}`
    : player && `${player.name} ${grantedTo ? 'ควบคุม' : 'เล่น'}ตัวนี้ในห้อง ${session.code}${player.online ? '' : ' (ออฟไลน์)'}`
  if (!text) return null
  return (
    <a href="#/lobby" className="block rounded-lg bg-sky-950 px-3 py-2 text-sm text-sky-200">
      🌐 {text}
      {status !== 'connected' && ' · ⏳ รอสัญญาณ'}
      {session.role === 'player' && pending > 0 && ` · ⏳ รอ DM ยืนยัน ${pending} การเปลี่ยนแปลง (ส่งให้เองเมื่อมีสัญญาณ)`}
    </a>
  )
}
