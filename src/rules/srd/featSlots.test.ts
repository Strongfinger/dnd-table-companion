import { describe, expect, it } from 'vitest'
import features from '../../data/srd-features.json'
import { featSlots, featSlotsAt, featsForSlot, findSrdFeat, SRD_FEATS } from './featSlots'

const ids = (c: Parameters<typeof featSlots>[0]) => featSlots(c).map((s) => s.id)

describe('SRD feats and feat slots (2024)', () => {
  it('has the 17 SRD feats, each with its SRD text', () => {
    expect(SRD_FEATS).toHaveLength(17)
    for (const f of SRD_FEATS) expect(features.feats.some((x) => x.name.replace('-', ' ') === f.name.replace('-', ' ')), f.name).toBe(true)
    expect(findSrdFeat('two weapon fighting')?.name).toBe('Two-Weapon Fighting')
    expect(findSrdFeat('Ability Score Improvement')).toMatchObject({ repeatable: true, increase: { points: 2, max: 20, split: true } })
    expect(findSrdFeat('Boon of Irresistible Offense')?.increase?.abilities).toEqual(['str', 'dex'])
    expect(findSrdFeat('Boon of Spell Recall')?.increase?.abilities).toEqual(['int', 'wis', 'cha'])
  })

  it('Ability Score Improvement levels by class', () => {
    expect(ids({ className: 'Wizard', subclass: '', level: 20, species: 'Elf' })).toEqual(['background', 'asi-4', 'asi-8', 'asi-12', 'asi-16', 'epic-19'])
    expect(ids({ className: 'Fighter', subclass: '', level: 14, species: 'Dwarf' }))
      .toEqual(['background', 'fighting-style-1', 'asi-4', 'asi-6', 'asi-8', 'asi-12', 'asi-14'])
    expect(ids({ className: 'Rogue', subclass: '', level: 10, species: 'Halfling' })).toEqual(['background', 'asi-4', 'asi-8', 'asi-10'])
  })

  it('Fighting Style for Fighter 1, Paladin and Ranger 2, Champion 7; Human gets a second Origin feat', () => {
    expect(ids({ className: 'Paladin', subclass: '', level: 1, species: 'Human' })).toEqual(['background', 'species'])
    expect(ids({ className: 'Paladin', subclass: '', level: 2, species: 'Human' })).toEqual(['background', 'species', 'fighting-style-2'])
    expect(ids({ className: 'Fighter', subclass: 'Champion', level: 7, species: 'Orc' })).toContain('fighting-style-7')
    expect(featSlotsAt({ className: 'Fighter', subclass: '', level: 6, species: 'Orc' }).map((s) => s.id)).toEqual(['asi-6'])
  })

  it('which feats a slot can take', () => {
    const names = (k: Parameters<typeof featsForSlot>[0], className: Parameters<typeof featsForSlot>[1]['className'], level: number) =>
      featsForSlot(k, { className, level }).map((f) => f.name)
    expect(names('origin', 'Wizard', 1)).toEqual(['Alert', 'Magic Initiate', 'Savage Attacker', 'Skilled'])
    expect(names('asi', 'Wizard', 4)).toEqual(['Alert', 'Magic Initiate', 'Savage Attacker', 'Skilled', 'Ability Score Improvement', 'Grappler'])
    expect(names('asi', 'Fighter', 4)).toContain('Archery')
    expect(names('epicBoon', 'Rogue', 19)).toContain('Boon of Fate')
    // An Epic Boon fits an ASI slot only once the character is level 19+; Fighting Style feats only with the feature.
    expect(names('asi', 'Rogue', 18)).not.toContain('Boon of Fate')
    expect(names('asi', 'Rogue', 19)).toContain('Boon of Fate')
    expect(names('asi', 'Barbarian', 8)).not.toContain('Archery')
    expect(names('fightingStyle', 'Ranger', 2)).toEqual(['Archery', 'Defense', 'Great Weapon Fighting', 'Two-Weapon Fighting'])
  })
})
