import { useLiveQuery } from 'dexie-react-hooks'
import { go } from '../app/router'
import { getCharacter } from '../db/characters'
import { ABILITIES, deriveSheet, formatModifier, SKILL_ABILITY, SKILLS } from '../rules'
import { ABILITY_LABEL } from '../ui/labels'
import { Button, Section, Stat } from '../ui/kit'

export default function CharacterSheet({ id }: { id: string }) {
  // null = not found, undefined = still loading.
  const c = useLiveQuery(() => getCharacter(id).then((found) => found ?? null), [id])

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
            {c.species && ` · ${c.species}`}
            {c.background && ` · ${c.background}`}
          </p>
        </div>
        <Button onClick={() => go(`/c/${c.id}/edit`)}>แก้ไข</Button>
      </header>

      <div className="grid grid-cols-3 gap-2 sm:grid-cols-5">
        <Stat label="HP" value={`${c.hp.current}/${c.hp.max}`} sub={c.hp.temp > 0 ? `Temp ${c.hp.temp}` : undefined} />
        <Stat label="AC" value={c.ac} />
        <Stat label="Initiative" value={mod(s.initiative)} />
        <Stat label="Speed" value={`${c.speed} ft.`} />
        <Stat label="Proficiency" value={mod(s.proficiencyBonus)} />
      </div>

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
