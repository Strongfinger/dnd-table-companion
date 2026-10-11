import { describe, expect, it } from 'vitest'
import { CLASS_INFO, maxExpertise, unarmoredAC } from './classes'
import { SKILLS } from './skills'
import { BACKGROUND_INFO, BACKGROUNDS } from './srd/backgrounds'
import { ORIGIN_FEATS } from './srd/feats'
import { SPECIES_INFO } from './srd/species'
import { CLASSES } from './types'

describe('CLASS_INFO', () => {
  it('only lists real skills, enough to choose from', () => {
    for (const c of CLASSES) {
      const { skillChoices, skillCount } = CLASS_INFO[c]
      const list = skillChoices === 'any' ? SKILLS : skillChoices
      for (const s of list) expect(SKILLS, `${c}: ${s}`).toContain(s)
      expect(list.length, c).toBeGreaterThan(skillCount)
    }
  })

  it('has the 2024 skill counts', () => {
    expect(CLASS_INFO.Rogue.skillCount).toBe(4)
    expect(CLASS_INFO.Bard.skillCount).toBe(3)
    expect(CLASS_INFO.Ranger.skillCount).toBe(3)
    expect(CLASS_INFO.Fighter.skillCount).toBe(2)
    expect(CLASS_INFO.Bard.skillChoices).toBe('any')
  })

  it('Fighter (2024) can pick Persuasion', () => {
    expect(CLASS_INFO.Fighter.skillChoices).toContain('Persuasion')
  })
})

describe('maxExpertise', () => {
  it('follows Rogue, Bard and Ranger levels', () => {
    expect(maxExpertise('Rogue', 1)).toBe(2)
    expect(maxExpertise('Rogue', 6)).toBe(4)
    expect(maxExpertise('Bard', 1)).toBe(0)
    expect(maxExpertise('Bard', 2)).toBe(2)
    expect(maxExpertise('Bard', 9)).toBe(4)
    expect(maxExpertise('Ranger', 2)).toBe(1)
    expect(maxExpertise('Ranger', 9)).toBe(3)
    expect(maxExpertise('Fighter', 20)).toBe(0)
  })
})

describe('unarmoredAC', () => {
  const mods = { str: 0, dex: 2, con: 3, int: 0, wis: 1, cha: 0 }
  it('is 10 + Dex, with Barbarian (+Con) and Monk (+Wis) versions', () => {
    expect(unarmoredAC('Wizard', mods)).toBe(12)
    expect(unarmoredAC('Barbarian', mods)).toBe(15)
    expect(unarmoredAC('Monk', mods)).toBe(13)
  })

  it('matches PetchYom (Cleric, Dex 8, no armor): AC 9', () => {
    expect(unarmoredAC('Cleric', { str: 2, dex: -1, con: 2, int: 1, wis: 3, cha: 0 })).toBe(9)
  })
})

describe('SRD backgrounds and species', () => {
  it('backgrounds give 2 real skills, 3 distinct abilities and an Origin feat', () => {
    for (const b of BACKGROUNDS) {
      const info = BACKGROUND_INFO[b]
      expect(new Set(info.abilities).size, b).toBe(3)
      for (const s of info.skills) expect(SKILLS).toContain(s)
      expect(ORIGIN_FEATS).toContain(info.feat)
    }
  })

  it('matches the real sheets: Soldier, Sage, Acolyte skills', () => {
    expect(BACKGROUND_INFO.Soldier.skills).toEqual(['Athletics', 'Intimidation'])
    expect(BACKGROUND_INFO.Sage.skills).toEqual(['Arcana', 'History'])
    expect(BACKGROUND_INFO.Acolyte.skills).toEqual(['Insight', 'Religion'])
  })

  it('Dwarf gets +1 HP per level, Goliath is fast, Human gets an extra skill and feat', () => {
    expect(SPECIES_INFO.Dwarf.hpPerLevel).toBe(1)
    expect(SPECIES_INFO.Goliath.speed).toBe(35)
    expect(SPECIES_INFO.Human.skillChoice).toBe('any')
    expect(SPECIES_INFO.Human.extraOriginFeat).toBe(true)
  })
})
