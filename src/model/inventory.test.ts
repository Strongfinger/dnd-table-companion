import { describe, expect, it } from 'vitest'
import { createCharacter } from './character'
import { findItem, loadSrdEquipment } from './equipment'
import { addSrdItem, equippedWeapons, toggleEquipped } from './inventory'
import { parseCharacterImport } from './io'

const rogue = () => createCharacter({ name: 'Nyx', className: 'Rogue', scores: { str: 10, dex: 16, con: 14, int: 12, wis: 10, cha: 8 } })

describe('inventory', () => {
  it('adds SRD items, stacking only unequipped copies', async () => {
    const data = await loadSrdEquipment()
    const dagger = findItem(data, 'dagger')!
    let c = addSrdItem(rogue(), dagger, data)
    c = addSrdItem(c, dagger, data)
    expect(c.inventory).toEqual([expect.objectContaining({ name: 'Dagger', qty: 2, srdId: 'dagger' })])
    c = toggleEquipped(c, c.inventory[0].id, data)
    c = addSrdItem(c, dagger, data)
    expect(c.inventory.map((i) => [i.qty, !!i.equipped])).toEqual([[2, true], [1, false]])
    // Arrows come 20 at a time.
    c = addSrdItem(c, findItem(data, 'arrows')!, data)
    expect(c.inventory.at(-1)).toMatchObject({ name: 'Arrows', qty: 20 })
  })

  it('adding a pack adds what is inside', async () => {
    const data = await loadSrdEquipment()
    const c = addSrdItem(rogue(), findItem(data, 'burglars-pack')!, data)
    expect(c.inventory.find((i) => i.name === 'Candle')).toMatchObject({ qty: 10, srdId: 'candle' })
    expect(c.inventory.find((i) => i.name === 'Oil')?.qty).toBe(7)
    expect(c.inventory.some((i) => i.name === "Burglar's Pack")).toBe(false)
  })

  it('wears one armor and one Shield at a time; gear cannot be equipped', async () => {
    const data = await loadSrdEquipment()
    let c = rogue()
    for (const id of ['leather-armor', 'studded-leather-armor', 'shield', 'rope']) c = addSrdItem(c, findItem(data, id)!, data)
    const [leather, studded, shield, rope] = c.inventory
    c = toggleEquipped(c, leather.id, data)
    c = toggleEquipped(c, shield.id, data)
    c = toggleEquipped(c, studded.id, data)
    c = toggleEquipped(c, rope.id, data)
    expect(c.inventory.map((i) => !!i.equipped)).toEqual([false, true, true, false])
    c = toggleEquipped(c, shield.id, data)
    expect(c.inventory[2].equipped).toBeUndefined()
  })

  it('turns equipped weapons into attacks', async () => {
    const data = await loadSrdEquipment()
    let c = rogue()
    for (const id of ['shortsword', 'shortbow', 'longsword']) c = addSrdItem(c, findItem(data, id)!, data)
    for (const i of c.inventory) c = toggleEquipped(c, i.id, data)
    const [shortsword, shortbow, longsword] = equippedWeapons(c, data)
    // Rogue 1, DEX +3, PB 2.
    expect(shortsword).toMatchObject({ trained: true, attack: { ability: 'dex', hit: 5, damage: '1d6+3', offHand: '1d6' } })
    expect(shortsword.mastery).toMatchObject({ name: 'Vex', usable: true })
    expect(shortbow.attack).toMatchObject({ hit: 5, damage: '1d6+3' })
    // Longsword: Martial without Finesse/Light, so a Rogue isn't trained; STR +0.
    expect(longsword).toMatchObject({ trained: false, attack: { ability: 'str', hit: 0, damage: '1d8', twoHanded: '1d10' } })
    expect(longsword.mastery.usable).toBe(false)
    // A Barbarian's Weapon Mastery covers Melee weapons only.
    const barbarian = equippedWeapons({ ...c, className: 'Barbarian' }, data)
    expect(barbarian.map((w) => w.mastery.usable)).toEqual([true, false, true])
    // A Wizard sees the mastery but has no Weapon Mastery feature.
    expect(equippedWeapons({ ...c, className: 'Wizard' }, data)[0].mastery.usable).toBe(false)
  })

  it('keeps srdId and equipped through export/import', async () => {
    const data = await loadSrdEquipment()
    let c = addSrdItem(rogue(), findItem(data, 'rapier')!, data)
    c = toggleEquipped(c, c.inventory[0].id, data)
    const back = parseCharacterImport(JSON.stringify(c))
    expect(back.ok && back.character.inventory[0]).toMatchObject({ srdId: 'rapier', equipped: true })
  })
})
