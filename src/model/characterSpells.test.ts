import { describe, expect, it } from 'vitest'
import { createCharacter } from './character'
import { addSpell, highestSlotLevel, removeSpell, setPrepared, spellCounts, spellsByLevel } from './characterSpells'

const wizard = createCharacter({
  name: 'Nyx', className: 'Wizard', level: 3,
  spellSlots: [{ max: 4, used: 0 }, { max: 2, used: 0 }, ...Array.from({ length: 7 }, () => ({ max: 0, used: 0 }))],
})

describe('character spells', () => {
  it('adds spells sorted, cantrips prepared, no duplicates', () => {
    let c = addSpell(wizard, { name: 'Shield', level: 1 })!
    c = addSpell(c, { name: 'Fire Bolt', level: 0 })!
    c = addSpell(c, { name: 'Misty Step', level: 2 })!
    expect(c.spells.map((s) => [s.name, s.prepared])).toEqual([['Fire Bolt', true], ['Shield', false], ['Misty Step', false]])
    expect(addSpell(c, { name: ' shield ', level: 1 })).toBeNull()
    expect(addSpell(c, { name: '  ', level: 1 })).toBeNull()
  })

  it('prepares leveled spells only, removes, groups and counts', () => {
    let c = addSpell(addSpell(wizard, { name: 'Shield', level: 1 })!, { name: 'Light', level: 0 })!
    const shield = c.spells.find((s) => s.name === 'Shield')!
    const light = c.spells.find((s) => s.name === 'Light')!
    c = setPrepared(setPrepared(c, shield.id, true), light.id, false)
    expect(c.spells.map((s) => s.prepared)).toEqual([true, true])
    expect(spellCounts(c.spells)).toEqual({ cantrips: 1, leveled: 1, prepared: 1 })
    expect(spellsByLevel(c.spells).map(([lvl, list]) => [lvl, list.length])).toEqual([[0, 1], [1, 1]])
    expect(removeSpell(c, light.id).spells.map((s) => s.name)).toEqual(['Shield'])
  })

  it('knows the highest slot level', () => {
    expect(highestSlotLevel(wizard)).toBe(2)
    expect(highestSlotLevel(createCharacter())).toBe(0)
  })
})
