// Step-by-step character creation for new players (level 1, 2024 rules, SRD options).
// Each step only shows legal choices; buildCharacter() assembles the result.
import { useState, type ReactNode } from 'react'
import { go } from '../app/router'
import { saveCharacter } from '../db/characters'
import { buildCharacter, featsFor, type CreationChoices } from '../model/create'
import type { Character } from '../model/character'
import { applyStartingGear, backgroundGearOptions, classGearOptions } from '../model/startingGear'
import { useEquipment } from './useSrdData'
import {
  ABILITIES, abilityModifier, BACKGROUND_INFO, BACKGROUNDS, CLASS_HIT_DIE, CLASS_INFO, CLASS_SPELLCASTING, CLASSES, checkCharacter,
  deriveSheet, ELF_LINEAGES, FEAT_INFO, formatModifier, maxExpertise, ORIGIN_FEATS, POINT_BUY_BUDGET, POINT_BUY_MAX,
  POINT_BUY_MIN, POINT_BUY_START, pointBuyCost, pointBuyPriceList, pointBuyTotal, SKILLS, SPECIES, SPECIES_INFO, applyBonus,
  checkBackgroundBonus, gearOptionLine, tapTwoOneBonus,
  type Ability, type GearOption, type ElfLineage, type Skill,
} from '../rules'
import { Button, Label, RuleMessages, Section, Stat, TextInput } from '../ui/kit'
import { useHelp } from '../ui/useHelp'
import { ABILITY_LABEL } from '../ui/labels'

const STEPS = ['Class', 'Species', 'Background', 'Ability Scores', 'Skills', 'อุปกรณ์', 'สรุป'] as const

const START: CreationChoices = {
  name: '',
  player: '',
  className: 'Fighter',
  species: 'Human',
  elfLineage: null,
  background: 'Soldier',
  bonus: {},
  baseScores: { ...POINT_BUY_START },
  humanFeat: null,
  magicInitiateAbility: null,
  classSkills: [],
  speciesSkill: null,
  skilledSkills: [],
  expertise: [],
}

export default function CreateWizard() {
  const [step, setStep] = useState(0)
  const [c, setC] = useState<CreationChoices>(START)
  const update = (patch: Partial<CreationChoices>) => setC({ ...c, ...patch })
  // Starting equipment: index of the class's and the background's option (A = 0).
  const [gear, setGear] = useState({ cls: 0, bg: 0 })
  const equipment = useEquipment()
  const chosenGear = [classGearOptions(c)[gear.cls] ?? classGearOptions(c)[0], backgroundGearOptions(c.background)[gear.bg]].filter(Boolean)
  const build = () => (equipment ? applyStartingGear(buildCharacter(c), chosenGear, equipment) : buildCharacter(c))

  const feats = featsFor(c)
  const needsMagicAbility = feats.includes('Magic Initiate') && CLASS_SPELLCASTING[c.className] === null
  const stepError = validateStep(step, c, needsMagicAbility)

  async function finish() {
    const saved = await saveCharacter(build())
    go(`/c/${saved.id}`)
  }

  return (
    <div className="space-y-4 pb-24">
      <a href="#/" className="text-sm text-stone-400">← ยกเลิก</a>
      <h1 className="text-2xl font-bold text-amber-400">สร้างตัวละครใหม่</h1>

      {/* Progress: step names, current one highlighted */}
      <ol className="flex flex-wrap gap-1 text-xs">
        {STEPS.map((name, i) => (
          <li key={name} className={`rounded px-2 py-1 ${i === step ? 'bg-amber-500 font-bold text-stone-900' : i < step ? 'bg-stone-700' : 'bg-stone-800 text-stone-500'}`}>
            {i + 1}. {name}
          </li>
        ))}
      </ol>

      {step === 0 && <ClassStep c={c} update={update} />}
      {step === 1 && <SpeciesStep c={c} update={update} />}
      {step === 2 && <BackgroundStep c={c} update={update} needsMagicAbility={needsMagicAbility} />}
      {step === 3 && <AbilityStep c={c} update={update} />}
      {step === 4 && <SkillStep c={c} update={update} />}
      {step === 5 && <GearStep c={c} gear={gear} setGear={setGear} />}
      {step === 6 && <ReviewStep c={c} character={build()} />}

      {stepError && <p className="text-sm text-amber-300">⚠️ {stepError}</p>}

      <div className="fixed inset-x-0 bottom-0 border-t border-stone-700 bg-stone-900/95 p-3">
        <div className="mx-auto flex max-w-xl gap-2">
          <Button className="flex-1" onClick={() => (step === 0 ? go('/') : setStep(step - 1))}>
            {step === 0 ? 'ยกเลิก' : '← ย้อนกลับ'}
          </Button>
          {step < STEPS.length - 1 ? (
            <Button variant="primary" className={`flex-1 ${stepError ? 'opacity-50' : ''}`} onClick={() => !stepError && setStep(step + 1)}>
              ถัดไป →
            </Button>
          ) : (
            <Button variant="primary" className="flex-1" onClick={finish}>✓ สร้างตัวละคร</Button>
          )}
        </div>
      </div>
    </div>
  )
}

