import { describe, expect, it } from 'vitest'
import { armorClass, type ArmorClassInput, type ArmorStats } from './armor'

const mods = (o: Partial<Record<'str' | 'dex' | 'con' | 'int' | 'wis' | 'cha', number>> = {}) => ({ str: 0, dex: 0, con: 0, int: 0, wis: 0, cha: 0, ...o })
const leather: ArmorStats = { name: 'Leather Armor', category: 'Light', base: 11, dexCap: null, strMin: 0, stealthDisadvantage: false }
const breastplate: ArmorStats = { name: 'Breastplate', category: 'Medium', base: 14, dexCap: 2, strMin: 0, stealthDisadvantage: false }
const plate: ArmorStats = { name: 'Plate Armor', category: 'Heavy', base: 18, dexCap: 0, strMin: 15, stealthDisadvantage: true }
const input = (o: Partial<ArmorClassInput>): ArmorClassInput => ({
  className: 'Fighter', subclass: '', level: 1, modifiers: mods(), strScore: 10, feats: [], armor: null, shield: false, ...o,
})

describe('Armor Class (2024)', () => {
  it('light armor adds all of DEX, medium up to +2, heavy none', () => {
    expect(armorClass(input({ className: 'Rogue', armor: leather, modifiers: mods({ dex: 3 }) })).ac).toBe(14)
    expect(armorClass(input({ armor: breastplate, modifiers: mods({ dex: 4 }) })).ac).toBe(16)
    expect(armorClass(input({ armor: plate, modifiers: mods({ dex: 4 }), strScore: 15 })).ac).toBe(18)
  })

  it('a trained Shield adds 2; an untrained one adds nothing', () => {
    expect(armorClass(input({ armor: plate, shield: true, strScore: 16 })).ac).toBe(20)
    const wizard = armorClass(input({ className: 'Wizard', shield: true, modifiers: mods({ dex: 2 }) }))
    expect(wizard).toMatchObject({ ac: 12, untrainedShield: true })
  })

  it('without armor: 10 + DEX, or Unarmored Defense, or Draconic Resilience, whichever is best', () => {
    expect(armorClass(input({ className: 'Wizard', modifiers: mods({ dex: 2 }) })).ac).toBe(12)
    // Barbarian: + CON, and a Shield still counts.
    expect(armorClass(input({ className: 'Barbarian', modifiers: mods({ dex: 2, con: 3 }), shield: true })).ac).toBe(17)
    // Monk: + WIS, but not with a Shield (and Monks have no Shield training).
    expect(armorClass(input({ className: 'Monk', modifiers: mods({ dex: 3, wis: 2 }) })).ac).toBe(15)
    expect(armorClass(input({ className: 'Monk', modifiers: mods({ dex: 3, wis: 2 }), shield: true })).ac).toBe(13)
    // Draconic Sorcery from level 3: + CHA.
    expect(armorClass(input({ className: 'Sorcerer', subclass: 'Draconic Sorcery', level: 3, modifiers: mods({ dex: 2, cha: 3 }) })).ac).toBe(15)
    expect(armorClass(input({ className: 'Sorcerer', subclass: 'Draconic Sorcery', level: 2, modifiers: mods({ dex: 2, cha: 3 }) })).ac).toBe(12)
  })

  it('Unarmored Defense stops when armor is worn', () => {
    expect(armorClass(input({ className: 'Barbarian', armor: leather, modifiers: mods({ dex: 2, con: 3 }) })).ac).toBe(13)
  })

  it('Defense adds 1 only while wearing armor; other bonuses always add', () => {
    expect(armorClass(input({ armor: leather, feats: ['Defense'] })).ac).toBe(12)
    expect(armorClass(input({ feats: ['Defense'] })).ac).toBe(10)
    expect(armorClass(input({ armor: leather, bonus: 1 })).ac).toBe(12)
  })

  it('reports Strength, Stealth and training drawbacks', () => {
    expect(armorClass(input({ armor: plate, strScore: 13 }))).toMatchObject({ speedPenalty: 10, stealthDisadvantage: true, untrainedArmor: false })
    expect(armorClass(input({ armor: plate, strScore: 15 })).speedPenalty).toBe(0)
    expect(armorClass(input({ className: 'Rogue', armor: breastplate })).untrainedArmor).toBe(true)
    expect(armorClass(input({ className: 'Wizard', armor: leather })).untrainedArmor).toBe(true)
    // A creature from a stat block is trained with any armor.
    expect(armorClass(input({ className: 'Wizard', armor: plate, monster: true, strScore: 18 })).untrainedArmor).toBe(false)
  })

  it('explains the number', () => {
    expect(armorClass(input({ className: 'Rogue', armor: leather, modifiers: mods({ dex: 3 }), shield: false })).formula).toBe('Leather Armor 11 DEX + 3')
  })
})
