import { describe, expect, it } from 'vitest'
import { CLASS_SAVES, CLASS_SPELLCASTING } from './classes'
import { CLASSES } from './types'

describe('CLASS_SAVES', () => {
  it('gives every class two different saves', () => {
    for (const c of CLASSES) expect(new Set(CLASS_SAVES[c]).size, c).toBe(2)
  })

  it('matches the class tables for all 12 classes', () => {
    expect(CLASS_SAVES).toEqual({
      Barbarian: ['str', 'con'], Bard: ['dex', 'cha'], Cleric: ['wis', 'cha'], Druid: ['int', 'wis'],
      Fighter: ['str', 'con'], Monk: ['str', 'dex'], Paladin: ['wis', 'cha'], Ranger: ['str', 'dex'],
      Rogue: ['dex', 'int'], Sorcerer: ['con', 'cha'], Warlock: ['wis', 'cha'], Wizard: ['int', 'wis'],
    })
  })
})

describe('CLASS_SPELLCASTING', () => {
  it('has no spellcasting for martial classes', () => {
    for (const c of ['Barbarian', 'Fighter', 'Monk', 'Rogue'] as const) expect(CLASS_SPELLCASTING[c], c).toBeNull()
  })

  it('uses the right ability for casters (2024: Paladin and Ranger cast from level 1)', () => {
    expect(CLASS_SPELLCASTING).toMatchObject({
      Bard: 'cha', Cleric: 'wis', Druid: 'wis', Paladin: 'cha', Ranger: 'wis',
      Sorcerer: 'cha', Warlock: 'cha', Wizard: 'int',
    })
  })
})
