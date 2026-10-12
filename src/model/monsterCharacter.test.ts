import { describe, expect, it } from 'vitest'
import { deriveSheet } from '../rules'
import { createMonsters } from './encounter'
import { exportCharacter, parseCharacterImport } from './io'
import { characterFromCombatant, characterFromMonster, classLabel, hitDiceOf } from './monsterCharacter'
import { loadFullMonsters, type FullMonster } from './monsterDetails'

const all = await loadFullMonsters()
const get = (id: string) => all.find((m) => m.id === id) as FullMonster

describe('characterFromMonster (SRD 5.2.1 stat block → character)', () => {
  const goblin = characterFromMonster(get('goblin-warrior'))

  it('keeps the numbers: abilities, AC, HP, speed, Hit Dice, PB from CR', () => {
    expect(goblin).toMatchObject({ name: 'Goblin Warrior', ac: 15, hp: { max: 10, current: 10 }, speed: 30, level: 3 })
    expect(goblin.scores).toEqual({ str: 8, dex: 15, con: 10, int: 10, wis: 8, cha: 8 })
    expect(goblin.monster).toEqual({ cr: 0.25, pb: 2, hitDie: 6, source: 'Goblin Warrior' })
  })

  it('the sheet shows the stat block bonuses (Stealth +6 is Expertise)', () => {
    const s = deriveSheet(goblin)
    expect(goblin.skills.Stealth).toBe('expertise')
    expect(s.skills.Stealth).toBe(6)
    expect(s.proficiencyBonus).toBe(2)
    expect(s.passivePerception).toBe(9)
  })

  it('a proficient saving throw stays proficient', () => {
    const sword = characterFromMonster(get('animated-flying-sword'))
    expect(sword.saveProficiencies).toEqual(['dex'])
    expect(deriveSheet(sword).saves.dex).toBe(4)
  })

  it('actions and traits come along as text, with the SRD credit', () => {
    expect(goblin.featuresText).toContain('Scimitar. Melee Attack Roll: +4')
    expect(goblin.featuresText).toContain('【Bonus Actions】\nNimble Escape.')
    expect(goblin.proficienciesText).toContain('Languages: Common, Goblin')
    expect(goblin.notes).toContain('CC-BY-4.0')
  })

  it('notes say where the sheet differs from the stat block', () => {
    expect(characterFromMonster(get('giant-frog')).notes).toContain('Stealth +')
    expect(characterFromMonster(get('tarrasque')).notes).toContain('Hit Dice จริง 34d20')
    expect(goblin.notes).not.toContain('ต่างไป')
  })

  it('a hurt copy keeps its HP; huge monsters cap at level 20', () => {
    expect(characterFromMonster(get('goblin-warrior'), { name: 'Snik', hp: { max: 12, current: 4 } })).toMatchObject({ name: 'Snik', hp: { max: 12, current: 4 } })
    expect(characterFromMonster(get('tarrasque')).level).toBe(20)
  })

  it('survives export → import (the file a DM sends to a player)', () => {
    const r = parseCharacterImport(exportCharacter(goblin))
    expect(r.ok && r.character.monster).toEqual(goblin.monster)
  })

  it('shown as a monster, not a class', () => {
    expect(classLabel(goblin)).toBe('Monster · CR 1/4')
    expect(classLabel({ className: 'Rogue', level: 3 })).toBe('Rogue 3')
  })
})

describe('characterFromCombatant (custom NPC, no stat block)', () => {
  it('keeps name, AC and current HP', () => {
    const [guard] = createMonsters({ name: 'Town Guard', ac: 16, hpMax: 11, initBonus: 1 }, 1)
    const c = characterFromCombatant({ ...guard, hp: { max: 11, current: 6, temp: 0 } })
    expect(c).toMatchObject({ name: 'Town Guard', ac: 16, hp: { max: 11, current: 6 } })
    expect(classLabel(c)).toBe('NPC')
  })
})

describe('hitDiceOf', () => {
  it('reads the dice from the HP formula', () => {
    expect(hitDiceOf('9d8 + 18')).toEqual({ dice: 9, size: 8 })
    expect(hitDiceOf('nonsense')).toEqual({ dice: 1, size: 8 })
  })
})
