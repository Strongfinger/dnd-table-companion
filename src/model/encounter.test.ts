import { describe, expect, it } from 'vitest'
import { sampleCharacters } from '../dev/sampleCharacters'
import {
  addEffect, combatantFromCharacter, conditionsToClear, createEncounter, createMonsters, damageMonster, renameEncounter, healMonster, removeEffect,
  rollInitiative, sheetOnlyConditions, tempHpMonster,
} from './encounter'

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

describe('monster numbering', () => {
  it('never repeats a number after one is removed', () => {
    const [, g2, g3] = createMonsters(goblin, 3)
    expect(createMonsters(goblin, 1, [g2, g3])[0].name).toBe('Goblin 4')
  })

  it('an unnumbered Goblin counts as 1; other names do not count', () => {
    const solo = createMonsters(goblin, 1)
    expect(createMonsters(goblin, 1, solo)[0].name).toBe('Goblin 2')
    const archer = createMonsters({ ...goblin, name: 'Goblin Archer' }, 1)
    expect(createMonsters(goblin, 1, archer)[0].name).toBe('Goblin')
  })

  it('names with special characters work', () => {
    const big = createMonsters({ ...goblin, name: 'Ogre (big)' }, 2)
    expect(createMonsters({ ...goblin, name: 'Ogre (big)' }, 1, big)[0].name).toBe('Ogre (big) 3')
  })
})

describe('monster temp HP, heal text, initiative', () => {
  const g = createMonsters(goblin, 1)[0]

  it('temp HP keeps the higher value', () => {
    const t = tempHpMonster(g, 5).combatant
    expect(tempHpMonster(t, 3).combatant.hp.temp).toBe(5)
    expect(tempHpMonster(t, 3).text).toContain('ไม่ซ้อนกัน')
  })

  it('heal text shows HP actually gained', () => {
    expect(healMonster({ ...g, hp: { ...g.hp, current: 5 } }, 10).text).toContain('ฮีล 2')
  })

  it('rollInitiative adds the bonus', () => {
    expect(rollInitiative(2, () => 0.5)).toEqual({ total: 13, how: '🎲 11 +2' })
    expect(rollInitiative(-1, () => 0)).toEqual({ total: 0, how: '🎲 1 -1' })
  })
})

describe('conditionsToClear', () => {
  const ef = (name: string) => ({ id: name + Math.random(), name, rounds: 1, ends: 'end' as const })
  it('only real conditions, and not while another effect still applies it', () => {
    expect(conditionsToClear([ef('Prone'), ef('Bless')], [])).toEqual(['Prone'])
    expect(conditionsToClear([ef('Prone')], [ef('Prone')])).toEqual([])
  })
})

describe('sheetOnlyConditions', () => {
  const sheet = { ...sampleCharacters()[0], conditions: ['Unconscious' as const, 'Prone' as const] }
  it('lists sheet conditions the tracker does not already show', () => {
    expect(sheetOnlyConditions([{ name: 'Prone' }], sheet)).toEqual(['Unconscious'])
  })
  it('nothing without a linked sheet', () => {
    expect(sheetOnlyConditions([], undefined)).toEqual([])
  })
})

describe('renaming a fight', () => {
  it('changes only the name (id stays, so the fight log and plan links keep working)', () => {
    const e = createEncounter('Goblin ambush', 'camp1')
    const r = renameEncounter(e, '  ซุ่มโจมตีที่ถ้ำ  ')
    expect(r).toEqual({ ...e, name: 'ซุ่มโจมตีที่ถ้ำ' })
    expect(renameEncounter(e, '   ')).toBe(e)
    expect(renameEncounter(e, 'Goblin ambush')).toBe(e)
    expect(renameEncounter(e, 'x'.repeat(150)).name).toHaveLength(100)
  })
})
