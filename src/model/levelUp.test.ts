import { describe, expect, it } from 'vitest'
import { createCharacter } from './character'
import { setFeatPick } from './feats'
import { finishLevelUp, hpGain, levelUpDraft, levelUpInfo } from './levelUp'
import { loadFeatureTexts } from './featureTexts'
import { withAllCatalogFeatures } from './featureCatalog'

const make = (o = {}) => createCharacter({
  name: 'X', className: 'Fighter', level: 4, species: 'Human', subclass: 'Champion',
  scores: { str: 16, dex: 12, con: 14, int: 10, wis: 10, cha: 8 }, hp: { max: 36, current: 30, temp: 0 }, ...o,
})

describe('level up (2024)', () => {
  it('HP: die (rolled or fixed) + CON, at least 1', () => {
    const c = make()
    expect(hpGain(c, levelUpDraft(c), 6)).toBe(8) // fixed d10 = 6, CON +2
    expect(hpGain(c, levelUpDraft(c), 1)).toBe(3)
    const weak = make({ scores: { ...make().scores, con: 6 } })
    expect(hpGain(weak, levelUpDraft(weak), 1)).toBe(1)
  })

  it('HP extras: Dwarven Toughness +1, Draconic Resilience +3 at Sorcerer 3, CON raised by ASI counts for every level', () => {
    const dwarf = make({ species: 'Dwarf' })
    expect(hpGain(dwarf, levelUpDraft(dwarf), 6)).toBe(9)
    const sorc = make({ className: 'Sorcerer', level: 2, subclass: 'Draconic Sorcery' })
    expect(hpGain(sorc, levelUpDraft(sorc), 4)).toBe(4 + 2 + 3)
    const wiz = make({ className: 'Wizard', level: 3, subclass: '' })
    const draft = setFeatPick(levelUpDraft(wiz), 'asi-4', 'Ability Score Improvement', { con: 2 })
    // CON +2 → +3: this level 4 + 3 = 7, plus +1 for each of the 3 earlier levels.
    expect(hpGain(wiz, draft, 4)).toBe(7 + 3)
  })

  it('tells what the new level brings', async () => {
    const texts = await loadFeatureTexts()
    const rogue = make({ className: 'Rogue', level: 2, subclass: '' })
    const info = levelUpInfo(rogue, levelUpDraft(rogue), texts)
    expect(info).toMatchObject({ hitDie: 8, fixed: 5, needsSubclass: true, newSlots: [] })
    expect(info.newFeatures).toEqual(expect.arrayContaining(['Rogue Subclass', 'Steady Aim']))
    const fighter = make({ level: 5 })
    expect(levelUpInfo(fighter, levelUpDraft(fighter), texts).newSlots.map((s) => s.id)).toEqual(['asi-6'])
    const rogue5 = make({ className: 'Rogue', level: 5, subclass: 'Thief' })
    expect(levelUpInfo(rogue5, levelUpDraft(rogue5), texts).expertiseGain).toBe(2)
  })

  it('finishing adds HP (max and current) and the features that just became available', () => {
    const c = withAllCatalogFeatures(make({ level: 1, hp: { max: 12, current: 12, temp: 0 } }))
    const up = finishLevelUp(c, levelUpDraft(c), 6)
    expect(up.level).toBe(2)
    expect(up.hp).toEqual({ max: 20, current: 20, temp: 0 })
    expect(up.features.map((f) => f.name)).toEqual(['Second Wind', 'Action Surge'])
  })
})
