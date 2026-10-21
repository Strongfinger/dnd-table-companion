import { describe, expect, it } from 'vitest'
import { careKind, needsCare, partyTotals, sortParty, type PartyMember } from './partySummary'

const m = (name: string, current: number, max: number, extra: Partial<PartyMember> = {}): PartyMember =>
  ({ id: name, name, hp: { current, max }, ...extra })

describe('careKind', () => {
  it('is null for full or lightly hurt characters', () => {
    expect(careKind(m('A', 10, 10))).toBeNull()
    expect(careKind(m('A', 6, 10))).toBeNull()
  })
  it('marks Bloodied at or below half HP (2024)', () => {
    expect(careKind(m('A', 5, 10))).toBe('bloodied')
    expect(careKind(m('A', 1, 10))).toBe('bloodied')
  })
  it('tells dying, stable and dead apart at 0 HP', () => {
    expect(careKind(m('A', 0, 10))).toBe('dying')
    expect(careKind(m('A', 0, 10, { deathSaves: { successes: 2, failures: 2 } }))).toBe('dying')
    expect(careKind(m('A', 0, 10, { deathSaves: { successes: 3, failures: 1 } }))).toBe('stable')
    expect(careKind(m('A', 0, 10, { deathSaves: { successes: 0, failures: 3 } }))).toBe('dead')
  })
})

describe('needsCare', () => {
  it('lists the dying first, then by lowest HP share, and leaves out the healthy', () => {
    const party = [m('Boom', 19, 19), m('Mark', 3, 8), m('Hyp', 0, 12), m('Pet', 2, 11)]
    expect(needsCare(party).map((x) => [x.member.name, x.kind])).toEqual([
      ['Hyp', 'dying'],
      ['Pet', 'bloodied'],
      ['Mark', 'bloodied'],
    ])
  })
})

describe('partyTotals', () => {
  it('adds HP, slots and Hit Dice, and finds the lowest and highest Passive Perception', () => {
    const t = partyTotals([
      m('Boom', 19, 19, { passivePerception: 12, hitDice: { left: 2, max: 2 } }),
      m('Hyp', 0, 12, { passivePerception: 11, slots: { left: 2, max: 2 }, hitDice: { left: 1, max: 1 } }),
      m('Pet', 11, 11, { passivePerception: 13, slots: { left: 1, max: 2 }, hitDice: { left: 0, max: 1 } }),
    ])
    expect(t.hp).toEqual({ current: 30, max: 42 })
    expect(t.lowestPerception).toEqual({ name: 'Hyp', value: 11 })
    expect(t.highestPerception).toEqual({ name: 'Pet', value: 13 })
    expect(t.slots).toEqual({ left: 3, max: 4 })
    expect(t.hitDice).toEqual({ left: 3, max: 4 })
  })
  it('handles an empty party', () => {
    const t = partyTotals([])
    expect(t.hp).toEqual({ current: 0, max: 0 })
    expect(t.lowestPerception).toBeNull()
  })
})

describe('sortParty', () => {
  const party = [m('Cara', 5, 10, { initiative: 1 }), m('Alda', 10, 10, { initiative: 3 }), m('Bram', 0, 8, { initiative: 3 })]
  it('sorts by name', () => {
    expect(sortParty(party, 'name').map((x) => x.name)).toEqual(['Alda', 'Bram', 'Cara'])
  })
  it('sorts by HP share, lowest first', () => {
    expect(sortParty(party, 'hp').map((x) => x.name)).toEqual(['Bram', 'Cara', 'Alda'])
  })
  it('sorts by Initiative bonus, highest first, ties by name', () => {
    expect(sortParty(party, 'initiative').map((x) => x.name)).toEqual(['Alda', 'Bram', 'Cara'])
  })
  it('does not change the original list', () => {
    sortParty(party, 'hp')
    expect(party[0].name).toBe('Cara')
  })
})
