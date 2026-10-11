import { describe, expect, it } from 'vitest'
import { checkCharacter, deriveSheet } from '../rules'
import { buildCharacter, type CreationChoices } from './create'

// Rebuild Boom the way the wizard would: Human Fighter, Soldier, Alert.
const boomChoices: CreationChoices = {
  name: ' Boom ',
  player: '',
  className: 'Fighter',
  species: 'Human',
  elfLineage: null,
  background: 'Soldier',
  bonus: { str: 2, con: 1 },
  baseScores: { str: 15, dex: 13, con: 13, int: 8, wis: 10, cha: 13 }, // 9+5+5+0+2+5 = 26 points
  humanFeat: 'Alert',
  magicInitiateAbility: null,
  classSkills: ['Insight', 'Persuasion'],
  speciesSkill: 'Perception',
  skilledSkills: [],
  expertise: [],
}

describe('buildCharacter', () => {
  it('rebuilds Boom with the right scores, skills, feats and numbers', () => {
    const c = buildCharacter(boomChoices)
    expect(c.name).toBe('Boom')
    expect(c.scores).toEqual({ str: 17, dex: 13, con: 14, int: 8, wis: 10, cha: 13 })
    expect(c.feats).toEqual(['Savage Attacker', 'Alert'])
    expect(c.saveProficiencies).toEqual(['str', 'con'])
    expect(Object.keys(c.skills).sort()).toEqual(['Athletics', 'Insight', 'Intimidation', 'Perception', 'Persuasion'])
    expect(deriveSheet(c).initiative).toBe(3) // Dex +1, Alert +2
    expect(c.hp.max).toBe(12)
    expect(c.ac).toBe(11) // unarmored until armor is added
    expect(checkCharacter(c)).toEqual([])
  })

  it('Dwarf gets +1 HP, 120 ft. Darkvision; Barbarian uses Unarmored Defense', () => {
    const c = buildCharacter({
      ...boomChoices, className: 'Barbarian', species: 'Dwarf', humanFeat: null, speciesSkill: null,
      classSkills: ['Perception', 'Survival'],
    })
    expect(c.hp.max).toBe(12 + 2 + 1) // d12 + Con 14 (+2) + Dwarven Toughness
    expect(c.ac).toBe(10 + 1 + 2) // 10 + Dex + Con
    expect(c.featuresText).toContain('Darkvision 120 ft.')
    expect(checkCharacter(c)).toEqual([])
  })

  it('Wood Elf is 35 ft.; Keen Senses skill is added', () => {
    const c = buildCharacter({
      ...boomChoices, className: 'Ranger', species: 'Elf', elfLineage: 'Wood Elf', humanFeat: null,
      classSkills: ['Stealth', 'Nature', 'Animal Handling'], speciesSkill: 'Survival',
    })
    expect(c.speed).toBe(35)
    expect(c.skills.Survival).toBe('proficient')
    expect(c.spellcastingAbility).toBe('wis')
    expect(checkCharacter(c)).toEqual([])
  })

  it('a Rogue with Sage gets Magic Initiate with the chosen ability and 2 Expertise', () => {
    const c = buildCharacter({
      ...boomChoices, className: 'Rogue', background: 'Sage', bonus: { int: 1, wis: 1, con: 1 }, humanFeat: 'Skilled',
      magicInitiateAbility: 'wis', classSkills: ['Stealth', 'Sleight of Hand', 'Insight', 'Perception'],
      speciesSkill: 'Persuasion', skilledSkills: ['Athletics', 'Medicine', 'Nature'], expertise: ['Stealth', 'Sleight of Hand'],
    })
    expect(c.spellcastingAbility).toBe('wis')
    expect(c.skills.Stealth).toBe('expertise')
    expect(c.featuresText).toContain('Magic Initiate (Wizard)')
    expect(checkCharacter(c)).toEqual([])
  })

  it('ignores stale wizard picks: Skilled skills without the feat, Expertise on non-proficient skills', () => {
    const c = buildCharacter({
      ...boomChoices, className: 'Rogue', species: 'Elf', elfLineage: 'Drow', humanFeat: null,
      classSkills: ['Stealth', 'Acrobatics', 'Insight', 'Investigation'], speciesSkill: 'Perception',
      skilledSkills: ['Arcana', 'History', 'Nature'], expertise: ['Arcana', 'Stealth'],
    })
    expect(c.skills.Arcana).toBeUndefined()
    expect(c.skills.Stealth).toBe('expertise')
    expect(c.featuresText).toContain('Darkvision 120 ft.')
    expect(checkCharacter(c)).toEqual([])
  })

  it('Criminal gives Alert → Initiative + proficiency', () => {
    const c = buildCharacter({ ...boomChoices, background: 'Criminal', bonus: { dex: 2, con: 1 }, humanFeat: 'Skilled', skilledSkills: ['Arcana', 'History', 'Nature'] })
    expect(c.feats).toEqual(['Alert', 'Skilled'])
    expect(deriveSheet(c).initiative).toBe(4) // Dex 13+2=15 (+2), Alert +2
  })

  it('a Cleric with Magic Initiate keeps WIS and gets a note to pick the feat ability', () => {
    const c = buildCharacter({ ...boomChoices, className: 'Cleric', background: 'Acolyte', bonus: { wis: 2, cha: 1 }, humanFeat: null, classSkills: ['Medicine', 'History'] })
    expect(c.spellcastingAbility).toBe('wis')
    expect(c.featuresText).toContain('Magic Initiate: เลือก INT, WIS หรือ CHA')
  })

  it('Monk uses Unarmored Defense with WIS', () => {
    const c = buildCharacter({ ...boomChoices, className: 'Monk', humanFeat: null, classSkills: ['Acrobatics', 'Stealth'], baseScores: { str: 8, dex: 15, con: 13, int: 8, wis: 15, cha: 8 } })
    expect(c.ac).toBe(10 + 2 + 2)
  })
})
