// Rule checks for a character. Returns Thai messages instead of blocking, so the DM
// can still allow homebrew. 'warning' = probably breaks a rule, 'info' = just so you know.
import { CLASS_INFO, classSavesAtLevel, isSrdSubclass, laterClassSkills, maxExpertise, SUBCLASS_LEVEL } from './classes'
import { BACKGROUND_INFO, isSrdBackground } from './srd/backgrounds'
import { FEAT_INFO, featSkillCount, ORIGIN_FEATS, type OriginFeat } from './srd/feats'
import { isSrdSpecies, SPECIES_INFO } from './srd/species'
import { SKILLS, type Skill } from './skills'
import { ABILITIES, type Ability, type ClassName, type ProficiencyLevel } from './types'

export interface CheckInput {
  className: ClassName
  level: number
  subclass: string
  species: string
  background: string
  feats: string[]
  scores: Record<Ability, number>
  saveProficiencies: Ability[]
  skills: Partial<Record<Skill, ProficiencyLevel>>
  initiativeProficient: boolean
}

export interface RuleMessage {
  level: 'warning' | 'info'
  message: string
}

/** Skills granted for free (background), and the skills a class may choose from. */
export function skillSources(c: Pick<CheckInput, 'className' | 'background'>) {
  const info = CLASS_INFO[c.className]
  const classChoices: readonly Skill[] = info.skillChoices === 'any' ? SKILLS : info.skillChoices
  const backgroundSkills: readonly Skill[] = isSrdBackground(c.background) ? BACKGROUND_INFO[c.background].skills : []
  return { classChoices, classCount: info.skillCount, backgroundSkills }
}

export function checkCharacter(c: CheckInput): RuleMessage[] {
  const out: RuleMessage[] = []
  const warn = (message: string) => out.push({ level: 'warning', message })
  const info = (message: string) => out.push({ level: 'info', message })

  // Subclass
  if (c.subclass.trim()) {
    if (c.level < SUBCLASS_LEVEL) warn(`Subclass เลือกได้ตั้งแต่ Level ${SUBCLASS_LEVEL}`)
    if (!isSrdSubclass(c.className, c.subclass)) info(`Subclass "${c.subclass}" ไม่อยู่ใน SRD (Homebrew / หนังสืออื่น)`)
  }

  // Species and background outside the SRD can't be checked further.
  const srdSpecies = isSrdSpecies(c.species)
  const srdBackground = isSrdBackground(c.background)
  if (c.species.trim() && !srdSpecies) info(`Species "${c.species}" ไม่อยู่ใน SRD จึงตรวจกติกาบางส่วนไม่ได้`)
  if (c.background.trim() && !srdBackground) info(`Background "${c.background}" ไม่อยู่ใน SRD จึงตรวจกติกาบางส่วนไม่ได้`)

  // Ability scores
  for (const a of ABILITIES) {
    // Above 20 is possible (Barbarian 20, Epic Boons, magic items), above 30 never is.
    if (c.scores[a] > 30) warn(`${a.toUpperCase()} เกิน 30 ไม่ได้`)
    else if (c.scores[a] > 20) info(`${a.toUpperCase()} เกิน 20 ได้เฉพาะจาก Feature พิเศษหรือไอเทมเวท`)
  }

  // Saving throws come from the class.
  const classSaves = classSavesAtLevel(c.className, c.level)
  const savesMatch = c.saveProficiencies.length === classSaves.length && classSaves.every((a) => c.saveProficiencies.includes(a))
  if (!savesMatch) warn(`Saving Throw ของ ${c.className} คือ ${classSaves.map((a) => a.toUpperCase()).join(', ')}`)

  // Expertise
  const skills = Object.entries(c.skills).filter(([, p]) => p && p !== 'none') as [Skill, ProficiencyLevel][]
  const expertiseCount = skills.filter(([, p]) => p === 'expertise').length
  const allowedExpertise = maxExpertise(c.className, c.level)
  if (expertiseCount > allowedExpertise) {
    warn(allowedExpertise === 0
      ? `${c.className} Level ${c.level} ยังไม่มี Expertise`
      : `${c.className} Level ${c.level} มี Expertise ได้ ${allowedExpertise} อย่าง (ตอนนี้ ${expertiseCount})`)
  }

  // Feats
  const feats = c.feats.filter((f): f is OriginFeat => (ORIGIN_FEATS as readonly string[]).includes(f))
  for (const f of new Set(feats)) {
    if (!FEAT_INFO[f].repeatable && feats.filter((x) => x === f).length > 1) warn(`Feat "${f}" เลือกซ้ำไม่ได้`)
  }
  if (feats.includes('Alert') && !c.initiativeProficient) warn('มี Feat Alert แต่ยังไม่ได้ติ๊ก Alert ใน Initiative')

  // Skills: only checkable when species and background are SRD.
  const { classChoices, classCount, backgroundSkills } = skillSources(c)
  const proficient = skills.map(([s]) => s)
  if (srdBackground) {
    const missing = backgroundSkills.filter((s) => !proficient.includes(s))
    if (missing.length) warn(`Background ${c.background} ให้ Skill: ${missing.join(', ')}`)
  }
  if (srdSpecies && srdBackground) {
    const speciesInfo = SPECIES_INFO[c.species as keyof typeof SPECIES_INFO]
    const speciesList = Array.isArray(speciesInfo.skillChoice) ? speciesInfo.skillChoice : []
    const featSkills = c.feats.reduce((n, f) => n + featSkillCount(f), 0)
    const later = laterClassSkills(c.className, c.subclass, c.level)
    // Skills that may be any skill at all: Human Skillful, the Skilled feat, College of Lore.
    const anySkillSlots = (speciesInfo.skillChoice === 'any' ? 1 : 0) + featSkills + later.any
    const expected =
      classCount + later.fromClassList + backgroundSkills.length + (speciesInfo.skillChoice ? 1 : 0) + featSkills + later.any

    const outside = proficient.filter((s) => !classChoices.includes(s) && !backgroundSkills.includes(s) && !speciesList.includes(s))
    if (outside.length > anySkillSlots) {
      warn(`Skill ที่ไม่อยู่ในรายการของ ${c.className}: ${outside.join(', ')}`)
    }
    if (proficient.length > expected) warn(`มี Skill ${proficient.length} อย่าง แต่กติกาให้ ${expected} อย่าง`)
    else if (proficient.length < expected && !c.feats.includes('Skilled')) info(`ยังเลือก Skill ได้อีก ${expected - proficient.length} อย่าง`)
  }

  return out
}
