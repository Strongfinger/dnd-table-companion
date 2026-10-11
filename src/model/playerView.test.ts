import { describe, expect, it } from 'vitest'
import { createCharacter } from './character'
import { createEncounter, createMonsters } from './encounter'
import { healthStatus, playerView } from './playerView'

describe('healthStatus', () => {
  it('full, hurt, Bloodied at half or below, down at 0', () => {
    expect(healthStatus({ max: 10, current: 10 })).toBe('healthy')
    expect(healthStatus({ max: 10, current: 6 })).toBe('hurt')
    expect(healthStatus({ max: 10, current: 5 })).toBe('bloodied')
    expect(healthStatus({ max: 7, current: 3 })).toBe('bloodied')
    expect(healthStatus({ max: 7, current: 4 })).toBe('hurt')
    expect(healthStatus({ max: 10, current: 0 })).toBe('down')
    expect(healthStatus({ max: 10, current: 8 }, true)).toBe('down')
  })
})

describe('playerView keeps DM secrets out', () => {
  const boom = createCharacter({ name: 'Boom', hp: { max: 19, current: 12, temp: 0 } })
  const [g1, g2] = createMonsters({ name: 'Goblin', ac: 15, hpMax: 10, initBonus: 2 }, 2)
  const pc = { ...createMonsters({ name: 'x', ac: 1, hpMax: 1, initBonus: 0 }, 1)[0], kind: 'pc' as const, characterId: boom.id, name: 'Boom' }
  const enc = {
    ...createEncounter('Ambush'),
    status: 'active' as const,
    round: 2,
    activeId: g2.id,
    combatants: [
      {
        ...g1, hp: { max: 10, current: 4, temp: 0 }, concentration: 'Hold Person', initiative: 15,
        effects: [{ id: 'a', name: 'Prone', rounds: null, ends: 'end' as const }, { id: 'b', name: 'Charmed by Strahd', rounds: 2, ends: 'end' as const }],
      },
      { ...g2, hidden: true, initiative: 12 },
      { ...pc, initiative: 10 },
    ],
  }
  const view = playerView(enc, new Map([[boom.id, boom]]))
  const json = JSON.stringify(view)

  it('hides hidden creatures, but says an unseen creature is acting', () => {
    expect(view.combatants.map((c) => c.name)).toEqual(['Goblin 1', 'Boom'])
    expect(view.hiddenTurn).toBe(true)
  })

  it('monsters show rough health only: no exact HP, AC or concentration', () => {
    expect(view.combatants[0]).toMatchObject({ health: 'bloodied', pc: null })
    expect(json).not.toContain('Hold Person')
    expect(json).not.toContain('"ac"')
    expect(json).not.toMatch(/"current":4\b/)
  })

  it('monster effects: real conditions shown, the DM\'s own notes hidden', () => {
    expect(view.combatants[0].effects).toEqual([{ name: 'Prone', rounds: null }])
    expect(json).not.toContain('Strahd')
  })

  it('PCs show their sheet HP to the party', () => {
    expect(view.combatants[1].pc).toEqual({ characterId: boom.id, hp: { max: 19, current: 12, temp: 0 } })
  })
})
