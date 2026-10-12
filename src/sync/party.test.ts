import { describe, expect, it } from 'vitest'
import { createCharacter } from '../model/character'
import { parseParty, partyCards } from './party'

describe('party cards for players', () => {
  const boom = { ...createCharacter({ name: 'Boom', hp: { max: 19, current: 7, temp: 2 } }), ac: 16, conditions: ['Prone' as const], notes: 'secret plan' }
  const nyx = { ...createCharacter({ name: 'Nyx' }), turn: { action: true, bonusAction: false, reaction: true } }
  const cards = partyCards([nyx, boom])

  it('basic stats and this turn only, sorted by name', () => {
    expect(cards.map((c) => c.name)).toEqual(['Boom', 'Nyx'])
    expect(cards[0]).toMatchObject({ ac: 16, hp: { current: 7, max: 19, temp: 2 }, conditions: ['Prone'] })
    expect(cards[1].turn).toEqual({ action: true, bonusAction: false, reaction: true })
  })

  it('nothing else of the sheet goes out', () => {
    const json = JSON.stringify(cards)
    expect(json).not.toContain('secret plan')
    expect(json).not.toContain('spellSlots')
    expect(json).not.toContain('abilities')
  })

  it('a valid message reads back the same', () => {
    expect(parseParty(JSON.parse(JSON.stringify({ cards })))).toEqual(cards)
  })

  it('bad data is refused or cleaned', () => {
    expect(parseParty(null)).toBeNull()
    expect(parseParty({ cards: [{ ...cards[0], hp: { current: -5, max: 10 } }] })).toBeNull()
    expect(parseParty({ cards: [{ ...cards[0], conditions: ['Prone', 'Hacked'] }] })?.[0].conditions).toEqual(['Prone'])
  })
})
