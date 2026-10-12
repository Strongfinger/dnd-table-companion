import { describe, expect, it } from 'vitest'
import { armorClassLine, costLine, findItem, loadSrdEquipment, searchItems, weaponPropertiesLine } from './equipment'

describe('SRD equipment', () => {
  it('has the 2024 weapon and armor tables', async () => {
    const data = await loadSrdEquipment()
    const count = (kind: string) => data.items.filter((i) => i.kind === kind).length
    expect(count('weapon')).toBe(38)
    expect(count('armor')).toBe(12)
    expect(count('shield')).toBe(1)
    expect(data.masteries.map((m) => m.name)).toEqual(['Cleave', 'Graze', 'Nick', 'Push', 'Sap', 'Slow', 'Topple', 'Vex'])
    // Every weapon has damage, a mastery and a range; every armor has an AC.
    for (const i of data.items) {
      if (i.kind === 'weapon') expect(i.weapon && i.weapon.range.normal > 0 && i.weapon.mastery).toBeTruthy()
      if (i.kind === 'armor' || i.kind === 'shield') expect(i.armor?.base).toBeGreaterThan(0)
    }
  })

  it('applies the corrections to the source data', async () => {
    const data = await loadSrdEquipment()
    expect(findItem(data, 'trident')?.weapon).toMatchObject({ dice: '1d8', versatile: '1d10', mastery: 'Topple' })
    expect(findItem(data, 'sling')?.weapon?.damageType).toBe('Bludgeoning')
    expect(findItem(data, 'morningstar')?.weapon?.range).toEqual({ normal: 5 })
    expect(findItem(data, 'hide-armor')?.armor).toMatchObject({ category: 'Medium', base: 12, dexCap: 2 })
    // Costs and weights from the SRD 5.2.1 tables (the source had 2014 or wrong values).
    expect(findItem(data, 'longbow')).toMatchObject({ cost: { qty: 50, unit: 'gp' }, weight: 2 })
    expect(findItem(data, 'dart')?.cost).toEqual({ qty: 5, unit: 'cp' })
    expect(findItem(data, 'hand-crossbow')).toMatchObject({ cost: { qty: 75, unit: 'gp' }, weight: 3 })
    expect(findItem(data, 'chain-shirt')?.weight).toBe(20)
    expect(findItem(data, 'component-pouch')).toMatchObject({ cost: { qty: 25, unit: 'gp' }, weight: 2 })
    expect(findItem(data, 'brewers-supplies')?.utilize).toEqual(['Detect poisoned drink (DC 15)', 'Identify alcohol (DC 10)'])
    expect(findItem(data, 'carpenters-tools')?.utilize).toEqual(['Seal or pry open a door or container (DC 20)'])
  })

  it('lists pack contents as real items', async () => {
    const data = await loadSrdEquipment()
    const packs = data.items.filter((i) => i.kind === 'pack')
    expect(packs).toHaveLength(7)
    for (const p of packs) for (const c of p.contents!) expect(data.items.some((i) => i.name === c.name)).toBe(true)
    expect(findItem(data, 'entertainers-pack')).toMatchObject({ weight: 58.5 })
    expect(findItem(data, 'entertainers-pack')?.contents).toContainEqual({ name: 'Costume', qty: 3 })
    expect(findItem(data, 'disguise-kit')?.kind).toBe('tool')
  })

  it('formats weapon and armor lines like the 2024 tables', async () => {
    const data = await loadSrdEquipment()
    expect(weaponPropertiesLine(findItem(data, 'dagger')!.weapon!)).toBe('Finesse, Light, Thrown (Range 20/60)')
    expect(weaponPropertiesLine(findItem(data, 'longbow')!.weapon!)).toBe('Ammunition (Range 150/600; Arrow), Heavy, Two-Handed')
    expect(weaponPropertiesLine(findItem(data, 'longsword')!.weapon!)).toBe('Versatile (1d10)')
    expect(armorClassLine(findItem(data, 'leather-armor')!.armor!)).toBe('11 + Dex modifier')
    expect(armorClassLine(findItem(data, 'breastplate')!.armor!)).toBe('14 + Dex modifier (max 2)')
    expect(armorClassLine(findItem(data, 'plate-armor')!.armor!)).toBe('18')
    expect(armorClassLine(findItem(data, 'shield')!.armor!)).toBe('+2')
    expect(weaponPropertiesLine(findItem(data, 'sling')!.weapon!)).toBe('Ammunition (Range 30/120; Bullet)')
    expect(costLine(findItem(data, 'plate-armor')!.cost)).toBe('1,500 GP')
  })

  it('searches by name and kind', async () => {
    const data = await loadSrdEquipment()
    expect(searchItems(data, 'cross', ['weapon']).map((i) => i.name)).toEqual(['Hand Crossbow', 'Heavy Crossbow', 'Light Crossbow'])
    expect(searchItems(data, 'chain').map((i) => i.name)).toEqual(['Chain', 'Chain Mail', 'Chain Shirt'])
  })
})