/** What still has to be done before "ถัดไป" works, or null. */
function validateStep(step: number, c: CreationChoices, needsMagicAbility: boolean): string | null {
  const species = SPECIES_INFO[c.species]
  if (step === 0 && !c.name.trim()) return 'ใส่ชื่อตัวละครก่อน'
  if (step === 1 && c.species === 'Elf' && !c.elfLineage) return 'เลือกสายเลือดเอลฟ์ (Elven Lineage)'
  if (step === 2) {
    const bonusError = checkBackgroundBonus(c.bonus, BACKGROUND_INFO[c.background].abilities)
    if (bonusError) return bonusError
    if (species.extraOriginFeat && !c.humanFeat) return 'Human: เลือก Origin Feat เพิ่ม 1 อัน (Versatile)'
    if (needsMagicAbility && !c.magicInitiateAbility) return 'เลือก Ability สำหรับคาถาของ Magic Initiate'
  }
  if (step === 3 && pointBuyTotal(c.baseScores) > POINT_BUY_BUDGET) return `ใช้แต้มเกิน ${POINT_BUY_BUDGET}`
  if (step === 4) {
    const need = CLASS_INFO[c.className].skillCount
    if (c.classSkills.length < need) return `เลือก Skill จาก Class อีก ${need - c.classSkills.length} อย่าง`
    if (species.skillChoice && !c.speciesSkill) return `เลือก Skill จาก ${c.species}`
    if (featsFor(c).includes('Skilled') && c.skilledSkills.length < 3) return 'เลือก Skill จาก Feat Skilled ให้ครบ 3 อย่าง'
    const exp = maxExpertise(c.className, 1)
    if (c.expertise.length < exp) return `เลือก Expertise อีก ${exp - c.expertise.length} อย่าง`
  }
  return null
}

type StepProps = { c: CreationChoices; update: (patch: Partial<CreationChoices>) => void }

/** A big tappable option card. */
function Card({ selected, onClick, title, subtitle, children }: {
  selected: boolean
  onClick: () => void
  title: string
  subtitle?: string
  children?: ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`w-full rounded-xl border-2 p-3 text-left ${selected ? 'border-amber-400 bg-stone-800' : 'border-stone-800 bg-stone-800/60 hover:border-stone-600'}`}
    >
      <div className="flex items-baseline justify-between gap-2">
        <span className="font-bold">{title}</span>
        {subtitle && <span className="text-xs text-stone-400">{subtitle}</span>}
      </div>
      {children && <div className="mt-1 text-sm text-stone-300">{children}</div>}
    </button>
  )
}

/** Small toggle chip for picking skills/feats/abilities. */
/** `help`: a glossary term (e.g. a skill), shown on hover or press-and-hold. */
function Chip({ on, disabled = false, onClick, help, children }: { on: boolean; disabled?: boolean; onClick: () => void; help?: string; children: ReactNode }) {
  const helpProps = useHelp(help ?? '')
  return (
    <button
      {...helpProps}
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={`rounded-full border px-3 py-1.5 text-sm ${on ? 'border-amber-400 bg-amber-500 font-bold text-stone-900' : 'border-stone-600 bg-stone-900'} ${disabled ? 'opacity-40' : ''}`}
    >
      {children}
    </button>
  )
}

