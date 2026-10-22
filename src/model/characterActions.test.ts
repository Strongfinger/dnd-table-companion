import { describe, expect, it } from 'vitest'
import { createCharacter } from './character'
import { applyCharacterAction, parseCharacterAction, type CharacterAction } from './characterActions'

const cleric = createCharacter({
  name: 'PetchYom', className: 'Cleric', level: 1, scores: { str: 14, dex: 8, con: 15, int: 12, wis: 16, cha: 10 },
  hp: { max: 11, current: 11, temp: 0 },
  spellSlots: [{ max: 2, used: 0 }, ...Array.from({ length: 8 }, () => ({ max: 0, used: 0 }))],
  features: [{ id: 'cd', name: 'Channel Divinity', max: 2, used: 0, recharge: 'short' }],
})
const apply = (a: CharacterAction, c = cleric) => applyCharacterAction(c, a)

describe('applyCharacterAction', () => {
  it('HP actions use the shared rules', () => {
    expect(apply({ type: 'damage', amount: 4, critical: false })!.character.hp.current).toBe(7)
    const hurt = apply({ type: 'damage', amount: 4, critical: false })!.character
    expect(apply({ type: 'heal', amount: 10 }, hurt)!.character.hp.current).toBe(11)
    expect(apply({ type: 'tempHp', amount: 5 })!.character.hp.temp).toBe(5)
  })

  it('set actions are absolute: applying twice changes nothing the second time', () => {
    const once = apply({ type: 'setSlotUsed', level: 0, used: 1 })!.character
    expect(once.spellSlots[0].used).toBe(1)
    expect(apply({ type: 'setSlotUsed', level: 0, used: 1 }, once)).toBeNull()

    const prone = apply({ type: 'setCondition', condition: 'Prone', on: true })!.character
    expect(prone.conditions).toEqual(['Prone'])
    expect(apply({ type: 'setCondition', condition: 'Prone', on: true }, prone)).toBeNull()
    expect(apply({ type: 'setCondition', condition: 'Prone', on: false }, prone)!.character.conditions).toEqual([])
  })

  it('spending a slot marks this turn (one slot per turn); a new turn clears it', () => {
    const spent = apply({ type: 'setSlotUsed', level: 0, used: 1 })!.character
    expect(spent.turn.spellSlot).toBe(true)
    expect(apply({ type: 'setSlotUsed', level: 0, used: 0 }, spent)!.character.turn.spellSlot).toBe(true) // giving back keeps it
    expect(apply({ type: 'resetTurn' }, spent)!.character.turn.spellSlot).toBeFalsy()
  })

  it('slot and feature use is kept within limits', () => {
    expect(apply({ type: 'setSlotUsed', level: 0, used: 9 })!.character.spellSlots[0].used).toBe(2)
    expect(apply({ type: 'setSlotUsed', level: 5, used: 1 })).toBeNull() // no 6th-level slots: max 0
    expect(apply({ type: 'setFeatureUsed', featureId: 'cd', used: 1 })!.character.features[0].used).toBe(1)
    expect(apply({ type: 'setFeatureUsed', featureId: 'nope', used: 1 })).toBeNull()
  })

  it('logs a pool spend with the number of points', () => {
    const pally = createCharacter({ name: 'Ser', features: [{ id: 'loh', name: 'Lay On Hands', max: 25, used: 0, recharge: 'long', pool: true }] })
    expect(applyCharacterAction(pally, { type: 'setFeatureUsed', featureId: 'loh', used: 7 })!.text).toBe('Ser ใช้ Lay On Hands 7 แต้ม (เหลือ 18/25)')
  })

  it('rests, Hit Dice, exhaustion, inspiration, concentration, action economy', () => {
    const hurt = apply({ type: 'damage', amount: 8, critical: false })!.character // 3/11
    expect(apply({ type: 'spendHitDie', roll: 5, manual: true }, hurt)!.character.hp.current).toBe(3 + 5 + 2)
    expect(apply({ type: 'longRest' }, hurt)!.character.hp.current).toBe(11)
    expect(apply({ type: 'setExhaustion', level: 9 })!.character.exhaustion).toBe(6)
    expect(apply({ type: 'setInspiration', on: true })!.character.heroicInspiration).toBe(true)
    expect(apply({ type: 'setConcentration', spell: 'Bless' })!.text).toContain('Bless')
    const used = apply({ type: 'setActionUsed', kind: 'reaction', used: true })!.character
    expect(used.turn.reaction).toBe(true)
    expect(apply({ type: 'resetTurn' }, used)!.character.turn).toEqual({ action: false, bonusAction: false, reaction: false })
  })

  it('death saves and revive', () => {
    const down = apply({ type: 'damage', amount: 11, critical: false })!.character
    const dead = [1, 5].reduce((ch, d20) => apply({ type: 'deathSave', d20, manual: true }, ch)!.character, down)
    expect(dead.deathSaves.failures).toBe(3)
    expect(apply({ type: 'revive' }, dead)!.character.hp.current).toBe(1)
  })
})

