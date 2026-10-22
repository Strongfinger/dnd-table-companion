import { describe, expect, it } from 'vitest'
import { abilityRows, challengeLine, findMonsterForCombatant, immunitiesLine, loadFullMonsters, sensesLine } from './monsterDetails'

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

describe('Mule (SRD 5.2.1 p. 357)', () => {
  it('matches the official stat block and is not the Octopus', async () => {
    const mule = (await loadFullMonsters()).find((m) => m.id === 'mule')!
    expect(mule).toMatchObject({ size: 'Medium', type: 'beast', ac: 10, hp: 11, hpRoll: '2d8 + 2', speed: '40 ft.', scores: [14, 10, 13, 2, 10, 5], init: 0, cr: 0.125, xp: 25, pb: 2, passivePerception: 10 })
    expect(mule.traits.map((t) => t.name)).toEqual(['Beast of Burden'])
    expect(mule.actions.map((a) => a.name)).toEqual(['Hooves'])
    expect(mule.actions[0].text).toContain('4 (1d4 + 2) Bludgeoning')
    expect(mule.reactions).toEqual([])
    expect(JSON.stringify(mule).toLowerCase()).not.toContain('octopus')
  })
})

describe('findMonsterForCombatant', () => {
  const list = [{ name: 'Goblin Warrior' }, { name: 'Goblin Boss' }, { name: 'Werewolf, Hybrid Form' }]
  it('matches tracker names, with or without the copy number', () => {
    expect(findMonsterForCombatant(list, 'Goblin Warrior 2')?.name).toBe('Goblin Warrior')
    expect(findMonsterForCombatant(list, 'goblin boss')?.name).toBe('Goblin Boss')
    expect(findMonsterForCombatant(list, 'Werewolf, Hybrid Form 1')?.name).toBe('Werewolf, Hybrid Form')
    expect(findMonsterForCombatant(list, 'Snaggletooth')).toBeUndefined()
  })
})
