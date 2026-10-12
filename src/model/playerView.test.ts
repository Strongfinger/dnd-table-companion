import { describe, expect, it } from 'vitest'
import { createCharacter } from './character'
import { createEncounter, createMonsters } from './encounter'
import { activeTurn, healthStatus, isTurnEventForPlayers, liveFight, parsePlayerView, playerView } from './playerView'

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

describe('liveFight', () => {
  const fight = (id: string, status: 'setup' | 'active' | 'ended', updatedAt: number, campaignId: string | null = null) =>
    ({ ...createEncounter(id, campaignId), id, status, updatedAt })

  it('picks the newest running fight, preferring the room campaign', () => {
    const list = [fight('a', 'active', 1, 'camp'), fight('b', 'active', 5), fight('c', 'setup', 9, 'camp'), fight('d', 'ended', 9, 'camp')]
    expect(liveFight(list, 'camp')?.id).toBe('a')
    expect(liveFight(list, 'other')?.id).toBe('b')
    expect(liveFight(list, null)?.id).toBe('b')
    expect(liveFight([fight('c', 'setup', 9)], null)).toBeNull()
  })
})

describe('parsePlayerView', () => {
  const boom = createCharacter({ name: 'Boom', hp: { max: 19, current: 12, temp: 3 } })
  const [g1] = createMonsters({ name: 'Goblin', ac: 15, hpMax: 10, initBonus: 2 }, 1)
  const pc = { ...createMonsters({ name: 'x', ac: 1, hpMax: 1, initBonus: 0 }, 1)[0], kind: 'pc' as const, characterId: boom.id, name: 'Boom' }
  const enc = { ...createEncounter('Ambush'), status: 'active' as const, round: 3, activeId: pc.id, combatants: [{ ...g1, initiative: 12 }, { ...pc, initiative: 9 }] }
  const view = playerView(enc, new Map([[boom.id, boom]]))

  it('accepts a real view unchanged (after travelling as JSON)', () => {
    expect(parsePlayerView(JSON.parse(JSON.stringify(view)))).toEqual(view)
  })

  it('rejects broken views', () => {
    expect(parsePlayerView(null)).toBeNull()
    expect(parsePlayerView({ ...view, status: 'boss' })).toBeNull()
    expect(parsePlayerView({ ...view, combatants: [{ ...view.combatants[0], health: 'full' }] })).toBeNull()
    expect(parsePlayerView({ ...view, combatants: 'all' })).toBeNull()
  })

  it('finds whose turn it is', () => {
    expect((activeTurn(view) as { name: string }).name).toBe('Boom')
    expect(activeTurn({ ...view, hiddenTurn: true })).toBe('hidden')
    expect(activeTurn({ ...view, combatants: [] })).toBeNull()
  })
})

describe('isTurnEventForPlayers', () => {
  const [goblin, shadow] = createMonsters({ name: 'Goblin', ac: 15, hpMax: 10, initBonus: 2 }, 2)
  const hidden = { ...shadow, name: 'Shadow', hidden: true }
  const pc = { ...createMonsters({ name: 'x', ac: 1, hpMax: 1, initBonus: 0 }, 1)[0], kind: 'pc' as const, characterId: 'c1', name: 'Boom' }
  const list = [goblin, hidden, pc]
  it('shows turns and rounds of visible creatures and PC events only', () => {
    expect(isTurnEventForPlayers({ combatantId: goblin.id, text: 'ตาของ Goblin 1' }, list)).toBe(true)
    expect(isTurnEventForPlayers({ combatantId: goblin.id, text: '— รอบที่ 2 —' }, list)).toBe(true)
    expect(isTurnEventForPlayers({ combatantId: goblin.id, text: 'Goblin 1: Charmed by Strahd หมดแล้ว' }, list)).toBe(false)
    expect(isTurnEventForPlayers({ combatantId: hidden.id, text: 'ตาของ Shadow' }, list)).toBe(false)
    expect(isTurnEventForPlayers({ combatantId: pc.id, text: 'Boom: Prone หมดแล้ว' }, list)).toBe(true)
    expect(isTurnEventForPlayers({ combatantId: '', text: 'ไม่มีใครเหลือในการต่อสู้' }, list)).toBe(true)
  })
})
