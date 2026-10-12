import { describe, expect, it } from 'vitest'
import { createCharacter } from './character'
import { playerMay, recordUses, refundAllowed, refundKeys, useKeys } from './permissions'

const cleric = createCharacter({
  name: 'PetchYom', className: 'Cleric', level: 3,
  spellSlots: [{ max: 4, used: 2 }, { max: 2, used: 0 }, ...Array.from({ length: 7 }, () => ({ max: 0, used: 0 }))],
  features: [{ id: 'cd', name: 'Channel Divinity', max: 2, used: 1, recharge: 'short' }],
  turn: { action: true, bonusAction: false, reaction: false },
})

describe('refundKeys / useKeys', () => {
  it('tells spending from giving back', () => {
    expect(useKeys(cleric, { type: 'setSlotUsed', level: 0, used: 3 })).toEqual(['slot:0'])
    expect(refundKeys(cleric, { type: 'setSlotUsed', level: 0, used: 1 })).toEqual(['slot:0'])
    expect(refundKeys(cleric, { type: 'setSlotUsed', level: 0, used: 3 })).toEqual([])
    expect(useKeys(cleric, { type: 'setActionUsed', kind: 'bonusAction', used: true })).toEqual(['turn:bonusAction'])
    expect(refundKeys(cleric, { type: 'setActionUsed', kind: 'action', used: false })).toEqual(['turn:action'])
    expect(refundKeys(cleric, { type: 'setFeatureUsed', featureId: 'cd', used: 0 })).toEqual(['feature:cd'])
    expect(useKeys(cleric, { type: 'setFeatureUsed', featureId: 'cd', used: 2 })).toEqual(['feature:cd'])
  })

  it('a new turn or resetting slots from the table gives back what was used', () => {
    expect(refundKeys(cleric, { type: 'resetTurn' })).toEqual(['turn:action'])
    expect(refundKeys(cleric, { type: 'setSlotsFromTable' })).toEqual(['slot:0'])
  })

  it('other actions are neither', () => {
    expect(refundKeys(cleric, { type: 'damage', amount: 3, critical: false })).toEqual([])
    expect(useKeys(cleric, { type: 'heal', amount: 3 })).toEqual([])
  })
})

describe('playerMay (in a live room)', () => {
  it('lets players spend but not give back, rest or start a new turn', () => {
    expect(playerMay(cleric, { type: 'setSlotUsed', level: 0, used: 3 }).ok).toBe(true)
    expect(playerMay(cleric, { type: 'setActionUsed', kind: 'reaction', used: true }).ok).toBe(true)
    expect(playerMay(cleric, { type: 'damage', amount: 2, critical: false }).ok).toBe(true)
    expect(playerMay(cleric, { type: 'setSlotUsed', level: 0, used: 1 }).ok).toBe(false)
    expect(playerMay(cleric, { type: 'setActionUsed', kind: 'action', used: false }).ok).toBe(false)
    expect(playerMay(cleric, { type: 'setFeatureUsed', featureId: 'cd', used: 0 }).ok).toBe(false)
    expect(playerMay(cleric, { type: 'resetTurn' }).ok).toBe(false)
    expect(playerMay(cleric, { type: 'shortRest' }).ok).toBe(false)
    expect(playerMay(cleric, { type: 'longRest' }).ok).toBe(false)
  })
})

describe('refundAllowed (DM)', () => {
  const fight = { id: 'f1', round: 3 }
  const uses = recordUses({}, cleric.id, ['slot:0', 'turn:action'], fight)

  it('allows a give-back in the round the use was spent', () => {
    expect(refundAllowed(cleric.id, ['slot:0'], uses, fight).ok).toBe(true)
    expect(refundAllowed(cleric.id, ['slot:0', 'turn:action'], uses, fight).ok).toBe(true)
  })

  it('refuses it in a later round, or when the use was not seen', () => {
    expect(refundAllowed(cleric.id, ['slot:0'], uses, { id: 'f1', round: 4 }).ok).toBe(false)
    expect(refundAllowed(cleric.id, ['feature:cd'], uses, fight).ok).toBe(false)
    expect(refundAllowed('someone-else', ['slot:0'], uses, fight).ok).toBe(false)
  })

  it('allows it any time outside a fight, and non-refunds always', () => {
    expect(refundAllowed(cleric.id, ['slot:0'], {}, null).ok).toBe(true)
    expect(refundAllowed(cleric.id, [], {}, fight).ok).toBe(true)
  })

  it('remembers only uses from the current fight', () => {
    const later = recordUses(uses, cleric.id, ['slot:1'], { id: 'f2', round: 1 })
    expect(Object.keys(later)).toEqual([`${cleric.id}|slot:1`])
  })
})
