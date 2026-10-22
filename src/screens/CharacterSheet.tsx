import { useLiveQuery } from 'dexie-react-hooks'
import { useCallback, useEffect, useRef, useState } from 'react'
import { go } from '../app/router'
import { useLobby } from '../app/useLobby'
import { useRunsCampaign } from '../app/useRunsCampaign'
import { mayLevelUp } from '../model/levelLock'
import { getCharacter } from '../db/characters'
import { ABILITIES, buffedArmorClass, deriveSheet, formatModifier, loadedSpeed, SKILL_ABILITY, SKILLS } from '../rules'
import { ABILITY_LABEL } from '../ui/labels'
import ClassFeatures from './ClassFeatures'
import ExportPanel from './ExportPanel'
import HpCard from './HpCard'
import Inventory from './Inventory'
import Notes from './Notes'
import LevelUp from './LevelUp'
import UpgradePanel from './UpgradePanel'
import { missingLevelChoices } from '../model/feats'
import { characterArmorClass } from '../model/inventory'
import { characterLoad } from '../model/carrying'
import type { Character } from '../model/character'
import { useEquipment } from './useSrdData'
import PlayLog from './PlayLog'
import PlayPanel from './PlayPanel'
import UsableNow, { DeathSaves } from './UsableNow'
import SpellList from './SpellList'
import { Button, HpBar, Section, Stat } from '../ui/kit'
import { Term } from '../ui/help'
import { classLabel } from '../model/monsterCharacter'

/** The sheet's sections. One shows at a time, so a phone doesn't scroll through the whole sheet. */
const SHEET_TABS = [
  { id: 'play', label: 'ต่อสู้' },
  { id: 'abilities', label: 'ความสามารถ' },
  { id: 'spells', label: 'คาถา' },
  { id: 'items', label: 'กระเป๋า' },
  { id: 'notes', label: 'โน้ต' },
] as const
type SheetTab = (typeof SHEET_TABS)[number]['id']

/**
 * The open tab, remembered for this browser tab (sessionStorage), so coming back from an item page
 * lands on the same tab. Storage can be blocked (private mode), so every access is guarded.
 */
function useSheetTab(characterId: string): [SheetTab, (t: SheetTab) => void] {
  const key = `sheet-tab:${characterId}`
  const [tab, setTabState] = useState<SheetTab>(() => {
    try {
      const saved = sessionStorage.getItem(key)
      if (SHEET_TABS.some((t) => t.id === saved)) return saved as SheetTab
    } catch { /* storage blocked: start on the first tab */ }
    return 'play'
  })
  const setTab = useCallback((t: SheetTab) => {
    setTabState(t)
    try { sessionStorage.setItem(key, t) } catch { /* not remembered, fine */ }
  }, [key])
  return [tab, setTab]
}

/** Reminder for a subclass or Ability Score Improvement the character should have by their level. */
function MissingChoices({ c }: { c: Parameters<typeof missingLevelChoices>[0] }) {
  const missing = missingLevelChoices(c)
  if (missing.length === 0) return null
  return (
    <div className="flex items-start justify-between gap-2 rounded-lg bg-amber-950 p-3 text-sm text-amber-200">
      <ul className="space-y-0.5">{missing.map((m) => <li key={m.message}>⚠️ {m.message}</li>)}</ul>
      <Button className="shrink-0 px-3 py-1 text-sm" onClick={() => go(`/c/${c.id}/edit`)}>เลือก</Button>
    </div>
  )
}

