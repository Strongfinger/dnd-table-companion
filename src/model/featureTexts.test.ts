import { describe, expect, it } from 'vitest'
import { createCharacter } from './character'
import { characterFeatureEntries, loadFeatureTexts } from './featureTexts'

describe('SRD feature texts for a character', () => {
  it('lists class features up to the level, the subclass, species traits and feats', async () => {
    const data = await loadFeatureTexts()
    const c = createCharacter({ className: 'Rogue', level: 3, subclass: 'Thief', species: 'Halfling', feats: ['Alert'] })
    const names = characterFeatureEntries(c, data).map((e) => e.name)
    expect(names).toEqual(expect.arrayContaining(['Sneak Attack', "Thieves' Cant", 'Weapon Mastery', 'Cunning Action', 'Fast Hands', 'Luck', 'Alert']))
    expect(names).not.toContain('Evasion') // Rogue 7
    // No subclass on the sheet: no subclass features.
    expect(characterFeatureEntries({ ...c, subclass: '' }, data).map((e) => e.name)).not.toContain('Fast Hands')
  })

  it('shows lineage variants only when the sheet names them', async () => {
    const data = await loadFeatureTexts()
    const names = (species: string) => characterFeatureEntries(createCharacter({ className: 'Wizard', species }), data).map((e) => e.name)
    expect(names('Gnome (Rock Gnome)')).toContain('Gnomish Lineage: Rock Gnome')
    expect(names('Gnome (Rock Gnome)')).not.toContain('Gnomish Lineage: Forest Gnome')
    expect(names('Dragonborn').filter((n) => n.startsWith('Breath Weapon:'))).toEqual([])
  })
})
