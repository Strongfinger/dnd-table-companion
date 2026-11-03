import { describe, expect, it } from 'vitest'
import { canSplit, copyName, meetsSplitHp, monsterBaseName, splitHitPoints, splitNames } from './split'

describe('splitHitPoints (SRD Split: divide evenly, round down)', () => {
  it('halves even HP', () => expect(splitHitPoints(52)).toBe(26))
  it('rounds odd HP down', () => expect(splitHitPoints(45)).toBe(22))
  it('never goes below 0', () => {
    expect(splitHitPoints(0)).toBe(0)
    expect(splitHitPoints(-3)).toBe(0)
  })
})

describe('canSplit / meetsSplitHp', () => {
  it('needs 2+ HP so each half has 1 HP', () => {
    expect(canSplit(1)).toBe(false)
    expect(canSplit(2)).toBe(true)
  })
  it('the SRD trigger needs 10+ HP', () => {
    expect(meetsSplitHp(9)).toBe(false)
    expect(meetsSplitHp(10)).toBe(true)
  })
})

describe('splitNames', () => {
  it('adds A and B', () => expect(splitNames('Ochre Jelly', [])).toEqual(['Ochre Jelly A', 'Ochre Jelly B']))
  it('adds another letter when a half splits again', () => {
    expect(splitNames('Ochre Jelly A', ['Ochre Jelly A', 'Ochre Jelly B'])).toEqual(['Ochre Jelly AA', 'Ochre Jelly AB'])
  })
  it('skips letters other combatants use', () => {
    expect(splitNames('Ochre Jelly', ['Ochre Jelly A', 'Ochre Jelly B'])).toEqual(['Ochre Jelly C', 'Ochre Jelly D'])
  })
  it('works with numbered monsters', () => expect(splitNames('Black Pudding 2', [])).toEqual(['Black Pudding 2 A', 'Black Pudding 2 B']))
  it('names an empty name "Monster"', () => expect(splitNames('  ', [])).toEqual(['Monster A', 'Monster B']))
  it('falls back to numbers after Z', () => {
    const taken = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('').map((l) => `Ooze ${l}`)
    expect(splitNames('Ooze', taken)).toEqual(['Ooze 27', 'Ooze 28'])
  })
})

describe('copyName', () => {
  it('numbers a copy of an unnumbered monster 2', () => expect(copyName('Goblin', ['Goblin'])).toBe('Goblin 2'))
  it('continues after the highest number', () => expect(copyName('Goblin 1', ['Goblin 1', 'Goblin 3', 'Goblin Boss'])).toBe('Goblin 4'))
  it('keeps split letters', () => expect(copyName('Ochre Jelly A', ['Ochre Jelly A', 'Ochre Jelly B'])).toBe('Ochre Jelly A 2'))
})

describe('monsterBaseName', () => {
  it('drops copy numbers and split letters', () => {
    expect(monsterBaseName('Goblin 3')).toBe('Goblin')
    expect(monsterBaseName('Ochre Jelly AB')).toBe('Ochre Jelly')
    expect(monsterBaseName('Ochre Jelly A 2')).toBe('Ochre Jelly')
    expect(monsterBaseName('Black Pudding 2 A')).toBe('Black Pudding')
  })
  it('keeps normal names', () => {
    expect(monsterBaseName('Goblin Boss')).toBe('Goblin Boss')
    expect(monsterBaseName('Young White Dragon')).toBe('Young White Dragon')
  })
})
