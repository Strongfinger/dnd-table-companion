import { describe, expect, it } from 'vitest'
import { checkCharacter, type CheckInput } from './checks'
import { boom, hypenosz, marksuppp, petchyom } from './fixtures/characters'

const messages = (c: CheckInput) => checkCharacter(c).map((m) => `${m.level}: ${m.message}`)
const warnings = (c: CheckInput) => checkCharacter(c).filter((m) => m.level === 'warning')

describe('checkCharacter on the real sheets', () => {
  it('Boom (Human Fighter, Soldier, Alert) is legal', () => {
    expect(messages({ ...boom, subclass: '', feats: ['Savage Attacker', 'Alert'] })).toEqual([])
  })

  it('marksuppp (Human Rogue, Sage, 2 Expertise) is legal', () => {
    expect(messages({ ...marksuppp, subclass: '', feats: ['Magic Initiate', 'Savage Attacker'] })).toEqual([])
  })

  it('PetchYom (Dwarf Cleric, Acolyte) is legal', () => {
    expect(messages({ ...petchyom, subclass: '', feats: ['Magic Initiate'] })).toEqual([])
  })

  it('HypenosZ only gets an info note for the non-SRD Noble background', () => {
    const result = checkCharacter({ ...hypenosz, subclass: '', feats: [] })
    expect(result).toHaveLength(1)
    expect(result[0].level).toBe('info')
    expect(result[0].message).toContain('Noble')
  })
})

const fighter: CheckInput = {
  className: 'Fighter', level: 1, subclass: '', species: 'Dwarf', background: 'Soldier', feats: ['Savage Attacker'],
  scores: { str: 17, dex: 10, con: 16, int: 8, wis: 12, cha: 8 },
  saveProficiencies: ['str', 'con'],
  skills: { Athletics: 'proficient', Intimidation: 'proficient', Perception: 'proficient', Survival: 'proficient' },
  initiativeProficient: false,
}

describe('checkCharacter warnings', () => {
  it('a legal Dwarf Fighter has no messages', () => {
    expect(messages(fighter)).toEqual([])
  })

  it('subclass before level 3', () => {
    expect(warnings({ ...fighter, subclass: 'Champion' })[0].message).toContain('Level 3')
    expect(messages({ ...fighter, level: 3, subclass: 'Champion' })).toEqual([])
  })

  it('non-SRD subclass is info, not a warning', () => {
    const r = checkCharacter({ ...fighter, level: 3, subclass: 'Battle Master' })
    expect(r).toEqual([{ level: 'info', message: expect.stringContaining('Battle Master') }])
  })

  it('wrong saving throws', () => {
    expect(warnings({ ...fighter, saveProficiencies: ['str', 'dex'] })[0].message).toContain('STR, CON')
  })

  it('scores above 20 are info (possible at Barbarian 20 / Epic Boons), above 30 a warning', () => {
    expect(checkCharacter({ ...fighter, scores: { ...fighter.scores, str: 21 } })).toEqual([
      { level: 'info', message: expect.stringContaining('STR') },
    ])
    expect(warnings({ ...fighter, scores: { ...fighter.scores, str: 31 } })[0].message).toContain('30')
  })

  it('Expertise on a Fighter', () => {
    expect(warnings({ ...fighter, skills: { ...fighter.skills, Athletics: 'expertise' } })[0].message).toContain('Expertise')
  })

  it('a skill outside the class list', () => {
    const r = warnings({ ...fighter, skills: { ...fighter.skills, Survival: undefined, Arcana: 'proficient' } })
    expect(r.map((m) => m.message).join()).toContain('Arcana')
  })

  it('too many skills, and too few is just info', () => {
    expect(warnings({ ...fighter, skills: { ...fighter.skills, History: 'proficient' } })[0].message).toContain('5')
    expect(checkCharacter({ ...fighter, skills: { ...fighter.skills, Survival: undefined } })).toEqual([
      { level: 'info', message: expect.stringContaining('1') },
    ])
  })

  it('missing background skill', () => {
    const r = warnings({ ...fighter, skills: { ...fighter.skills, Intimidation: undefined, History: 'proficient' } })
    expect(r[0].message).toContain('Intimidation')
  })

  it('Human Skillful allows one skill from any list; Skilled allows 3 more', () => {
    const human = { ...fighter, species: 'Human', feats: ['Savage Attacker', 'Alert'], initiativeProficient: true }
    expect(messages({ ...human, skills: { ...fighter.skills, Arcana: 'proficient' } })).toEqual([])
    const skilled = { ...human, feats: ['Savage Attacker', 'Skilled'], initiativeProficient: false }
    expect(messages({ ...skilled, skills: { ...fighter.skills, Arcana: 'proficient', History: 'proficient', Nature: 'proficient', Religion: 'proficient' } })).toEqual([])
  })

  it('Alert feat without Initiative proficiency, and duplicate non-repeatable feats', () => {
    expect(warnings({ ...fighter, feats: ['Savage Attacker', 'Alert'] })[0].message).toContain('Alert')
    expect(warnings({ ...fighter, feats: ['Savage Attacker', 'Savage Attacker'] })[0].message).toContain('ซ้ำ')
  })
})

