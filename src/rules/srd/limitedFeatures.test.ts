import { describe, expect, it } from 'vitest'
import features from '../../data/srd-features.json'
import { availableFeatures, featureRecharge, featureUses, findLimitedFeature, LIMITED_FEATURES } from './limitedFeatures'

const scores = (o: Partial<Record<'str' | 'dex' | 'con' | 'int' | 'wis' | 'cha', number>> = {}) => ({ str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10, ...o })
const uses = (id: string, level: number, s = scores()) => featureUses(findLimitedFeature(id)!, { level, scores: s })

describe('limited-use feature catalog (SRD 5.2.1)', () => {
  it('every entry has its SRD text, and ids are unique', () => {
    const ids = new Set([...features.classFeatures, ...features.traits, ...features.feats].map((f) => f.id))
    for (const f of LIMITED_FEATURES) expect(ids.has(f.id), f.id).toBe(true)
    expect(new Set(LIMITED_FEATURES.map((f) => f.id)).size).toBe(LIMITED_FEATURES.length)
  })

  it('uses follow the class tables', () => {
    expect([1, 3, 6, 12, 17].map((l) => uses('barbarian-rage', l))).toEqual([2, 3, 4, 5, 6])
    expect([1, 4, 10].map((l) => uses('fighter-second-wind', l))).toEqual([2, 3, 4])
    expect([2, 17].map((l) => uses('fighter-action-surge', l))).toEqual([1, 2])
    expect([2, 6, 18].map((l) => uses('cleric-channel-divinity', l))).toEqual([2, 3, 4])
    expect([3, 11].map((l) => uses('paladin-channel-divinity', l))).toEqual([2, 3])
    expect([2, 6, 17].map((l) => uses('druid-wild-shape', l))).toEqual([2, 3, 4])
    expect([1, 5, 9, 13, 17].map((l) => uses('ranger-favored-enemy', l))).toEqual([2, 3, 4, 5, 6])
  })

  it('pools, ability modifiers (minimum 1) and Proficiency Bonus', () => {
    expect(uses('paladin-lay-on-hands', 3)).toBe(15)
    expect(uses('monk-monks-focus', 7)).toBe(7)
    expect(uses('bard-bardic-inspiration', 1, scores({ cha: 16 }))).toBe(3)
    expect(uses('bard-bardic-inspiration', 1, scores({ cha: 8 }))).toBe(1)
    expect(uses('adrenaline-rush', 5)).toBe(3)
  })

  it('Bardic Inspiration comes back on a Short Rest from Bard 5', () => {
    const f = findLimitedFeature('bard-bardic-inspiration')!
    expect(featureRecharge(f, 4)).toBe('long')
    expect(featureRecharge(f, 5)).toBe('short')
  })

  it('dice scale with level', () => {
    const ctx = (level: number) => ({ level, scores: scores({ wis: 16 }) })
    expect(findLimitedFeature('fighter-second-wind')!.roll!(ctx(3)).expression).toBe('1d10+3')
    expect(findLimitedFeature('cleric-channel-divinity')!.roll!(ctx(7)).expression).toBe('2d8+3')
    expect(findLimitedFeature('draconic-breath-weapon-fire')!.roll!(ctx(11)).expression).toBe('3d10')
    expect(findLimitedFeature('bard-bardic-inspiration')!.roll!(ctx(10)).expression).toBe('1d10')
  })

  it('offers only what the character qualifies for', () => {
    const names = (c: Parameters<typeof availableFeatures>[0]) => availableFeatures(c).map((f) => f.id)
    expect(names({ className: 'Fighter', subclass: '', level: 1, species: 'Orc', feats: [] }))
      .toEqual(['fighter-second-wind', 'adrenaline-rush', 'relentless-endurance'])
    expect(names({ className: 'Monk', subclass: 'Warrior of the Open Hand', level: 6, species: 'Human', feats: ['Magic Initiate'] }))
      .toEqual(['monk-monks-focus', 'monk-uncanny-metabolism', 'open-hand-wholeness-of-body', 'magic-initiate'])
    // Species names on sheets may carry a lineage ("Dragonborn (Red)").
    expect(names({ className: 'Wizard', subclass: '', level: 5, species: 'Dragonborn (Red)', feats: [] })).toContain('draconic-flight')
  })
})
