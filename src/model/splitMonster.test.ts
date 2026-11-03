import { describe, expect, it } from 'vitest'
import { copyMonster, createEncounter, createMonsters, splitMonster, type Combatant, type Encounter } from './encounter'

const jelly = { name: 'Ochre Jelly', ac: 8, hpMax: 52, initBonus: -2 }
const goblin = { name: 'Goblin', ac: 15, hpMax: 7, initBonus: 2 }

function fight(): { e: Encounter; j: Combatant; g: Combatant } {
  const [j] = createMonsters(jelly, 1)
  const [g] = createMonsters(goblin, 1)
  const e: Encounter = {
    ...createEncounter('E7'),
    status: 'active',
    round: 2,
    combatants: [
      { ...g, initiative: 15 },
      { ...j, initiative: 8, hp: { max: 52, current: 45, temp: 3 }, concentration: 'x', effects: [{ id: 'e1', name: 'Prone', rounds: null, ends: 'end' }] },
    ],
  }
  e.activeId = e.combatants[1].id
  return { e, j: e.combatants[1], g: e.combatants[0] }
}

describe('splitMonster', () => {
  it('replaces the original with two halves (HP round down) on the same initiative', () => {
    const { e, j } = fight()
    const r = splitMonster(e, j.id)
    if (!r.ok) throw new Error(r.reason)
    const names = r.encounter.combatants.map((c) => c.name)
    expect(names).toEqual(['Goblin', 'Ochre Jelly A', 'Ochre Jelly B'])
    const halves = r.encounter.combatants.slice(1)
    for (const h of halves) {
      expect(h.hp).toEqual({ max: 22, current: 22, temp: 0 })
      expect(h.initiative).toBe(8)
      expect(h.effects).toEqual([])
      expect(h.concentration).toBe('')
      expect(h.ac).toBe(8)
    }
    expect(new Set(halves.map((h) => h.id)).size).toBe(2)
    expect(halves.some((h) => h.id === j.id)).toBe(false)
    expect(r.newIds).toEqual(halves.map((h) => h.id))
  })
  it('the halves are new creatures: fresh turn, Legendary and Recharge uses', () => {
    const { e, j } = fight()
    const used = { ...e, combatants: e.combatants.map((c) => (c.id === j.id ? { ...c, turn: { ...c.turn!, reaction: true }, legendaryUsed: 1, spent: ['x'] } : c)) }
    const r = splitMonster(used, j.id)
    if (!r.ok) throw new Error(r.reason)
    for (const h of r.encounter.combatants.slice(1)) {
      expect(h.turn).toEqual(createMonsters(jelly, 1)[0].turn)
      expect(h.legendaryUsed).toBe(0)
      expect(h.spent).toEqual([])
    }
  })
  it('passes the turn to the first half when it was the original\'s turn', () => {
    const { e, j } = fight()
    const r = splitMonster(e, j.id)
    if (!r.ok) throw new Error(r.reason)
    expect(r.encounter.activeId).toBe(r.newIds[0])
  })
  it('keeps the turn where it was otherwise', () => {
    const { e, j, g } = fight()
    const r = splitMonster({ ...e, activeId: g.id }, j.id)
    if (!r.ok) throw new Error(r.reason)
    expect(r.encounter.activeId).toBe(g.id)
  })
  it('the log line holds no HP numbers (players may see it)', () => {
    const { e, j } = fight()
    const r = splitMonster(e, j.id)
    if (!r.ok) throw new Error(r.reason)
    expect(r.text).toBe('✂️ Ochre Jelly แยกร่างเป็น Ochre Jelly A และ Ochre Jelly B')
    expect(r.text).not.toMatch(/\d/)
  })
  it('a half can split again', () => {
    const { e, j } = fight()
    const r1 = splitMonster(e, j.id)
    if (!r1.ok) throw new Error(r1.reason)
    const r2 = splitMonster(r1.encounter, r1.newIds[0])
    if (!r2.ok) throw new Error(r2.reason)
    expect(r2.encounter.combatants.map((c) => [c.name, c.hp.current])).toEqual([
      ['Goblin', 7], ['Ochre Jelly AA', 11], ['Ochre Jelly AB', 11], ['Ochre Jelly B', 22],
    ])
  })
  it('refuses PCs and monsters with under 2 HP', () => {
    const { e, j } = fight()
    const low = { ...e, combatants: e.combatants.map((c) => (c.id === j.id ? { ...c, hp: { ...c.hp, current: 1 } } : c)) }
    expect(splitMonster(low, j.id).ok).toBe(false)
    const pc = { ...e, combatants: e.combatants.map((c) => (c.id === j.id ? { ...c, kind: 'pc' as const } : c)) }
    expect(splitMonster(pc, j.id).ok).toBe(false)
    expect(splitMonster(e, 'nope').ok).toBe(false)
  })
})

describe('copyMonster', () => {
  it('adds one more with full HP, same initiative, fresh state', () => {
    const { e, j } = fight()
    const used = { ...e, combatants: e.combatants.map((c) => (c.id === j.id ? { ...c, legendaryUsed: 2, spent: ['Breath'] } : c)) }
    const r = copyMonster(used, j.id)
    if (!r.ok) throw new Error(r.reason)
    expect(r.encounter.combatants).toHaveLength(3)
    const copy = r.encounter.combatants.find((c) => c.id === r.newIds[0])!
    expect(copy.name).toBe('Ochre Jelly 2')
    expect(copy.hp).toEqual({ max: 52, current: 52, temp: 0 })
    expect(copy.initiative).toBe(8)
    expect(copy.effects).toEqual([])
    expect(copy.legendaryUsed).toBe(0)
    expect(copy.spent).toEqual([])
    expect(r.encounter.activeId).toBe(e.activeId)
    expect(r.text).toBe('➕ Ochre Jelly 2 เข้าร่วมการต่อสู้')
    // The original is unchanged.
    expect(r.encounter.combatants.find((c) => c.id === j.id)!.hp.current).toBe(45)
  })
  it('refuses PCs', () => {
    const { e, g } = fight()
    const pc = { ...e, combatants: e.combatants.map((c) => (c.id === g.id ? { ...c, kind: 'pc' as const } : c)) }
    expect(copyMonster(pc, g.id).ok).toBe(false)
  })
})
