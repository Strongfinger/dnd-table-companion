// Builds a new level 1 Character from the creation wizard's choices (2024 rules).
// Pure function: the wizard collects choices, this does the assembly, tests check it.
import {
  abilityModifier, applyBonus, BACKGROUND_INFO, CLASS_SPELLCASTING, classSavesAtLevel, ELF_LINEAGES, FEAT_INFO, maxExpertise,
  SPECIES_INFO, spellSlotsFor, suggestedMaxHp, unarmoredAC, ABILITIES,
  type Ability, type BackgroundBonus, type BackgroundName, type ClassName, type ElfLineage, type OriginFeat,
  type ProficiencyLevel, type Skill, type SpeciesName,
} from '../rules'
import { createCharacter, type Character } from './character'

export interface CreationChoices {
  name: string
  player: string
  className: ClassName
  species: SpeciesName
  elfLineage: ElfLineage | null
  background: BackgroundName
  bonus: BackgroundBonus
  /** Point Buy scores before the background bonus. */
  baseScores: Record<Ability, number>
  /** Human Versatile: the extra Origin feat. */
  humanFeat: OriginFeat | null
  /** Ability for Magic Initiate spells when the class itself has no Spellcasting. */
  magicInitiateAbility: 'int' | 'wis' | 'cha' | null
  classSkills: Skill[]
  /** Human Skillful (any skill) or Elf Keen Senses (Insight/Perception/Survival). */
  speciesSkill: Skill | null
  /** Skilled feat: 3 extra skills. */
  skilledSkills: Skill[]
  expertise: Skill[]
}

export function featsFor(c: Pick<CreationChoices, 'background' | 'humanFeat'>): OriginFeat[] {
  const feats: OriginFeat[] = [BACKGROUND_INFO[c.background].feat]
  if (c.humanFeat) feats.push(c.humanFeat)
  return feats
}

export function buildCharacter(c: CreationChoices): Character {
  const bg = BACKGROUND_INFO[c.background]
  const species = SPECIES_INFO[c.species]
  const lineage = c.species === 'Elf' && c.elfLineage ? ELF_LINEAGES[c.elfLineage] : null
  const scores = applyBonus(c.baseScores, c.bonus)
  const mods = Object.fromEntries(ABILITIES.map((a) => [a, abilityModifier(scores[a])])) as Record<Ability, number>
  const feats = featsFor(c)

  // Ignore leftover picks from choices the player changed later in the wizard.
  const skilled = feats.includes('Skilled') ? c.skilledSkills : []
  const speciesSkill = species.skillChoice ? c.speciesSkill : null
  const skills: Partial<Record<Skill, ProficiencyLevel>> = {}
  for (const s of [...bg.skills, ...c.classSkills, ...skilled]) skills[s] = 'proficient'
  if (speciesSkill) skills[speciesSkill] = 'proficient'
  // Expertise only on skills the character is actually proficient in.
  for (const s of c.expertise.slice(0, maxExpertise(c.className, 1))) if (skills[s]) skills[s] = 'expertise'

  const classCasting = CLASS_SPELLCASTING[c.className]
  const casting = classCasting ?? (feats.includes('Magic Initiate') ? c.magicInitiateAbility : null)
  const base = { className: c.className, level: 1, scores, species: c.species }
  const hpMax = suggestedMaxHp(base)
  const darkvision = lineage?.darkvision ?? species.darkvision
  const speciesName = lineage ? `${c.species} (${c.elfLineage})` : c.species

  const featLines = feats.map((f) => {
    const list = f === 'Magic Initiate' && feats.indexOf(f) === 0 && bg.featNote ? ` (${bg.featNote})` : ''
    return `• ${f}${list}: ${FEAT_INFO[f].descriptionTh}`
  })

  return createCharacter({
    name: c.name.trim(),
    player: c.player.trim(),
    className: c.className,
    level: 1,
    species: c.species,
    background: c.background,
    feats,
    scores,
    saveProficiencies: classSavesAtLevel(c.className, 1),
    skills,
    initiativeProficient: feats.includes('Alert'),
    spellcastingAbility: casting,
    hp: { max: hpMax, current: hpMax, temp: 0 },
    ac: unarmoredAC(c.className, mods),
    acAuto: true,
    speed: lineage?.speed ?? species.speed,
    spellSlots: spellSlotsFor(c.className, 1).map((max) => ({ max, used: 0 })),
    featuresText: [
      `${speciesName}: ${species.traits.join(', ')}`,
      darkvision ? `Darkvision ${darkvision} ft.` : '',
      ...featLines,
      // The sheet has one spellcasting ability; Magic Initiate may use a different one.
      classCasting && feats.includes('Magic Initiate')
        ? 'Magic Initiate: เลือก INT, WIS หรือ CHA สำหรับคาถาจาก Feat (อาจต่างจากของ Class)'
        : '',
    ].filter(Boolean).join('\n'),
    proficienciesText: `เครื่องมือ: ${bg.tool}\nภาษา: Common + อีก 2 ภาษา (เลือกกับ DM)`,
    notes: '',
  })
}
