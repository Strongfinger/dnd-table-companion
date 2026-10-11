import { describe, expect, it } from 'vitest'
import { nextTurn, previousTurn, sortByInitiative, startCombat, type TurnCombatant } from './turns'

const c = (id: string, initiative: number | null, dexMod = 0, extra: Partial<TurnCombatant> = {}): TurnCombatant => ({
  id, name: id, initiative, dexMod, tieBreak: 0, defeated: false, effects: [], ...extra,
})

describe('sortByInitiative', () => {
  it('highest first, unrolled last', () => {
    expect(sortByInitiative([c('a', 10), c('b', null), c('c', 18), c('d', 3)]).map((x) => x.id)).toEqual(['c', 'a', 'd', 'b'])
  })

  it('ties: DM tiebreak, then higher DEX, then name', () => {
    const list = [c('Zed', 15, 1), c('Amy', 15, 3), c('Bob', 15, 1), c('Gob', 15, 0, { tieBreak: 1 })]
    expect(sortByInitiative(list).map((x) => x.id)).toEqual(['Gob', 'Amy', 'Bob', 'Zed'])
  })
})

describe('turns', () => {
  const order = sortByInitiative([c('fighter', 18), c('goblin', 12), c('wizard', 7)])

  it('startCombat begins round 1 with the highest initiative', () => {
    expect(startCombat(order).state).toEqual({ round: 1, activeId: 'fighter' })
  })

  it('nextTurn moves down the order and wraps into a new round', () => {
    let state = { round: 1, activeId: 'fighter' as string | null }
    state = nextTurn(order, state).state
    expect(state).toEqual({ round: 1, activeId: 'goblin' })
    state = nextTurn(order, state).state
    expect(state).toEqual({ round: 1, activeId: 'wizard' })
    const r = nextTurn(order, state)
    expect(r.state).toEqual({ round: 2, activeId: 'fighter' })
    expect(r.events[0].text).toContain('รอบที่ 2')
  })

  it('skips defeated combatants and ones without initiative', () => {
    const list = [c('fighter', 18), c('goblin', 12, 0, { defeated: true }), c('late', null), c('wizard', 7)]
    expect(nextTurn(sortByInitiative(list), { round: 1, activeId: 'fighter' }).state.activeId).toBe('wizard')
  })

  it('previousTurn goes back, across rounds, but not before round 1', () => {
    expect(previousTurn(order, { round: 2, activeId: 'fighter' })).toEqual({ round: 1, activeId: 'wizard' })
    expect(previousTurn(order, { round: 1, activeId: 'goblin' })).toEqual({ round: 1, activeId: 'fighter' })
    expect(previousTurn(order, { round: 1, activeId: 'fighter' })).toEqual({ round: 1, activeId: 'fighter' })
  })
})

describe('timed effects', () => {
  const stunned = { id: 's', name: 'Stunned', rounds: 1, ends: 'end' as const }
  const blessed = { id: 'b', name: 'Bless', rounds: 2, ends: 'start' as const }
  const prone = { id: 'p', name: 'Prone', rounds: null, ends: 'end' as const }

  it('"end of turn" effects count down when that creature\'s turn ends', () => {
    const order = [c('goblin', 15, 0, { effects: [stunned, prone] }), c('fighter', 10)]
    const r = nextTurn(order, { round: 1, activeId: 'goblin' })
    expect(r.combatants[0].effects).toEqual([prone]) // Stunned ran out, Prone stays
    expect(r.events.map((e) => e.text)).toContain('goblin: Stunned หมดผล')
  })

  it('"start of turn" effects count down when that creature\'s turn starts', () => {
    const order = [c('goblin', 15), c('fighter', 10, 0, { effects: [blessed] })]
    const r1 = nextTurn(order, { round: 1, activeId: 'goblin' })
    expect(r1.combatants[1].effects[0].rounds).toBe(1)
    const r2 = nextTurn(r1.combatants, nextTurn(r1.combatants, r1.state).state) // fighter → goblin → fighter
    expect(r2.combatants[1].effects).toEqual([])
  })

  it('effects on other combatants do not tick', () => {
    const order = [c('goblin', 15), c('fighter', 10), c('wizard', 5, 0, { effects: [stunned] })]
    const r = nextTurn(order, { round: 1, activeId: 'goblin' })
    expect(r.combatants[2].effects).toEqual([stunned])
  })
})

describe('turn edge cases', () => {
  const three = () => sortByInitiative([c('fighter', 18), c('goblin', 12), c('wizard', 7)])

  it('the active combatant is defeated, then Next: continues from its place, same round', () => {
    const list = three().map((x) => (x.id === 'goblin' ? { ...x, defeated: true } : x))
    expect(nextTurn(list, { round: 2, activeId: 'goblin' }).state).toEqual({ round: 2, activeId: 'wizard' })
  })

  it('the last combatant is defeated on its turn: wraps into the next round', () => {
    const list = three().map((x) => (x.id === 'wizard' ? { ...x, defeated: true } : x))
    expect(nextTurn(list, { round: 2, activeId: 'wizard' }).state).toEqual({ round: 3, activeId: 'fighter' })
  })

  it('previousTurn works when the active combatant was defeated', () => {
    const list = three().map((x) => (x.id === 'goblin' ? { ...x, defeated: true } : x))
    expect(previousTurn(list, { round: 1, activeId: 'goblin' })).toEqual({ round: 1, activeId: 'fighter' })
  })

  it('everyone defeated: no active combatant and a message', () => {
    const list = three().map((x) => ({ ...x, defeated: true }))
    const r = nextTurn(list, { round: 3, activeId: 'fighter' })
    expect(r.state.activeId).toBeNull()
    expect(r.events[0].text).toContain('ไม่มีใคร')
    expect(startCombat(list).state.activeId).toBeNull()
  })

  it('a single combatant wraps to itself and ticks both end and start effects', () => {
    const solo = [c('solo', 10, 0, { effects: [
      { id: 'e', name: 'Stunned', rounds: 1, ends: 'end' },
      { id: 's', name: 'Bless', rounds: 2, ends: 'start' },
      { id: 'n', name: 'Prone', rounds: null, ends: 'start' },
    ] })]
    const r = nextTurn(solo, { round: 1, activeId: 'solo' })
    expect(r.state).toEqual({ round: 2, activeId: 'solo' })
    expect(r.combatants[0].effects.map((e) => [e.name, e.rounds])).toEqual([['Bless', 1], ['Prone', null]])
  })

  it('someone added mid-round above the current turn waits for the next round', () => {
    const list = sortByInitiative([...three(), c('late', 20)])
    const r = nextTurn(list, { round: 1, activeId: 'goblin' })
    expect(r.state.activeId).toBe('wizard')
    expect(nextTurn(list, r.state).state).toEqual({ round: 2, activeId: 'late' })
  })

  it('the first Next with no active combatant starts round 1 at the top', () => {
    expect(nextTurn(three(), { round: 1, activeId: null }).state).toEqual({ round: 1, activeId: 'fighter' })
  })

  it('a multi-round effect counts down once per turn', () => {
    const list = [c('a', 10, 0, { effects: [{ id: 'x', name: 'Bane', rounds: 3, ends: 'end' }] }), c('b', 5)]
    let r = nextTurn(list, { round: 1, activeId: 'a' }) // a's turn ends: 2 left
    expect(r.combatants[0].effects[0].rounds).toBe(2)
    r = nextTurn(r.combatants, r.state) // b ends, a starts: still 2
    expect(r.combatants[0].effects[0].rounds).toBe(2)
  })
})