function ClassStep({ c, update }: StepProps) {
  return (
    <>
      <Section title="ชื่อ">
        <div className="space-y-3">
          <Label text="ชื่อตัวละคร *"><TextInput value={c.name} onChange={(v) => update({ name: v })} /></Label>
          <Label text="ชื่อผู้เล่น"><TextInput value={c.player} onChange={(v) => update({ player: v })} /></Label>
        </div>
      </Section>
      <Section title="เลือก Class (อาชีพ)">
        <div className="space-y-2">
          {CLASSES.map((cls) => (
            <Card
              key={cls}
              selected={c.className === cls}
              // Changing class resets choices that depend on it.
              onClick={() => update({ className: cls, classSkills: [], expertise: [], magicInitiateAbility: null })}
              title={cls}
              subtitle={`d${CLASS_HIT_DIE[cls]} · ${CLASS_INFO[cls].recommended.map((a) => ABILITY_LABEL[a].short).join(' / ')}`}
            >
              {CLASS_INFO[cls].descriptionTh}
            </Card>
          ))}
        </div>
      </Section>
    </>
  )
}

function SpeciesStep({ c, update }: StepProps) {
  return (
    <Section title="เลือก Species (เผ่าพันธุ์)">
      <div className="space-y-2">
        {SPECIES.map((sp) => {
          const info = SPECIES_INFO[sp]
          return (
            <Card
              key={sp}
              selected={c.species === sp}
              // Species changes which skills/feats are offered, so clear picks that depend on it.
              onClick={() => update({ species: sp, elfLineage: null, speciesSkill: null, humanFeat: null, skilledSkills: [], expertise: [], magicInitiateAbility: null })}
              title={sp}
              subtitle={`Speed ${info.speed} ft.${info.darkvision ? ` · Darkvision ${info.darkvision} ft.` : ''}`}
            >
              {info.descriptionTh}
            </Card>
          )
        })}
      </div>
      {c.species === 'Elf' && (
        <div className="mt-4">
          <p className="mb-2 font-bold">สายเลือดเอลฟ์ (Elven Lineage)</p>
          <div className="flex flex-wrap gap-2">
            {(Object.keys(ELF_LINEAGES) as ElfLineage[]).map((l) => (
              <Chip key={l} on={c.elfLineage === l} onClick={() => update({ elfLineage: l })}>
                {l} ({ELF_LINEAGES[l].speed} ft.)
              </Chip>
            ))}
          </div>
        </div>
      )}
    </Section>
  )
}

