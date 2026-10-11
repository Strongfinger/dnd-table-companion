import { describe, expect, it } from 'vitest'
import { sampleCharacters } from '../dev/sampleCharacters'
import { addEffect, combatantFromCharacter, createEncounter, createMonsters, damageMonster, healMonster, removeEffect } from './encounter'

const goblin = { name: 'Goblin', ac: 15, hpMax: 7, initBonus: 2 }

describe('encounters', () => {
  it('a new encounter is in setup with no one in it', () => {
    const e = createEncounter('  ')
    expect(e).toMatchObject({ name: 'การต่อสู้', status: 'setup', round: 0, activeId: null, combatants: [] })
  })

  it('a PC takes name, AC and initiative bonus from the sheet (Boom: Alert → +3)', () => {
    const boom = sampleCharacters()[0]
    const pc = combatantFromCharacter(boom)
    expect(pc).toMatchObject({ kind: 'pc', characterId: boom.id, name: 'Boom', ac: 16, initBonus: 3, dexMod: 1 })
  })

  it('several monsters get numbers, continuing after existing ones', () => {
    const first = createMonsters(goblin, 3)
    expect(first.map((m) => m.name)).toEqual(['Goblin 1', 'Goblin 2', 'Goblin 3'])
    expect(createMonsters(goblin, 1, first)[0].name).toBe('Goblin 4')
    expect(createMonsters(goblin, 1)[0].name).toBe('Goblin')
    expect(first[0].hp).toEqual({ max: 7, current: 7, temp: 0 })
  })
})

describe('monster HP', () => {
  const g = createMonsters(goblin, 1)[0]

  it('takes damage and is defeated at 0', () => {
    expect(damageMonster(g, 3).combatant.hp.current).toBe(4)
    const r = damageMonster(g, 10)
    expect(r.combatant.hp.current).toBe(0)
    expect(r.combatant.defeated).toBe(true)
    expect(r.text).toContain('ล้ม')
  })

  it('temp HP goes first', () => {
    const r = damageMonster({ ...g, hp: { ...g.hp, temp: 5 } }, 6)
    expect(r.combatant.hp).toEqual({ max: 7, current: 6, temp: 0 })
  })

  it('Concentration reminder, and it ends at 0 HP', () => {
    const caster = { ...g, concentration: 'Hold Person' }
    expect(damageMonster(caster, 3).text).toContain('DC 10')
    expect(damageMonster(caster, 7).combatant.concentration).toBe('')
  })

  it('healing from 0 brings it back', () => {
    const down = damageMonster(g, 10).combatant
    const r = healMonster(down, 3)
    expect(r.combatant.hp.current).toBe(3)
    expect(r.combatant.defeated).toBe(false)
  })
})

describe('effects', () => {
  it('adds and removes timed effects', () => {
    const g = addEffect(createMonsters(goblin, 1)[0], 'Frightened', 2, 'end')
    expect(g.effects[0]).toMatchObject({ name: 'Frightened', rounds: 2, ends: 'end' })
    expect(removeEffect(g, g.effects[0].id).effects).toEqual([])
  })
})
