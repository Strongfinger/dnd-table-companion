import { describe, expect, it } from 'vitest'
import { abilityRows, challengeLine, immunitiesLine, loadFullMonsters, sensesLine } from './monsterDetails'

describe('SRD stat blocks', () => {
  it('every quick-add monster has a full stat block', async () => {
    const all = await loadFullMonsters()
    expect(all).toHaveLength(341)
    const lich = all.find((m) => m.id === 'lich')!
    expect(lich.actions.find((a) => a.name === 'Spellcasting')?.spells?.map((g) => g.usage)).toEqual(['At Will', '2/Day Each', '1/Day Each'])
    const dragon = all.find((m) => m.id === 'adult-red-dragon')!
    expect(dragon.traits[0]).toMatchObject({ name: 'Legendary Resistance', usage: '3/Day, or 4/Day in Lair' })
    expect(dragon.legendaryActions.length).toBeGreaterThan(0)
  })

  it('formats the stat block lines', async () => {
    const all = await loadFullMonsters()
    const goblin = all.find((m) => m.id === 'goblin-warrior')!
    expect(abilityRows(goblin)[1]).toEqual({ ability: 'dex', score: 15, mod: '+2', save: '+2' })
    expect(sensesLine(goblin)).toBe('Darkvision 60 ft.; Passive Perception 9')
    expect(challengeLine(goblin)).toBe('1/4 (XP 50; PB +2)')
    const dragon = all.find((m) => m.id === 'adult-red-dragon')!
    expect(abilityRows(dragon).find((r) => r.ability === 'dex')?.save).toBe('+6')
    expect(challengeLine(dragon)).toBe('17 (XP 18,000, or 20,000 in lair; PB +6)')
    expect(sensesLine({ senses: [], passivePerception: 10 })).toBe('Passive Perception 10')
    expect(sensesLine(dragon)).toBe('Darkvision 120 ft., Blindsight 60 ft.; Passive Perception 23')
    expect(immunitiesLine({ immunities: ['Fire'], conditionImmunities: ['Charmed'] })).toBe('Fire; Charmed')
  })
})