function BackgroundStep({ c, update, needsMagicAbility }: StepProps & { needsMagicAbility: boolean }) {
  const bg = BACKGROUND_INFO[c.background]
  const plus2 = (Object.keys(c.bonus) as Ability[]).find((a) => c.bonus[a] === 2)
  const mode = plus2 ? '2-1' : Object.keys(c.bonus).length === 3 ? '1-1-1' : '2-1'

  function tapBonus(a: Ability) {
    if (mode === '2-1') update({ bonus: tapTwoOneBonus(c.bonus, a) })
  }

  return (
    <>
      <Section title="เลือก Background (ภูมิหลัง)">
        <div className="space-y-2">
          {BACKGROUNDS.map((b) => {
            const info = BACKGROUND_INFO[b]
            return (
              <Card
                key={b}
                selected={c.background === b}
                // Background changes the allowed ability bonus, skills and feat.
                onClick={() => update({
                  background: b, bonus: {}, classSkills: [], speciesSkill: null, skilledSkills: [], expertise: [], humanFeat: null, magicInitiateAbility: null,
                })}
                title={b}
                subtitle={info.abilities.map((a) => ABILITY_LABEL[a].short).join(' / ')}
              >
                {info.descriptionTh}
                <div className="mt-1 text-xs text-stone-400">
                  Skill: {info.skills.join(', ')} · Feat: {info.feat}{info.featNote ? ` (${info.featNote})` : ''} · {info.tool}
                </div>
              </Card>
            )
          })}
        </div>
      </Section>

      <Section title="เพิ่มค่า Ability จาก Background">
        <div className="mb-3 flex gap-2">
          <Chip on={mode === '2-1'} onClick={() => update({ bonus: {} })}>+2 / +1</Chip>
          <Chip on={mode === '1-1-1'} onClick={() => update({ bonus: Object.fromEntries(bg.abilities.map((a) => [a, 1])) })}>+1 / +1 / +1</Chip>
        </div>
        {mode === '2-1' && <p className="mb-2 text-xs text-stone-400">แตะครั้งแรก = +2 แตะอันที่สอง = +1</p>}
        <div className="flex gap-2">
          {bg.abilities.map((a) => (
            <Chip key={a} on={!!c.bonus[a]} onClick={() => tapBonus(a)}>
              {ABILITY_LABEL[a].short} {c.bonus[a] ? `+${c.bonus[a]}` : ''}
            </Chip>
          ))}
        </div>
      </Section>

      {SPECIES_INFO[c.species].extraOriginFeat && (
        <Section title="Human: Origin Feat เพิ่ม (Versatile)">
          <div className="space-y-2">
            {ORIGIN_FEATS.map((f) => {
              // A non-repeatable feat can't be taken twice.
              const taken = f === bg.feat && !FEAT_INFO[f].repeatable
              return (
                <Card key={f} selected={c.humanFeat === f} onClick={() => !taken && update({ humanFeat: f, skilledSkills: [], expertise: [], magicInitiateAbility: null })} title={f} subtitle={taken ? 'ได้จาก Background แล้ว' : undefined}>
                  {FEAT_INFO[f].descriptionTh}
                </Card>
              )
            })}
          </div>
        </Section>
      )}

      {needsMagicAbility && (
        <Section title="Magic Initiate: ใช้ Ability ไหนร่ายคาถา">
          <div className="flex gap-2">
            {(['int', 'wis', 'cha'] as const).map((a) => (
              <Chip key={a} on={c.magicInitiateAbility === a} onClick={() => update({ magicInitiateAbility: a })}>{ABILITY_LABEL[a].short}</Chip>
            ))}
          </div>
        </Section>
      )}
    </>
  )
}

function AbilityStep({ c, update }: StepProps) {
  const spent = pointBuyTotal(c.baseScores)
  const left = POINT_BUY_BUDGET - spent
  const final = applyBonus(c.baseScores, c.bonus)
  const recommended = CLASS_INFO[c.className].recommended

  function change(a: Ability, delta: number) {
    const next = c.baseScores[a] + delta
    if (next < POINT_BUY_MIN || next > POINT_BUY_MAX) return
    const scores = { ...c.baseScores, [a]: next }
    if (pointBuyTotal(scores) > POINT_BUY_BUDGET) return
    update({ baseScores: scores })
  }

  return (
    <Section title="Ability Scores (Point Buy)">
      <p className="mb-3 text-sm">
        แต้มเหลือ <b className={left === 0 ? 'text-emerald-400' : 'text-amber-300'}>{left}</b> / {POINT_BUY_BUDGET}
        <span className="block text-xs text-stone-400">
          ค่า {POINT_BUY_MIN}–{POINT_BUY_MAX} ก่อนบวก Background · {c.className} ควรเน้น {recommended.map((a) => ABILITY_LABEL[a].short).join(' และ ')}
        </span>
      </p>
      <div className="space-y-2">
        {ABILITIES.map((a) => {
          const base = c.baseScores[a]
          const nextCost = base < POINT_BUY_MAX ? pointBuyCost(base + 1) - pointBuyCost(base) : null
          return (
            <div key={a} className={`flex items-center gap-2 rounded-lg p-2 ${recommended.includes(a) ? 'bg-stone-900 ring-1 ring-amber-700' : 'bg-stone-900'}`}>
              <div className="w-24">
                <div className="font-bold">{ABILITY_LABEL[a].short}</div>
                <div className="text-xs text-stone-400">{ABILITY_LABEL[a].th}</div>
              </div>
              <button type="button" className="h-10 w-10 rounded-lg bg-stone-700 text-xl" onClick={() => change(a, -1)}>−</button>
              <div className="w-8 text-center text-lg font-bold">{base}</div>
              <button type="button" className="h-10 w-10 rounded-lg bg-stone-700 text-xl disabled:opacity-30" disabled={nextCost === null || nextCost > left} onClick={() => change(a, 1)}>+</button>
              <div className="flex-1 text-right text-sm">
                {c.bonus[a] ? <span className="text-amber-300">+{c.bonus[a]} → </span> : null}
                <b>{final[a]}</b> <span className="text-stone-400">({formatModifier(abilityModifier(final[a]))})</span>
              </div>
            </div>
          )
        })}
      </div>
      <p className="mt-2 text-xs text-stone-500">ค่าใช้แต้ม: {pointBuyPriceList()}</p>
    </Section>
  )
}

