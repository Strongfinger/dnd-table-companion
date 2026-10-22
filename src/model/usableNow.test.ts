import { describe, expect, it } from 'vitest'
import { createCharacter } from './character'
import { deriveSheet } from '../rules'
import { featureGroups, skillCells, slotRows, spellGroups } from './usableNow'
import type { SrdSpell } from './spells'

const none = { max: 0, used: 0 }
const wizard = createCharacter({
  name: 'Nyx', className: 'Wizard', level: 5,
  spellSlots: [{ max: 4, used: 4 }, { max: 3, used: 1 }, { max: 2, used: 0 }, none, none, none, none, none, none],
})
const srd = (name: string, castingTime: string) => ({ name, castingTime }) as SrdSpell
const list = [srd('Fire Bolt', 'Action'), srd('Misty Step', 'Bonus Action'), srd('Shield', 'Reaction, which you take when you are hit'), srd('Magic Missile', 'Action'), srd('Fireball', 'Action'), srd('Identify', '1 minute')]

describe('slotRows', () => {
  it('lists levels with slots, with left and spent', () => {
    expect(slotRows(wizard)).toEqual([
      { level: 1, max: 4, used: 4, left: 0, spent: true },
      { level: 2, max: 3, used: 1, left: 2, spent: false },
      { level: 3, max: 2, used: 0, left: 2, spent: false },
    ])
  })
  it('is empty without slots, and never shows negative left', () => {
    expect(slotRows(createCharacter({ name: 'Fig', className: 'Fighter' }))).toEqual([])
    expect(slotRows({ spellSlots: [{ max: 2, used: 5 }] })[0].left).toBe(0)
  })
})

describe('featureGroups', () => {
  const f = (id: string, recharge: 'short' | 'long' | 'shortOne', max: number, used: number) => ({ id, name: id, max, used, recharge })
  it('groups by rest, Short Rest first, shortOne with short', () => {
    const g = featureGroups([f('Rage', 'long', 3, 1), f('Second Wind', 'short', 1, 1), f('Channel', 'shortOne', 2, 0)])
    expect(g.map((x) => x.recharge)).toEqual(['short', 'long'])
    expect(g[0].items.map((i) => i.feature.id)).toEqual(['Second Wind', 'Channel'])
    expect(g[0].items.map((i) => i.spent)).toEqual([true, false])
    expect(g[1].items[0].left).toBe(2)
  })
  it('leaves out empty groups and handles no features', () => {
    expect(featureGroups([f('Rage', 'long', 3, 0)]).map((x) => x.recharge)).toEqual(['long'])
    expect(featureGroups([])).toEqual([])
  })
})

describe('spellGroups', () => {
  const spells = [
    { id: '1', name: 'Fireball', level: 3, prepared: false },
    { id: '2', name: 'Magic Missile', level: 1, prepared: true },
    { id: '3', name: 'Fire Bolt', level: 0, prepared: true },
    { id: '4', name: 'Shield', level: 1, prepared: true },
    { id: '5', name: 'Misty Step', level: 2, prepared: true },
    { id: '6', name: 'Identify', level: 1, prepared: true },
  ]
  const c = { ...wizard, spells }
  it('groups by casting time, prepared first, then level', () => {
    const g = spellGroups(c, list)
    expect(g.map((x) => x.kind)).toEqual(['action', 'bonusAction', 'reaction', 'other'])
    expect(g[0].items.map((r) => r.spell.name)).toEqual(['Fire Bolt', 'Magic Missile', 'Fireball'])
    expect(g[0].items.map((r) => r.ready)).toEqual([true, true, false])
    expect(g[3].items[0].spell.name).toBe('Identify')
  })
  it('flags leveled spells with no slot at their level or higher', () => {
    const noSlots = { ...c, spellSlots: [{ max: 1, used: 1 }, ...c.spellSlots.slice(1).map(() => ({ max: 0, used: 0 }))] }
    const g = spellGroups(noSlots, list)
    expect(g[0].items.find((r) => r.spell.name === 'Fire Bolt')?.noSlot).toBe(false) // cantrip
    expect(g[0].items.find((r) => r.spell.name === 'Magic Missile')?.noSlot).toBe(true)
    // Higher slots count: Magic Missile (1) is castable with the 2nd/3rd-level slots left
    expect(spellGroups(c, list)[0].items.find((r) => r.spell.name === 'Magic Missile')?.noSlot).toBe(false)
  })
  it('does not grey a ritual spell that can still be cast as a Ritual', () => {
    const noSlots = { ...c, spellSlots: c.spellSlots.map(() => ({ max: 0, used: 0 })) }
    const ritual = { ...srd('Identify', '1 minute'), ritual: true } as SrdSpell
    const rl = [...list.filter((x) => x.name !== 'Identify'), ritual]
    const row = (cl: typeof noSlots, prepared: boolean) =>
      spellGroups({ ...cl, spells: [{ id: 'r', name: 'Identify', level: 1, prepared }] }, rl)[0].items[0]
    expect(row(noSlots, true).noSlot).toBe(false)
    expect(row({ ...noSlots, className: 'Cleric' }, false).noSlot).toBe(true) // unprepared, not a Wizard
    expect(row(noSlots, false).noSlot).toBe(false) // Wizard spellbook
  })
  it('puts everything under Action while the SRD list loads, and homebrew under Action', () => {
    expect(spellGroups(c, null).map((x) => x.kind)).toEqual(['action'])
    const home = spellGroups({ ...c, spells: [{ id: 'h', name: 'My Spell', level: 1, prepared: true }] }, list)
    expect(home[0].kind).toBe('action')
    expect(home[0].items[0].info).toBeNull()
  })
  it('is empty with no spells', () => {
    expect(spellGroups({ ...wizard, spells: [] }, list)).toEqual([])
  })
})

describe('skillCells', () => {
  it('has all 18 skills alphabetically, with the sheet modifier and the level', () => {
    const c = createCharacter({ name: 'Rue', className: 'Rogue', level: 5, scores: { str: 10, dex: 16, con: 12, int: 14, wis: 10, cha: 8 }, skills: { Stealth: 'expertise', Arcana: 'proficient' } })
    const cells = skillCells(c, deriveSheet(c).skills)
    expect(cells).toHaveLength(18)
    expect(cells.map((x) => x.skill)).toEqual([...cells.map((x) => x.skill)].sort())
    expect(cells.find((x) => x.skill === 'Stealth')).toMatchObject({ ability: 'dex', level: 'expertise', bonus: 3 + 3 * 2 }) // DEX +3, PB 3 doubled
    expect(cells.find((x) => x.skill === 'Arcana')).toMatchObject({ level: 'proficient', bonus: 2 + 3 })
    expect(cells.find((x) => x.skill === 'Athletics')).toMatchObject({ level: 'none', bonus: 0 })
  })
})