export default function CharacterSheet({ id }: { id: string }) {
  // null = not found, undefined = still loading.
  const c = useLiveQuery(() => getCharacter(id).then((found) => found ?? null), [id])
  const [exporting, setExporting] = useState(false)
  const [levelingUp, setLevelingUp] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const [tab, setTab] = useSheetTab(id)
  const equipment = useEquipment()
  const runsCampaign = useRunsCampaign(c?.campaignId)
  const { session, shortRestSince } = useLobby()

  // The DM started a short rest: open the play tab, where the player rolls Hit Dice.
  useEffect(() => {
    if (shortRestSince && session?.role === 'player') setTab('play')
  }, [shortRestSince, session?.role, setTab])

  // Show the small HP strip in the sticky tab bar only once the big HP box has scrolled away.
  const hpRef = useRef<HTMLElement>(null)
  const [hpHidden, setHpHidden] = useState(false)
  const loaded = !!c
  useEffect(() => {
    const el = hpRef.current
    if (!el || typeof IntersectionObserver === 'undefined') return
    const observer = new IntersectionObserver(([entry]) => setHpHidden(!entry.isIntersecting), { rootMargin: '-120px 0px 0px 0px' })
    observer.observe(el)
    return () => observer.disconnect()
  }, [loaded])

  if (c === undefined) return null
  if (c === null) return <NotFound />

  const s = deriveSheet(c)
  // Armor details (formula, Strength/Stealth/training drawbacks) when AC is worked out from armor.
  const armor = c.acAuto && equipment ? characterArmorClass(c, equipment) : null
  // Over Carrying Capacity: Speed at most 5 ft (0 if too heavy to move), see the inventory's weight bar.
  const load = characterLoad(c, equipment ?? undefined)
  const speed = loadedSpeed(Math.max(0, (s.speed ?? c.speed) - (armor?.speedPenalty ?? 0)), load.state)
  const mod = formatModifier
  const ac = buffedArmorClass(c.ac, c.buffs)
  // Played in a room: level up only with the DM's permission (model/levelLock.ts); hidden until then.
  const canLevelUp = !c.monster && c.level < 20 && mayLevelUp(c, runsCampaign)
  // Spells tab: for casters, or anyone who already has spells (e.g. from a feat).
  const isCaster = !!c.spellcastingAbility || c.spells.length > 0
  const shownTab = tab === 'spells' && !isCaster ? 'play' : tab

  function openTab(t: SheetTab) {
    setTab(t)
    // Scrolled down: go back to the top of the new tab instead of the middle of it.
    if (hpHidden) hpRef.current?.scrollIntoView()
  }

  return (
    <div className="space-y-4">
      <a href="#/" className="text-sm text-stone-400">← ตัวละครทั้งหมด</a>

      <header className="flex items-start justify-between gap-3">
        <div className="min-w-0">
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
        <div className="relative flex shrink-0 gap-2">
          <Button className="min-h-11" onClick={() => go(`/c/${c.id}/edit`)}>แก้ไข</Button>
          <Button
            aria-label="เมนูเพิ่มเติม: เลเวลอัป ส่งออก"
            className={`min-h-11 px-3 ${c.levelLock?.granted && canLevelUp ? 'ring-2 ring-amber-400' : ''}`}
            onClick={() => setMenuOpen(!menuOpen)}
          >
            ⋯
          </Button>
          {menuOpen && (
            <div className="absolute right-0 top-full z-20 mt-1 w-52 space-y-1 rounded-xl border border-stone-600 bg-stone-900 p-1.5 shadow-xl">
              {canLevelUp && (
                <button type="button" className="block w-full rounded-lg px-3 py-2.5 text-left hover:bg-stone-800" onClick={() => { setLevelingUp(!levelingUp); setMenuOpen(false) }}>
                  ⬆️ เลเวลอัป
                </button>
              )}
              <button type="button" className="block w-full rounded-lg px-3 py-2.5 text-left hover:bg-stone-800" onClick={() => { setExporting(!exporting); setMenuOpen(false) }}>
                📤 ส่งออก / แชร์ตัวละคร
              </button>
            </div>
          )}
        </div>
      </header>

      <LiveBadge characterId={c.id} />
      <UpgradePanel c={c} />
      <MissingChoices c={c} />
      {exporting && <ExportPanel c={c} />}
      {!!c.levelLock?.granted && canLevelUp && !levelingUp && (
        <button type="button" className="block w-full rounded-lg bg-amber-950 p-2 text-left text-sm text-amber-200" onClick={() => setLevelingUp(true)}>
          ⬆️ DM อนุญาตให้เลเวลอัปแล้ว · แตะที่นี่เพื่อเลเวลอัป
        </button>
      )}
      {levelingUp && canLevelUp && <LevelUp key={c.level} c={c} onClose={() => setLevelingUp(false)} />}

      <HpCard ref={hpRef} c={c} />

      <div className="grid grid-cols-4 gap-2">
        <Stat label="AC" value={ac} sub={s.buffs.ac ? `บัฟ ${mod(s.buffs.ac)}` : undefined} />
        <Stat label="Initiative" value={mod(s.initiative)} />
        <Stat label="Speed" value={`${speed} ft.`} sub={load.state !== 'ok' ? '🎒 หนักเกิน' : undefined} />
        <Stat label="Proficiency" value={mod(s.proficiencyBonus)} />
      </div>

      {/* Sticky under the top bar: the sheet's tabs, plus a small HP strip once the HP box is off screen. */}
      <div className="sticky z-[5] -mx-4 border-b border-stone-800 bg-stone-950 px-4" style={{ top: 'var(--nav-h, 0px)' }}>
        {hpHidden && <HpStrip c={c} ac={ac} onOpen={() => hpRef.current?.scrollIntoView()} />}
        <nav className="flex" aria-label="ส่วนของชีท">
          {SHEET_TABS.filter((t) => t.id !== 'spells' || isCaster).map((t) => (
            <button
              key={t.id}
              type="button"
              aria-current={shownTab === t.id ? 'page' : undefined}
              onClick={() => openTab(t.id)}
              className={`min-h-11 flex-1 whitespace-nowrap border-b-2 px-1 text-sm font-bold ${shownTab === t.id ? 'border-amber-400 text-amber-400' : 'border-transparent text-stone-400'}`}
            >
              {t.label}
            </button>
          ))}
        </nav>
      </div>

      {shownTab === 'play' && (
        <>
          {armor && (
            <div className="space-y-1 text-xs">
              <p className="text-stone-400">AC {c.ac} = {armor.formula}</p>
              {armor.untrainedArmor && <p className="rounded bg-red-950/60 p-1.5 text-red-300">⚠️ ไม่ได้ฝึกใช้เกราะนี้: Disadvantage ทุก D20 Test ที่ใช้ STR หรือ DEX และร่ายคาถาไม่ได้</p>}
              {armor.untrainedShield && <p className="rounded bg-amber-950/60 p-1.5 text-amber-200">⚠️ ไม่ได้ฝึกใช้ Shield: ไม่ได้ +2 AC</p>}
              {armor.speedPenalty > 0 && <p className="rounded bg-amber-950/60 p-1.5 text-amber-200">เกราะหนักเกิน STR: Speed −{armor.speedPenalty} ft. (หักแล้ว)</p>}
              {armor.stealthDisadvantage && <p className="text-stone-400">เกราะนี้: Disadvantage ใน Dexterity (Stealth)</p>}
            </div>
          )}
          <ExhaustionNote c={c} penalty={s.d20Penalty} />
          <DeathSaves c={c} />
          <UsableNow c={c} manualAttacks={s.attacks} skillBonuses={s.skills} />
          <PlayPanel c={c} />
        </>
      )}

      {shownTab === 'abilities' && (
        <>
          <ExhaustionNote c={c} penalty={s.d20Penalty} />
          <Section title="Ability Scores · Saving Throws">
            <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
              {ABILITIES.map((a) => (
                <div key={a} className={`rounded-lg border bg-stone-900 p-2 text-center ${c.saveProficiencies.includes(a) ? 'border-amber-800' : 'border-transparent'}`} title={`${ABILITY_LABEL[a].name} (${ABILITY_LABEL[a].th})`}>
                  <div className="text-xs font-bold text-stone-400">{ABILITY_LABEL[a].short}</div>
                  <div className="text-2xl font-bold">{mod(s.modifiers[a])}</div>
                  <div className="text-sm text-stone-400">{c.scores[a]}</div>
                  <div className={`mt-1 text-xs ${c.saveProficiencies.includes(a) ? 'font-bold text-amber-400' : 'text-stone-400'}`}>
                    Save {mod(s.saves[a])}
                    {c.saveProficiencies.includes(a) && ' ●'}
                  </div>
                </div>
              ))}
            </div>
          </Section>
          <SkillsSection c={c} skills={s.skills} />
          <div className="grid grid-cols-3 gap-2">
            <Stat label="Passive Perception" value={s.passivePerception} />
            <Stat label="Passive Insight" value={s.passiveInsight} />
            <Stat label="Passive Investigation" value={s.passiveInvestigation} />
          </div>
          <ClassFeatures c={c} />
          <TextBlock title="ความสามารถพิเศษ (Features & Traits)" text={c.featuresText} />
          <TextBlock title="ความชำนาญอื่นๆ และภาษา" text={c.proficienciesText} />
        </>
      )}

      {shownTab === 'spells' && (
        <>
          {c.spellcastingAbility && (
            <Section title="Spellcasting">
              <div className="grid grid-cols-3 gap-2">
                <Stat label="Ability" value={ABILITY_LABEL[c.spellcastingAbility].short} />
                <Stat label="Spell Save DC" value={s.spellSaveDC} />
                <Stat label="Spell Attack" value={mod(s.spellAttack ?? 0)} />
              </div>
            </Section>
          )}
          <SpellList c={c} />
        </>
      )}

      {shownTab === 'items' && <Inventory c={c} />}

      {shownTab === 'notes' && (
        <>
          <Notes c={c} />
          <PlayLog characterId={c.id} />
        </>
      )}
    </div>
  )
}

