import { describe, expect, it } from 'vitest'
import { SKILLS, SKILL_ABILITY, checkBonus, passiveScore } from './skills'

describe('SKILL_ABILITY', () => {
  it('has the 18 SRD skills', () => {
    expect(SKILLS).toHaveLength(18)
  })

  it('maps skills to the right ability', () => {
    expect(SKILL_ABILITY['Athletics']).toBe('str')
    expect(SKILL_ABILITY['Stealth']).toBe('dex')
    expect(SKILL_ABILITY['Arcana']).toBe('int')
    expect(SKILL_ABILITY['Perception']).toBe('wis')
    expect(SKILL_ABILITY['Persuasion']).toBe('cha')
  })
})

describe('checkBonus', () => {
  it('adds proficiency only when proficient', () => {
    expect(checkBonus(2, 'none', 3)).toBe(2)
    expect(checkBonus(2, 'proficient', 3)).toBe(5)
  })

  it('doubles proficiency with Expertise', () => {
    // Level 5 Rogue, Dex 18 (+4), Expertise in Stealth: 4 + 2×3 = 10
    expect(checkBonus(4, 'expertise', 3)).toBe(10)
  })

  it('works with negative modifiers', () => {
    expect(checkBonus(-1, 'proficient', 2)).toBe(1)
  })
})

describe('passiveScore', () => {
  it('is 10 + bonus', () => {
    expect(passiveScore(3)).toBe(13)
  })

  it('applies ±5 for advantage/disadvantage', () => {
    expect(passiveScore(3, 'advantage')).toBe(18)
    expect(passiveScore(3, 'disadvantage')).toBe(8)
  })
})
