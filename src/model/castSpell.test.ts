import { describe, expect, it } from 'vitest'
import { createCharacter } from './character'
import { actionKindFor, castableSlotLevels, castPlan, type CastableSpell } from './castSpell'

const wizard = createCharacter({
  name: 'Nyx', className: 'Wizard', level: 5,
  spellSlots: [{ max: 4, used: 4 }, { max: 3, used: 1 }, { max: 2, used: 0 }, ...Array.from({ length: 6 }, () => ({ max: 0, used: 0 }))],
})
const spell = (s: Partial<CastableSpell>): CastableSpell => ({ name: 'Magic Missile', level: 1, castingTime: 'Action', concentration: false, ritual: false, prepared: true, ...s })

describe('actionKindFor', () => {
  it('reads the casting time', () => {
    expect(actionKindFor('Action')).toBe('action')
    expect(actionKindFor('Bonus Action, which you take immediately after hitting a target')).toBe('bonusAction')
    expect(actionKindFor('Reaction, which you take when you are hit')).toBe('reaction')
    expect(actionKindFor('1 minute')).toBeNull()
  })
})

describe('castableSlotLevels', () => {
  it('lists slot levels at or above the spell with a slot left', () => {
    expect(castableSlotLevels(wizard, 1)).toEqual([2, 3]) // level 1 slots are all used
    expect(castableSlotLevels(wizard, 3)).toEqual([3])
    expect(castableSlotLevels(wizard, 4)).toEqual([])
  })
})

describe('castPlan', () => {
  it('spends the Action and the chosen slot (upcasting is noted)', () => {
    const p = castPlan(wizard, spell({}), { slotLevel: 2, asRitual: false })
    expect(p.error).toBeNull()
    expect(p.actions).toEqual([
      { type: 'setActionUsed', kind: 'action', used: true, detail: 'ร่าย Magic Missile (Level 2)' },
      { type: 'setSlotUsed', level: 1, used: 2 },
    ])
  })

  it('a cantrip costs only its action; a Concentration spell sets Concentration', () => {
    expect(castPlan(wizard, spell({ name: 'Fire Bolt', level: 0 }), { slotLevel: null, asRitual: false }).actions)
      .toEqual([{ type: 'setActionUsed', kind: 'action', used: true, detail: 'ร่าย Fire Bolt' }])
    const hold = castPlan({ ...wizard, concentration: 'Bless' }, spell({ name: 'Hold Person', level: 2, concentration: true }), { slotLevel: 2, asRitual: false })
    expect(hold.actions.at(-1)).toEqual({ type: 'setConcentration', spell: 'Hold Person' })
    expect(hold.warnings.join()).toMatch(/Bless/)
  })

  it('refuses without a slot, or when the Action is already used', () => {
    expect(castPlan(wizard, spell({}), { slotLevel: 1, asRitual: false }).error).toMatch(/Spell Slot/)
    const used = { ...wizard, turn: { action: true, bonusAction: false, reaction: false } }
    expect(castPlan(used, spell({}), { slotLevel: 2, asRitual: false }).error).toMatch(/Action/)
    // A Reaction spell still works after the Action is used.
    expect(castPlan(used, spell({ name: 'Shield', castingTime: 'Reaction, which you take when you are hit' }), { slotLevel: 2, asRitual: false }).error).toBeNull()
  })

  it('a Ritual needs no slot and no action; unprepared spells get a warning', () => {
    const r = castPlan(wizard, spell({ name: 'Detect Magic', ritual: true, concentration: true }), { slotLevel: null, asRitual: true })
    expect(r.error).toBeNull()
    expect(r.actions).toEqual([{ type: 'setConcentration', spell: 'Detect Magic' }])
    expect(castPlan(wizard, spell({ prepared: false }), { slotLevel: 2, asRitual: false }).warnings.join()).toMatch(/Prepared/)
  })
})