function ExhaustionNote({ c, penalty }: { c: Character; penalty: number }) {
  if (penalty <= 0) return null
  return <p className="rounded-lg bg-red-950/60 p-2 text-sm text-red-300">Exhaustion {c.exhaustion}: ทุก D20 Test −{penalty} (ตัวเลขในชีทหักแล้ว)</p>
}

/** One line in the sticky bar: name, HP with a bar, AC. Tapping it scrolls back to the HP box. */
function HpStrip({ c, ac, onOpen }: { c: Character; ac: number; onOpen: () => void }) {
  return (
    <button type="button" onClick={onOpen} className="flex w-full items-center gap-3 pt-2 text-left" aria-label="ไปที่ HP">
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline justify-between gap-2 text-sm">
          <b className="truncate text-amber-400">{c.name}</b>
          <span className="shrink-0"><b>{c.hp.current}</b><span className="text-stone-400">/{c.hp.max} HP</span> · AC <b>{ac}</b></span>
        </div>
        <HpBar current={c.hp.current} max={c.hp.max} className="mt-1 h-1.5" />
      </div>
      <span className="shrink-0 rounded-lg border border-stone-600 bg-stone-800 px-2.5 py-1.5 text-sm font-bold">± HP</span>
    </button>
  )
}

/** Skills in two columns (one on very narrow screens); "เฉพาะที่ถนัด" hides the ones without proficiency. */
function SkillsSection({ c, skills }: { c: Character; skills: ReturnType<typeof deriveSheet>['skills'] }) {
  const [onlyTrained, setOnlyTrained] = useState(false)
  const shown = SKILLS.filter((skill) => !onlyTrained || (c.skills[skill] ?? 'none') !== 'none')
  const pill = (on: boolean) => `rounded-full border px-3 py-1 text-xs ${on ? 'border-amber-400 bg-amber-400 font-bold text-stone-900' : 'border-stone-600 text-stone-300'}`
  return (
    <Section
      title="Skills"
      action={
        <div className="flex gap-1.5">
          <button type="button" aria-pressed={!onlyTrained} className={pill(!onlyTrained)} onClick={() => setOnlyTrained(false)}>ทั้งหมด</button>
          <button type="button" aria-pressed={onlyTrained} className={pill(onlyTrained)} onClick={() => setOnlyTrained(true)}>เฉพาะที่ถนัด</button>
        </div>
      }
    >
      <p className="mb-1 text-xs text-stone-500">แตะ/ชี้เมาส์ที่ชื่อ Skill เพื่อดูว่าใช้ทำอะไร</p>
      <ul className="grid grid-cols-1 gap-x-5 min-[360px]:grid-cols-2">
        {shown.map((skill) => {
          const level = c.skills[skill] ?? 'none'
          return (
            <li key={skill} className={`flex justify-between gap-2 border-b border-stone-700/60 py-1.5 text-sm ${level === 'none' ? 'text-stone-300' : 'font-bold text-amber-300'}`}>
              <span className="min-w-0">
                <Term name={skill} /> <span className="text-[11px] font-normal text-stone-500">{ABILITY_LABEL[SKILL_ABILITY[skill]].short}</span>
                {level === 'expertise' && <span className="ml-1 text-xs">★</span>}
              </span>
              <span>{formatModifier(skills[skill])}</span>
            </li>
          )
        })}
      </ul>
      {onlyTrained && shown.length === 0 && <p className="text-sm text-stone-500">ยังไม่มี Skill ที่ถนัด</p>}
      {SKILLS.some((skill) => c.skills[skill] === 'expertise') && <p className="mt-2 text-xs text-stone-500">★ = Expertise</p>}
    </Section>
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
