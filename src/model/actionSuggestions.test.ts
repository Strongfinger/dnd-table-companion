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

const SRD = [
  { name: 'Bless', castingTime: 'Action', concentration: true },
  { name: 'Fire Bolt', castingTime: 'Action', concentration: false },
  { name: 'Healing Word', castingTime: 'Bonus Action', concentration: false },
  { name: 'Hex', castingTime: 'Bonus Action', concentration: true },
  { name: 'Shield', castingTime: 'Reaction, which you take when you are hit by an attack roll', concentration: false },
  { name: 'Ritual Thing', castingTime: '1 minute', concentration: false },
]

const caster = createCharacter({
  name: 'Mira',
  spells: [
    { id: '1', name: 'Fire Bolt', level: 0, prepared: true },
    { id: '2', name: 'Bless', level: 1, prepared: true },
    { id: '3', name: 'Healing Word', level: 1, prepared: true },
    { id: '4', name: 'Hex', level: 1, prepared: true },
    { id: '5', name: 'Shield', level: 1, prepared: true },
    { id: '6', name: 'Ritual Thing', level: 1, prepared: true },
    { id: '7', name: 'My Homebrew Bolt', level: 1, prepared: true },
    { id: '8', name: 'Not Ready', level: 1, prepared: false },
  ],
  features: [
    { id: 'r', name: 'Rage', max: 2, used: 0, recharge: 'long', srdId: 'barbarian-rage' },
    { id: 'as', name: 'Action Surge', max: 1, used: 0, recharge: 'short', srdId: 'fighter-action-surge' },
    { id: 'fp', name: 'Focus Points', max: 2, used: 0, recharge: 'short', pool: true, srdId: 'monk-monks-focus' },
    { id: 'hb', name: 'Homebrew Trick', max: 1, used: 0, recharge: 'long' },
  ],
})

describe('actionSuggestions: only what fits the button', () => {
  const magic = (list: string[]) => list.filter((x) => x.startsWith('Magic: '))

  it('Bonus Action: only Bonus Action spells and features', () => {
    const list = actionSuggestions('bonusAction', caster, SRD)
    expect(magic(list)).toEqual(['Magic: Healing Word', 'Magic: Hex'])
    expect(list).toContain('Rage')
    expect(list).toContain('Focus Points')
    expect(list).not.toContain('Action Surge')
    expect(list).not.toContain('Homebrew Trick')
  })

  it('Action: Action spells plus spells not in the SRD; no long casting times', () => {
    const list = actionSuggestions('action', caster, SRD)
    expect(magic(list)).toEqual(['Magic: Fire Bolt', 'Magic: Bless', 'Magic: My Homebrew Bolt'])
    expect(list).toContain('Homebrew Trick')
    expect(list).not.toContain('Rage')
  })

  it('Reaction: Reaction spells only', () => {
    expect(magic(actionSuggestions('reaction', caster, SRD))).toEqual(['Magic: Shield'])
  })

  it('unprepared spells are left out', () => {
    for (const kind of ['action', 'bonusAction', 'reaction', 'concentration'] as const) {
      expect(actionSuggestions(kind, caster, SRD).join()).not.toContain('Not Ready')
    }
  })

  it('Concentration: only spells that need it (plus ones we cannot check)', () => {
    expect(actionSuggestions('concentration', caster, SRD)).toEqual(['Bless', 'Hex', 'My Homebrew Bolt'])
  })

  it('while the SRD list is loading, spells count as an Action', () => {
    expect(magic(actionSuggestions('bonusAction', caster, null))).toEqual([])
    expect(magic(actionSuggestions('action', caster, null))).toHaveLength(7)
  })
})

describe('cleanDetail', () => {
  it('trims spaces and length', () => {
    expect(cleanDetail('  Attack:   Greatsword  ')).toBe('Attack: Greatsword')
    expect(cleanDetail('x'.repeat(150))).toHaveLength(100)
  })
})