describe('castPlan: more cases', () => {
  it('Warlock Pact Magic: a level 1 spell is cast with the pact slot (upcast to its level)', () => {
    const warlock = createCharacter({ name: 'W', className: 'Warlock', level: 5, spellSlots: [{ max: 0, used: 0 }, { max: 0, used: 0 }, { max: 2, used: 0 }, ...Array.from({ length: 6 }, () => ({ max: 0, used: 0 }))] })
    expect(castableSlotLevels(warlock, 1)).toEqual([3])
    expect(castPlan(warlock, spell({ name: 'Hex', castingTime: 'Bonus Action' }), { slotLevel: 3, asRitual: false }).actions)
      .toEqual([{ type: 'setActionUsed', kind: 'bonusAction', used: true, detail: 'ร่าย Hex (Level 3)' }, { type: 'setSlotUsed', level: 2, used: 1 }])
  })

  it('a long casting time uses no Action and says how long', () => {
    const p = castPlan(wizard, spell({ name: 'Find Familiar', castingTime: '1 hour' }), { slotLevel: 2, asRitual: false })
    expect(p.actions).toEqual([{ type: 'setSlotUsed', level: 1, used: 2 }])
    expect(p.warnings.join()).toMatch(/1 hour/)
  })

  it('recasting the same Concentration spell gives no "will end" warning', () => {
    const p = castPlan({ ...wizard, concentration: 'Hold Person' }, spell({ name: 'Hold Person', level: 2, concentration: true }), { slotLevel: 2, asRitual: false })
    expect(p.warnings.join()).not.toMatch(/หลุด/)
  })
})

describe('castPlan: 2024 casting rules (SRD 5.2.1)', () => {
  const detect = spell({ name: 'Detect Magic', castingTime: 'Action', ritual: true, concentration: true, prepared: false })
  const cleric = { ...wizard, className: 'Cleric' as const }

  it('a Ritual needs the spell prepared, except for a Wizard (Ritual Adept)', () => {
    expect(castPlan(cleric, detect, { slotLevel: null, asRitual: true }).warnings.join()).toContain('Ritual ได้เฉพาะคาถาที่เตรียมไว้')
    expect(castPlan(wizard, detect, { slotLevel: null, asRitual: true }).warnings.join()).not.toContain('เฉพาะคาถาที่เตรียมไว้')
    expect(castPlan(cleric, { ...detect, prepared: true }, { slotLevel: null, asRitual: true }).warnings.join()).not.toContain('เฉพาะคาถาที่เตรียมไว้')
  })

  it('One Spell with a Spell Slot per Turn: a second slot this turn is warned (not blocked)', () => {
    const spent = { ...wizard, turn: { action: true, bonusAction: false, reaction: false, spellSlot: true } }
    const misty = spell({ name: 'Misty Step', level: 2, castingTime: 'Bonus Action' })
    const p = castPlan(spent, misty, { slotLevel: 2, asRitual: false })
    expect(p.error).toBeNull()
    expect(p.warnings.join()).toContain('1 ครั้งต่อเทิร์น')
    // A cantrip, or a fresh turn, is fine.
    expect(castPlan(spent, spell({ name: 'Fire Bolt', level: 0, castingTime: 'Bonus Action' }), { slotLevel: null, asRitual: false }).warnings.join()).not.toContain('ต่อเทิร์น')
    expect(castPlan(wizard, misty, { slotLevel: 2, asRitual: false }).warnings.join()).not.toContain('ต่อเทิร์น')
  })

  it("a Reaction spell (cast on someone else's turn) isn't warned", () => {
    const spent = { ...wizard, turn: { action: true, bonusAction: false, reaction: false, spellSlot: true } }
    const shield = spell({ name: 'Shield', castingTime: 'Reaction, which you take when you are hit by an attack roll' })
    expect(castPlan(spent, shield, { slotLevel: 2, asRitual: false }).warnings.join()).not.toContain('ต่อเทิร์น')
  })
})