function SkillStep({ c, update }: StepProps) {
  const info = CLASS_INFO[c.className]
  const bgSkills: readonly Skill[] = BACKGROUND_INFO[c.background].skills
  const classList = info.skillChoices === 'any' ? SKILLS : info.skillChoices
  const species = SPECIES_INFO[c.species]
  const speciesList = species.skillChoice === 'any' ? SKILLS : species.skillChoice ?? []
  const hasSkilled = featsFor(c).includes('Skilled')
  const expertiseCount = maxExpertise(c.className, 1)

  const owned = (except: 'class' | 'species' | 'skilled'): Skill[] => [
    ...bgSkills,
    ...(except === 'class' ? [] : c.classSkills),
    ...(except === 'species' || !c.speciesSkill ? [] : [c.speciesSkill]),
    ...(except === 'skilled' ? [] : c.skilledSkills),
  ]
  const toggle = (list: Skill[], s: Skill, max: number) =>
    list.includes(s) ? list.filter((x) => x !== s) : list.length < max ? [...list, s] : list
  const proficient = [...bgSkills, ...c.classSkills, ...(c.speciesSkill ? [c.speciesSkill] : []), ...c.skilledSkills]

  return (
    <>
      <p className="text-sm text-stone-400">กดค้าง (มือถือ) หรือชี้เมาส์ที่ชื่อ Skill เพื่อดูว่าใช้ทำอะไร</p>
      <Section title="Skill จาก Background">
        <div className="flex flex-wrap gap-2">{bgSkills.map((s) => <Chip key={s} on help={s} onClick={() => {}}>{s} ✓</Chip>)}</div>
      </Section>

      <Section title={`Skill จาก ${c.className}: เลือก ${info.skillCount} (${c.classSkills.length}/${info.skillCount})`}>
        <div className="flex flex-wrap gap-2">
          {classList.map((s) => (
            <Chip key={s} help={s} on={c.classSkills.includes(s)} disabled={owned('class').includes(s)}
              onClick={() => update({ classSkills: toggle(c.classSkills, s, info.skillCount), expertise: [] })}>{s}</Chip>
          ))}
        </div>
      </Section>

      {species.skillChoice && (
        <Section title={`Skill จาก ${c.species}: เลือก 1`}>
          <div className="flex flex-wrap gap-2">
            {speciesList.map((s) => (
              <Chip key={s} help={s} on={c.speciesSkill === s} disabled={owned('species').includes(s)}
                onClick={() => update({ speciesSkill: c.speciesSkill === s ? null : s, expertise: [] })}>{s}</Chip>
            ))}
          </div>
        </Section>
      )}

      {hasSkilled && (
        <Section title={`Feat Skilled: เลือก 3 (${c.skilledSkills.length}/3)`}>
          <div className="flex flex-wrap gap-2">
            {SKILLS.map((s) => (
              <Chip key={s} help={s} on={c.skilledSkills.includes(s)} disabled={owned('skilled').includes(s)}
                onClick={() => update({ skilledSkills: toggle(c.skilledSkills, s, 3), expertise: [] })}>{s}</Chip>
            ))}
          </div>
        </Section>
      )}

      {expertiseCount > 0 && (
        <Section title={`Expertise: เลือก ${expertiseCount} จาก Skill ที่มี (${c.expertise.length}/${expertiseCount})`}>
          <p className="mb-2 text-xs text-stone-400">Expertise = ได้ Proficiency Bonus 2 เท่าใน Skill นั้น</p>
          <div className="flex flex-wrap gap-2">
            {proficient.map((s) => (
              <Chip key={s} on={c.expertise.includes(s)} onClick={() => update({ expertise: toggle(c.expertise, s, expertiseCount) })}>{s}</Chip>
            ))}
          </div>
        </Section>
      )}
    </>
  )
}

