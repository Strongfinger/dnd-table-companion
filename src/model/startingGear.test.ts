import { describe, expect, it } from 'vitest'
import { createCharacter } from './character'
import { loadSrdEquipment } from './equipment'
import { equippedWeapons } from './inventory'
import { applyStartingGear, backgroundGearOptions, classGearOptions } from './startingGear'

describe('starting equipment (2024)', () => {
  it('Rogue A + Criminal A: items, packs unpacked, gold, armor worn, AC from armor, weapons not equipped', async () => {
    const data = await loadSrdEquipment()
    const rogue = createCharacter({ name: 'Nyx', className: 'Rogue', background: 'Criminal', scores: { str: 10, dex: 16, con: 14, int: 12, wis: 10, cha: 8 } })
    const c = applyStartingGear(rogue, [classGearOptions(rogue)[0], backgroundGearOptions('Criminal')[0]], data)
    const qty = (name: string) => c.inventory.filter((i) => i.name === name).reduce((n, i) => n + i.qty, 0)
    expect(qty('Dagger')).toBe(4)
    expect(qty('Arrows')).toBe(20)
    expect(qty('Candle')).toBe(10) // from the Burglar's Pack
    expect(qty("Burglar's Pack")).toBe(0)
    expect(c.coins.gp).toBe(8 + 16)
    expect(c.ac).toBe(14) // Leather Armor 11 + DEX 3
    // Weapons wait in the pack until the player equips them.
    expect(equippedWeapons(c, data)).toEqual([])
    expect(c.inventory.some((i) => i.name === 'Shortsword' && !i.equipped)).toBe(true)
  })

  it('option B is gold only; a pick-your-own item stays a plain item', async () => {
    const data = await loadSrdEquipment()
    const bard = createCharacter({ name: 'Lyra', className: 'Bard' })
    expect(applyStartingGear(bard, [classGearOptions(bard)[1]], data)).toMatchObject({ inventory: [], coins: { gp: 90 } })
    const a = applyStartingGear(bard, [classGearOptions(bard)[0]], data)
    expect(a.inventory.find((i) => i.name === 'Musical Instrument')).toMatchObject({ qty: 1 })
    expect(a.inventory.find((i) => i.name === 'Musical Instrument')?.srdId).toBeUndefined()
  })

  it('Fighter has three options; a Cleric wears one armor and one Shield', async () => {
    const data = await loadSrdEquipment()
    expect(classGearOptions({ className: 'Fighter' }).map((o) => o.label)).toEqual(['A', 'B', 'C'])
    const cleric = createCharacter({ name: 'Petch', className: 'Cleric', scores: { str: 14, dex: 10, con: 14, int: 10, wis: 16, cha: 10 } })
    const c = applyStartingGear(cleric, [classGearOptions(cleric)[0]], data)
    expect(c.ac).toBe(13 + 0 + 2) // Chain Shirt 13 + DEX 0 + Shield 2
  })
})