describe('parseCharacterAction (data from another device)', () => {
  it('accepts valid actions and drops unknown fields', () => {
    expect(parseCharacterAction({ type: 'damage', amount: 5, critical: true, hacked: 1 })).toEqual({ type: 'damage', amount: 5, critical: true })
    expect(parseCharacterAction({ type: 'setCondition', condition: 'Prone', on: true })).toEqual({ type: 'setCondition', condition: 'Prone', on: true })
    expect(parseCharacterAction({ type: 'longRest' })).toEqual({ type: 'longRest' })
  })

  it('rejects anything malformed or out of range', () => {
    const bad = [
      null, 'damage', [], {}, { type: 'explode' },
      { type: 'damage', amount: -1, critical: false }, { type: 'damage', amount: 5 }, { type: 'damage', amount: 1.5, critical: false },
      { type: 'deathSave', d20: 21, manual: false }, { type: 'setSlotUsed', level: 9, used: 1 },
      { type: 'setCondition', condition: 'Exhaustion', on: true }, { type: 'setCondition', condition: 'Flying', on: true },
      { type: 'setConcentration', spell: 'x'.repeat(101) }, { type: 'setActionUsed', kind: 'movement', used: true },
      { type: 'heal', amount: '5' },
    ]
    for (const v of bad) expect(parseCharacterAction(v), JSON.stringify(v)).toBeNull()
  })
})

describe('actions that only make sense in the right state', () => {
  const dead = { ...cleric, hp: { max: 11, current: 0, temp: 0 }, deathSaves: { successes: 0, failures: 3 } }
  const stable = { ...cleric, hp: { max: 11, current: 0, temp: 0 }, deathSaves: { successes: 3, failures: 0 } }

  it('death saves only while dying (not alive, Stable or dead)', () => {
    expect(apply({ type: 'deathSave', d20: 20, manual: false })).toBeNull()
    expect(apply({ type: 'deathSave', d20: 1, manual: false }, stable)).toBeNull()
    expect(apply({ type: 'deathSave', d20: 20, manual: false }, dead)).toBeNull()
  })

  it('revive only when dead', () => {
    expect(apply({ type: 'revive' })).toBeNull()
    expect(apply({ type: 'revive' }, dead)!.character.hp.current).toBe(1)
  })

  it('a Hit Die roll above the class die is refused (Cleric d8)', () => {
    const hurt = { ...cleric, hp: { max: 11, current: 3, temp: 0 } }
    expect(apply({ type: 'spendHitDie', roll: 9, manual: true }, hurt)).toBeNull()
    expect(apply({ type: 'spendHitDie', roll: 8, manual: true }, hurt)!.text).toContain('d8')
  })

  it('long rest at 0 HP does nothing; Hit Dice at 0 HP or with none left do nothing', () => {
    expect(apply({ type: 'longRest' }, stable)).toBeNull()
    expect(apply({ type: 'spendHitDie', roll: 5, manual: true }, stable)).toBeNull()
    expect(apply({ type: 'spendHitDie', roll: 5, manual: true }, { ...cleric, hp: { max: 11, current: 3, temp: 0 }, hitDiceSpent: 1 })).toBeNull()
  })

  it('condition log lines keep the Thai gloss', () => {
    expect(apply({ type: 'setCondition', condition: 'Prone', on: true })!.text).toContain('Prone (ล้มลง)')
  })

  it('the parser refuses zero amounts and odd values', () => {
    for (const v of [
      { type: 'heal', amount: 0 }, { type: 'damage', amount: 0, critical: false }, { type: 'tempHp', amount: 1000 },
      { type: 'damage', amount: Number.NaN, critical: false }, { type: 'heal', amount: Infinity },
      { type: 'setFeatureUsed', featureId: '', used: 1 }, { type: '__proto__' },
    ]) expect(parseCharacterAction(v), JSON.stringify(v)).toBeNull()
  })
})

