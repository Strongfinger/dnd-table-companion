import { describe, expect, it } from 'vitest'
import { createCharacter } from './character'
import { featPicksOf, featSlotViews, featWarnings, increaseProblem, missingLevelChoices, setFeatPick } from './feats'
import { parseCharacterImport, exportCharacter } from './io'

const fighter = (o = {}) => createCharacter({
  name: 'Bram', className: 'Fighter', level: 4, species: 'Human', background: 'Soldier',
  scores: { str: 16, dex: 12, con: 14, int: 10, wis: 10, cha: 8 }, ...o,
})

describe('feat slots on a character', () => {
  it('places an older sheet\'s feats into slots once', () => {
    const c = fighter({ feats: ['Savage Attacker', 'Alert', 'Defense'] })
    expect(featPicksOf(c)).toEqual([
      { slot: 'background', feat: 'Savage Attacker' },
      { slot: 'species', feat: 'Alert' },
      { slot: 'fighting-style-1', feat: 'Defense' },
    ])
    expect(featWarnings(c)).toEqual(['ยังไม่ได้เลือก: Ability Score Improvement (Level 4)'])
  })

  it('Ability Score Improvement adds to scores and is taken back when changed or removed', () => {
    let c = setFeatPick(fighter({ feats: [] }), 'asi-4', 'Ability Score Improvement', { str: 2 })
    expect(c.scores.str).toBe(18)
    expect(c.feats).toEqual(['Ability Score Improvement'])
    c = setFeatPick(c, 'asi-4', 'Ability Score Improvement', { str: 1, con: 1 })
    expect([c.scores.str, c.scores.con]).toEqual([17, 15])
    c = setFeatPick(c, 'asi-4', null)
    expect([c.scores.str, c.scores.con]).toEqual([16, 14])
    expect(c.featPicks).toEqual([])
  })

  it('typed non-SRD feats fill a slot; Alert turns Initiative proficiency on and off', () => {
    let c = setFeatPick(fighter({ feats: [] }), 'asi-4', 'Tough')
    expect(featSlotViews(c).slots.find((s) => s.slot.id === 'asi-4')?.pick?.feat).toBe('Tough')
    c = setFeatPick(c, 'species', 'alert')
    expect(c).toMatchObject({ initiativeProficient: true, feats: ['Tough', 'Alert'] })
    c = setFeatPick(c, 'species', 'Skilled')
    expect(c.initiativeProficient).toBe(false)
  })

  it('checks increases against the feat\'s rule', () => {
    const s = fighter().scores
    expect(increaseProblem('Ability Score Improvement', { str: 2 }, s)).toBeNull()
    expect(increaseProblem('Ability Score Improvement', { str: 1 }, s)).toBe('Ability Score Improvement: เพิ่มได้รวม 2 แต้ม')
    expect(increaseProblem('Ability Score Improvement', { str: 2 }, { ...s, str: 19 })).toBe('Ability Score Improvement: ค่า Ability สูงสุด 20')
    expect(increaseProblem('Grappler', { con: 1 }, s)).toBe('Grappler: เพิ่มได้เฉพาะ STR/DEX')
    expect(increaseProblem('Boon of Fate', { str: 1, dex: 1 }, s)).toBe('Boon of Fate: เพิ่มได้รวม 1 แต้ม')
    expect(increaseProblem('Tough', undefined, s)).toBeNull()
  })

  it('warns about a feat in the wrong kind of slot or twice', () => {
    let c = setFeatPick(fighter({ feats: [] }), 'background', 'Grappler')
    c = setFeatPick(c, 'asi-4', 'Grappler', { str: 1 })
    expect(featWarnings(c)).toEqual(expect.arrayContaining(['Grappler ไม่ใช่ Origin Feat', 'Grappler เลือกซ้ำไม่ได้']))
  })

  it('picks survive export and import', () => {
    const c = setFeatPick(fighter({ feats: [] }), 'asi-4', 'Ability Score Improvement', { str: 1, dex: 1 })
    const back = parseCharacterImport(exportCharacter(c))
    expect(back.ok && back.character.featPicks).toEqual(c.featPicks)
  })

  it('adds only what fits under the maximum and takes back exactly that', () => {
    const c = fighter({ feats: [], scores: { str: 19, dex: 12, con: 14, int: 10, wis: 10, cha: 8 } })
    const up = setFeatPick(c, 'asi-4', 'Ability Score Improvement', { str: 2 })
    expect(up.scores.str).toBe(20)
    expect(up.featPicks?.[0].increase).toEqual({ str: 1 })
    expect(setFeatPick(up, 'asi-4', null).scores.str).toBe(19)
  })

  it('warns about prerequisites: Fighting Style feature, Grappler STR/DEX 13', () => {
    const barb = createCharacter({ name: 'B', className: 'Barbarian', level: 4, scores: { str: 12, dex: 12, con: 14, int: 10, wis: 10, cha: 8 } })
    expect(featWarnings(setFeatPick(barb, 'asi-4', 'Archery'))).toContain('Archery: ต้องมี Fighting Style ของ Class')
    expect(featWarnings(setFeatPick(barb, 'asi-4', 'Grappler', { str: 1 }))).toContain('Grappler: ต้องมี STR หรือ DEX 13+')
  })
})

describe('missing subclass / ASI on the sheet', () => {
  it('uses the feat picks (also on older sheets) and skips monsters', () => {
    expect(missingLevelChoices(fighter()).map((m) => m.kind)).toEqual(['subclass', 'asi'])
    const done = setFeatPick(fighter({ subclass: 'Champion' }), 'asi-4', 'Ability Score Improvement', { str: 2 })
    expect(missingLevelChoices(done)).toEqual([])
    // Older sheet with feat names only: the third feat fills the level 4 slot.
    expect(missingLevelChoices(fighter({ subclass: 'Champion', feats: ['Alert', 'Skilled', 'Defense', 'Grappler'] }))).toEqual([])
    expect(missingLevelChoices({ ...fighter(), monster: { cr: 1, pb: 2, hitDie: 8, source: 'x' } })).toEqual([])
  })
})
