import { describe, expect, it } from 'vitest'
import { deriveSheet, formatDamage, type SheetInput } from './sheet'

describe('formatDamage', () => {
  it('adds the modifier to dice', () => {
    expect(formatDamage('2d6', 3)).toBe('2d6+3')
    expect(formatDamage('1d4', -1)).toBe('1d4-1')
    expect(formatDamage('1d6', 0)).toBe('1d6')
  })

  it('adds flat damage (Unarmed Strike) and never goes below 0', () => {
    expect(formatDamage('1', 3)).toBe('4')
    expect(formatDamage('1', -2)).toBe('0')
    expect(formatDamage('1', -5)).toBe('0') // Str 1
  })
})

const base: SheetInput = {
  className: 'Wizard',
  level: 5,
  scores: { str: 8, dex: 14, con: 12, int: 18, wis: 10, cha: 10 },
  saveProficiencies: ['int', 'wis'],
  skills: { Arcana: 'proficient' },
  initiativeProficient: false,
  initiativeMisc: 0,
  spellcastingAbility: 'int',
  attacks: [],
}

describe('deriveSheet', () => {
  it('computes a level 5 Wizard', () => {
    const s = deriveSheet(base)
    expect(s.proficiencyBonus).toBe(3)
    expect(s.saves.int).toBe(7)
    expect(s.saves.str).toBe(-1)
    expect(s.skills.Arcana).toBe(7)
    expect(s.spellSaveDC).toBe(15)
    expect(s.spellAttack).toBe(7)
    expect(s.suggestedMaxHp).toBe(6 + 1 + 4 * (4 + 1)) // 27
  })

  it('Alert adds proficiency bonus to Initiative, plus misc bonuses', () => {
    expect(deriveSheet(base).initiative).toBe(2)
    expect(deriveSheet({ ...base, initiativeProficient: true }).initiative).toBe(5)
    expect(deriveSheet({ ...base, initiativeProficient: true, initiativeMisc: -1 }).initiative).toBe(4)
  })

  it('has no spell DC without a spellcasting ability', () => {
    const s = deriveSheet({ ...base, spellcastingAbility: null })
    expect(s.spellSaveDC).toBeNull()
    expect(s.spellAttack).toBeNull()
  })

  it('adds proficiency to attacks only when proficient', () => {
    const s = deriveSheet({
      ...base,
      attacks: [
        { id: 'a', name: 'Dagger', ability: 'dex', proficient: true, damageDice: '1d4', damageType: 'piercing', addModToDamage: true },
        { id: 'b', name: 'Greataxe', ability: 'str', proficient: false, damageDice: '1d12', damageType: 'slashing', addModToDamage: true },
      ],
    })
    expect(s.attacks[0]).toMatchObject({ hit: 5, damage: '1d4+2' })
    expect(s.attacks[1]).toMatchObject({ hit: -1, damage: '1d12-1' })
  })

  it('off-hand attacks skip a positive modifier but keep a negative one', () => {
    const offHand = { id: 'o', name: 'Dagger', ability: 'dex' as const, proficient: true, damageDice: '1d4', damageType: 'piercing', addModToDamage: false }
    expect(deriveSheet({ ...base, attacks: [offHand] }).attacks[0].damage).toBe('1d4')
    const clumsy = { ...base, scores: { ...base.scores, dex: 8 }, attacks: [offHand] }
    expect(deriveSheet(clumsy).attacks[0].damage).toBe('1d4-1')
  })
})