describe('using Action / Bonus Action / Reaction is logged with what it was for', () => {
  it('logs the detail when used, nothing when given back', () => {
    const used = apply({ type: 'setActionUsed', kind: 'action', used: true, detail: 'Attack: Mace' })!
    expect(used.text).toBe('⚡ PetchYom ใช้ Action: Attack: Mace')
    expect(apply({ type: 'setActionUsed', kind: 'action', used: false }, used.character)!.text).toBe('')
    expect(apply({ type: 'setActionUsed', kind: 'bonusAction', used: true })!.text).toBe('⚡ PetchYom ใช้ Bonus Action')
  })

  it('the parser keeps a short detail and refuses a long one', () => {
    expect(parseCharacterAction({ type: 'setActionUsed', kind: 'reaction', used: true, detail: 'Shield' })).toEqual({ type: 'setActionUsed', kind: 'reaction', used: true, detail: 'Shield' })
    expect(parseCharacterAction({ type: 'setActionUsed', kind: 'reaction', used: true, detail: 'x'.repeat(101) })).toBeNull()
    expect(parseCharacterAction({ type: 'setActionUsed', kind: 'reaction', used: true, detail: 5 })).toBeNull()
  })
})

describe('restoreVitals (the tracker undo)', () => {
  const hit = applyCharacterAction(cleric, { type: 'damage', amount: 20, critical: false })!.character // 0 HP, Unconscious, dying
  const restore: CharacterAction = {
    type: 'restoreVitals', hp: { current: 11, temp: 0 }, deathSaves: { successes: 0, failures: 0 }, conditions: [], concentration: '',
  }

  it('puts HP, death saves, conditions and Concentration back', () => {
    expect(hit.hp.current).toBe(0)
    expect(hit.conditions).toContain('Unconscious')
    const r = applyCharacterAction(hit, restore)!.character
    expect(r.hp).toEqual(cleric.hp)
    expect(r.conditions).toEqual([])
    expect(r.deathSaves).toEqual({ successes: 0, failures: 0 })
  })
  it('restores Concentration lost at 0 HP', () => {
    const conc = { ...cleric, concentration: 'Bless' }
    const down = applyCharacterAction(conc, { type: 'damage', amount: 20, critical: false })!.character
    expect(down.concentration).toBe('')
    expect(applyCharacterAction(down, { ...restore, concentration: 'Bless' })!.character.concentration).toBe('Bless')
  })
  it('keeps HP inside 0..max and only real conditions, once each', () => {
    const r = applyCharacterAction(hit, { ...restore, hp: { current: 99, temp: -3 }, conditions: ['Prone', 'Prone', 'Exhaustion' as never] })!.character
    expect(r.hp).toMatchObject({ current: 11, temp: 0 })
    expect(r.conditions).toEqual(['Prone'])
  })
  it('does nothing (null) when the sheet already matches', () => {
    expect(applyCharacterAction(cleric, restore)).toBeNull()
  })
  it('is never accepted from another device', () => {
    expect(parseCharacterAction(restore)).toBeNull()
  })
})
