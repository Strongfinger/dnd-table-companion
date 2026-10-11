import { describe, expect, it } from 'vitest'
import { createCharacter } from './character'
import { actionSuggestions, cleanDetail } from './actionSuggestions'

const boom = createCharacter({
  name: 'Boom',
  attacks: [{ id: 'a', name: 'Greatsword', ability: 'str', proficient: true, damageDice: '2d6', damageType: 'slashing', addModToDamage: true }],
  features: [{ id: 'sw', name: 'Second Wind', max: 2, used: 0, recharge: 'short' }],
  spells: [{ id: 's', name: 'Bless', level: 1, prepared: true }],
})

describe('actionSuggestions', () => {
  it('Action: the character\'s attacks and spells first, then the standard actions', () => {
    const list = actionSuggestions('action', boom)
    expect(list.slice(0, 3)).toEqual(['Attack: Greatsword', 'Magic: Bless', 'Second Wind'])
    expect(list).toContain('Dash')
    expect(list).toContain('Dodge')
  })

  it('Bonus Action and Reaction have their own common choices', () => {
    expect(actionSuggestions('bonusAction', boom)).toContain('Off-hand Attack (Light weapon)')
    expect(actionSuggestions('reaction', null)).toEqual(['Opportunity Attack', 'Readied action'])
  })

  it('Concentration suggests spell names only', () => {
    expect(actionSuggestions('concentration', boom)).toEqual(['Bless'])
    expect(actionSuggestions('concentration', null)).toEqual([])
  })

  it('no duplicates', () => {
    const c = { ...boom, features: [{ id: 'x', name: 'Dash', max: 1, used: 0, recharge: 'short' as const }] }
    const list = actionSuggestions('action', c)
    expect(list.filter((x) => x === 'Dash')).toHaveLength(1)
  })
})

describe('cleanDetail', () => {
  it('trims spaces and length', () => {
    expect(cleanDetail('  Attack:   Greatsword  ')).toBe('Attack: Greatsword')
    expect(cleanDetail('x'.repeat(150))).toHaveLength(100)
  })
})
