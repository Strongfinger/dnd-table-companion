// Checks the rules engine against Boom's paper sheet (Fighter 2).
import { describe, expect, it } from 'vitest'
import { abilityModifier } from './abilities'
import { attackBonus, initiativeBonus } from './combat'
import { boom } from './fixtures/boom'
import { CLASS_HIT_DIE, maxHitPoints, maxHitPointsFromRolls } from './hp'
import { proficiencyBonus } from './proficiency'
import { checkBonus, passiveScore, SKILL_ABILITY, type Skill } from './skills'
import { ABILITIES, type Ability } from './types'

const mod = (a: Ability) => abilityModifier(boom.scores[a])
const prof = proficiencyBonus(boom.level)

function saveBonus(a: Ability) {
  const proficient = (boom.saveProficiencies as readonly Ability[]).includes(a)
  return checkBonus(mod(a), proficient ? 'proficient' : 'none', prof)
}

function skillBonus(s: Skill) {
  const proficient = (boom.skillProficiencies as readonly Skill[]).includes(s)
  return checkBonus(mod(SKILL_ABILITY[s]), proficient ? 'proficient' : 'none', prof)
}

describe('Boom (Fighter 2)', () => {
  it('has proficiency bonus +2', () => {
    expect(prof).toBe(2)
  })

  it('has the right ability modifiers', () => {
    expect(ABILITIES.map(mod)).toEqual([3, 1, 2, -1, 0, 1])
  })

  it('has the right saving throws', () => {
    expect(ABILITIES.map(saveBonus)).toEqual([5, 1, 4, -1, 0, 1])
  })

  it('has the right proficient skills', () => {
    expect(skillBonus('Athletics')).toBe(5)
    expect(skillBonus('Insight')).toBe(2)
    expect(skillBonus('Intimidation')).toBe(3)
    expect(skillBonus('Persuasion')).toBe(3)
  })

  it('has Passive Perception 10', () => {
    expect(passiveScore(skillBonus('Perception'))).toBe(10)
  })

  it('has Initiative +6 with Alert', () => {
    expect(initiativeBonus(mod('dex'), 5)).toBe(6)
  })

  it('has Greatsword attack +5, damage 2d6+3', () => {
    expect(attackBonus(mod('str'), prof, true)).toBe(5)
    expect(boom.weapons[0].damage).toBe('2d6')
    expect(mod('str')).toBe(3) // damage modifier
    // AC (Chain Mail = 16) isn't checked yet: there's no armor rule in the engine.
  })

  it('matches the rolled max HP of 19', () => {
    const die = CLASS_HIT_DIE[boom.className]
    expect(maxHitPointsFromRolls(die, mod('con'), [...boom.hp.laterLevelRolls])).toBe(boom.hp.max)
    // Fixed HP would have given 20, which is why the sheet must store max HP.
    expect(maxHitPoints(die, boom.level, mod('con'))).toBe(20)
  })
})