function GearStep({ c, gear, setGear }: { c: CreationChoices; gear: { cls: number; bg: number }; setGear: (g: { cls: number; bg: number }) => void }) {
  const choice = (title: string, options: GearOption[], value: number, onPick: (i: number) => void) => (
    <Section title={title}>
      <div className="space-y-2">
        {options.map((o, i) => (
          <button key={o.label} type="button" onClick={() => onPick(i)} aria-pressed={value === i}
            className={`w-full rounded-lg border p-3 text-left text-sm ${value === i ? 'border-amber-400 bg-amber-950/60' : 'border-stone-700 bg-stone-900'}`}>
            <b>({o.label})</b> {gearOptionLine(o)}
          </button>
        ))}
      </div>
    </Section>
  )
  return (
    <>
      <p className="text-sm text-stone-400">เลือกอุปกรณ์เริ่มต้น (กติกา 2024): ชุดของ หรือรับเป็นเงิน GP ไว้ซื้อเอง · เกราะ/โล่จะถูกสวมให้และคำนวณ AC ให้ · อาวุธอยู่ในกระเป๋า กด "ถือ" ในหน้าตัวละครเพื่อใช้โจมตี</p>
      {choice(`${c.className}`, classGearOptions(c), gear.cls, (i) => setGear({ ...gear, cls: i }))}
      {choice(`${c.background} (Background)`, backgroundGearOptions(c.background), gear.bg, (i) => setGear({ ...gear, bg: i }))}
      <p className="text-xs text-stone-500">ของที่ต้องเลือกเอง (เช่น Musical Instrument, Holy Symbol, Gaming Set) จะถูกใส่ไว้ให้เปลี่ยนชื่อในหน้าแก้ไข · แพ็กจะถูกแกะเป็นของข้างใน</p>
    </>
  )
}

function ReviewStep({ c, character }: { c: CreationChoices; character: Character }) {
  const s = deriveSheet(character)
  return (
    <>
      <Section title={`${character.name} · ${c.className} 1`}>
        <p className="mb-3 text-sm text-stone-400">{character.species}{c.elfLineage ? ` (${c.elfLineage})` : ''} · {c.background} · Feat: {character.feats.join(', ')}</p>
        <div className="grid grid-cols-3 gap-2">
          <Stat label="HP" value={character.hp.max} />
          <Stat label="AC" value={character.ac} />
          <Stat label="Initiative" value={formatModifier(s.initiative)} />
        </div>
        <div className="mt-2 grid grid-cols-6 gap-1">
          {ABILITIES.map((a) => (
            <div key={a} className="rounded bg-stone-900 p-1 text-center">
              <div className="text-xs text-stone-400">{ABILITY_LABEL[a].short}</div>
              <div className="font-bold">{character.scores[a]}</div>
              <div className="text-xs">{formatModifier(s.modifiers[a])}</div>
            </div>
          ))}
        </div>
        <p className="mt-3 text-sm">
          <b>Skills:</b>{' '}
          {SKILLS.filter((k) => character.skills[k]).map((k) => `${k} ${formatModifier(s.skills[k])}${character.skills[k] === 'expertise' ? '★' : ''}`).join(', ')}
        </p>
        {s.spellSaveDC !== null && <p className="mt-1 text-sm"><b>Spell Save DC</b> {s.spellSaveDC} · <b>Spell Attack</b> {formatModifier(s.spellAttack ?? 0)}</p>}
      </Section>
      <Section title="ตรวจกติกา">
        <RuleMessages messages={checkCharacter(character)} />
        <p className="mt-2 text-xs text-stone-500">ของ {character.inventory.length} อย่าง · {character.coins.gp} GP · ความสามารถ: {character.features.map((f) => f.name).join(', ') || '—'} · เพิ่มคาถาได้ที่หน้าตัวละคร</p>
      </Section>
    </>
  )
}
