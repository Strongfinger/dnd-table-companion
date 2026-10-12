import { useLiveQuery } from 'dexie-react-hooks'
import { useState } from 'react'
import { go } from '../app/router'
import { useLobby } from '../app/useLobby'
import { getCharacter } from '../db/characters'
import { ABILITIES, deriveSheet, formatModifier, SKILL_ABILITY, SKILLS } from '../rules'
import { ABILITY_LABEL } from '../ui/labels'
import ExportPanel from './ExportPanel'
import PlayLog from './PlayLog'
import PlayPanel from './PlayPanel'
import { Button, Section, Stat } from '../ui/kit'
import { Term } from '../ui/help'

export default function CharacterSheet({ id }: { id: string }) {
  // null = not found, undefined = still loading.
  const c = useLiveQuery(() => getCharacter(id).then((found) => found ?? null), [id])
  const [exporting, setExporting] = useState(false)

  if (c === undefined) return null
  if (c === null) return <NotFound />

  const s = deriveSheet(c)
  const mod = formatModifier
  const coins = Object.entries(c.coins).filter(([, n]) => n > 0)

  return (
    <div className="space-y-4">
      <a href="#/" className="text-sm text-stone-400">← ตัวละครทั้งหมด</a>

      <header className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold text-amber-400">{c.name || '(ไม่มีชื่อ)'}</h1>
          <p className="text-stone-400">
            {c.className} {c.level}
            {c.subclass && ` (${c.subclass})`}
            {c.species && <> · <Term name={c.species} /></>}
            {c.background && <> · <Term name={c.background} /></>}
          </p>
          {c.feats.length > 0 && (
            <p className="text-sm text-stone-400">Feats: {c.feats.map((f, i) => <span key={f + i}>{i > 0 && ', '}<Term name={f} /></span>)}</p>
          )}
        </div>
        <div className="flex shrink-0 gap-2">
          <Button onClick={() => setExporting(!exporting)}>📤</Button>
          <Button onClick={() => go(`/c/${c.id}/edit`)}>แก้ไข</Button>
        </div>
      </header>

      <LiveBadge characterId={c.id} />
      {exporting && <ExportPanel c={c} />}

      <div className="grid grid-cols-4 gap-2">
        <Stat label="AC" value={c.ac} />
        <Stat label="Initiative" value={mod(s.initiative)} />
        <Stat label="Speed" value={`${s.speed ?? c.speed} ft.`} />
        <Stat label="Proficiency" value={mod(s.proficiencyBonus)} />
      </div>

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

      {s.attacks.length > 0 && (
        <Section title="อาวุธและการโจมตี (Attacks)">
          <ul className="divide-y divide-stone-700">
            {s.attacks.map((a) => (
              <li key={a.id} className="grid grid-cols-[1fr_3rem_auto] items-baseline gap-2 py-2">
                <span className="font-bold">{a.name}</span>
                <span className="text-right text-amber-300">{mod(a.hit)}</span>
                <span className="text-right">
                  {a.damage} <span className="text-sm text-stone-400">{a.damageType}</span>
                </span>
              </li>
            ))}
          </ul>
        </Section>
      )}

      {c.spellcastingAbility && (
        <Section title="Spellcasting">
          <div className="grid grid-cols-3 gap-2">
            <Stat label="Ability" value={ABILITY_LABEL[c.spellcastingAbility].short} />
            <Stat label="Spell Save DC" value={s.spellSaveDC} />
            <Stat label="Spell Attack" value={mod(s.spellAttack ?? 0)} />
          </div>
        </Section>
      )}

      {(c.inventory.length > 0 || coins.length > 0) && (
        <Section title="ของในกระเป๋า (Inventory)">
          {coins.length > 0 && (
            <p className="mb-2 text-amber-300">{coins.map(([k, n]) => `${n} ${k.toUpperCase()}`).join(' · ')}</p>
          )}
          <ul className="space-y-1">
            {c.inventory.map((item) => (
              <li key={item.id} className="flex justify-between">
                <span>{item.name}</span>
                <span className="text-stone-400">×{item.qty}</span>
              </li>
            ))}
          </ul>
        </Section>
      )}

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
  const { session, members, status, pending } = useLobby()
  if (!session) return null
  const player = members.find((m) => m.role === 'player' && m.characterId === characterId)
  const text = session.role === 'player'
    ? session.characterId === characterId && `ซิงค์กับ DM ในห้อง ${session.code}`
    : player && `${player.name} เล่นตัวนี้ในห้อง ${session.code}${player.online ? '' : ' (ออฟไลน์)'}`
  if (!text) return null
  return (
    <a href="#/lobby" className="block rounded-lg bg-sky-950 px-3 py-2 text-sm text-sky-200">
      🌐 {text}
      {status !== 'connected' && ' · ⏳ รอสัญญาณ'}
      {session.role === 'player' && pending > 0 && ` · ⏳ รอ DM ยืนยัน ${pending} การเปลี่ยนแปลง (ส่งให้เองเมื่อมีสัญญาณ)`}
    </a>
  )
}