describe('checkCharacter at higher levels', () => {
  it('College of Lore Bard 3 has 3 extra skills of any kind', () => {
    const bard: CheckInput = {
      ...fighter, className: 'Bard', level: 3, subclass: 'College of Lore', saveProficiencies: ['dex', 'cha'], feats: ['Savage Attacker'],
      skills: {
        Athletics: 'proficient', Intimidation: 'proficient', Arcana: 'proficient', History: 'proficient', Nature: 'proficient',
        Religion: 'proficient', Medicine: 'proficient', Stealth: 'proficient',
      },
    }
    expect(messages(bard)).toEqual([])
    expect(messages({ ...bard, subclass: 'college of lore ' })).toEqual([])
  })

  it('Barbarian 3 gets one more skill from its list (Primal Knowledge)', () => {
    const barbarian: CheckInput = {
      ...fighter, className: 'Barbarian', level: 3, saveProficiencies: ['str', 'con'],
      skills: { ...fighter.skills, Nature: 'proficient' },
    }
    expect(messages(barbarian)).toEqual([])
  })

  it('Monk 14 is proficient in every save; Rogue 15 adds WIS and CHA', () => {
    const monk = { ...fighter, className: 'Monk' as const, level: 14, saveProficiencies: ['str', 'dex', 'con', 'int', 'wis', 'cha'] as const }
    expect(warnings({ ...monk, saveProficiencies: [...monk.saveProficiencies] }).filter((m) => m.message.includes('Saving'))).toEqual([])
    const rogue = { ...fighter, className: 'Rogue' as const, level: 15, saveProficiencies: ['dex', 'int', 'wis', 'cha'] as ('dex' | 'int' | 'wis' | 'cha')[] }
    expect(warnings(rogue).filter((m) => m.message.includes('Saving'))).toEqual([])
    expect(warnings({ ...rogue, level: 14 }).filter((m) => m.message.includes('Saving'))).toHaveLength(1)
  })

  it('Wizard 2 may have 1 Expertise (Scholar)', () => {
    const wizard = { ...fighter, className: 'Wizard' as const, level: 2, saveProficiencies: ['int', 'wis'] as ('int' | 'wis')[] }
    const withExpertise = { ...wizard, skills: { ...wizard.skills, Athletics: 'expertise' as const } }
    expect(warnings(withExpertise).filter((m) => m.message.includes('Expertise'))).toEqual([])
    expect(warnings({ ...withExpertise, level: 1 }).filter((m) => m.message.includes('Expertise'))).toHaveLength(1)
  })
})
