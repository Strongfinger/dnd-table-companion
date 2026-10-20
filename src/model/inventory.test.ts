import { describe, expect, it } from 'vitest'
import { createCharacter } from './character'
import { findItem, loadSrdEquipment } from './equipment'
import { setItemDetails, MAX_ITEM_DESCRIPTION, addPlainItem, addSrdItem, editItem, removeItem, consumeItem, applyAutoAC, characterArmorClass, equipItem, equippedWeapons, normalizeEquipment, slotContents, toggleEquipped, unequipItem } from './inventory'
import { parseCharacterImport } from './io'

const rogue = () => createCharacter({ name: 'Nyx', className: 'Rogue', scores: { str: 10, dex: 16, con: 14, int: 12, wis: 10, cha: 8 } })

describe('inventory', () => {
  it('adds SRD items, stacking only unequipped copies', async () => {
    const data = await loadSrdEquipment()
    const dagger = findItem(data, 'dagger')!
    let c = addSrdItem(rogue(), dagger, data)
    c = addSrdItem(c, dagger, data)
    expect(c.inventory).toEqual([expect.objectContaining({ name: 'Dagger', qty: 2, srdId: 'dagger' })])
    // Equipping takes one Dagger off the stack; a new one stacks on the unequipped ones.
    c = toggleEquipped(c, c.inventory[0].id, data)
    expect(c.inventory.map((i) => [i.qty, !!i.equipped])).toEqual([[1, false], [1, true]])
    c = addSrdItem(c, dagger, data)
    expect(c.inventory.map((i) => [i.qty, !!i.equipped])).toEqual([[2, false], [1, true]])
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

  it('works AC out from equipped armor once SRD armor is worn', async () => {
    const data = await loadSrdEquipment()
    // An older character with a hand-typed AC keeps it until armor is equipped on the sheet.
    let c = { ...rogue(), ac: 13 }
    c = addSrdItem(c, findItem(data, 'leather-armor')!, data)
    expect(applyAutoAC(c, data).ac).toBe(13)
    c = toggleEquipped(c, c.inventory[0].id, data)
    expect(c).toMatchObject({ acAuto: true, ac: 14 })
    // Taking it off: 10 + DEX.
    c = toggleEquipped(c, c.inventory[0].id, data)
    expect(c.ac).toBe(13)
    // Rogues have no Shield training: no AC from it, and the result says why.
    c = addSrdItem(c, findItem(data, 'shield')!, data)
    c = toggleEquipped(c, c.inventory[1].id, data)
    expect(c.ac).toBe(13)
    expect(characterArmorClass(c, data).untrainedShield).toBe(true)
    // A magic bonus adds on top.
    expect(applyAutoAC({ ...c, acBonus: 1 }, data).ac).toBe(14)
  })

  it('holds one item per slot; what was there goes back in the pack', async () => {
    const data = await loadSrdEquipment()
    let c = rogue()
    for (const id of ['dagger', 'dagger', 'shortsword', 'shortbow', 'rapier']) c = addSrdItem(c, findItem(data, id)!, data)
    const id = (name: string) => c.inventory.find((i) => i.name === name && !i.equipped)!.id
    c = equipItem(c, id('Shortsword'), 'mainHand', data)
    c = equipItem(c, id('Dagger'), 'offHand', data)
    c = equipItem(c, id('Shortbow'), 'back', data)
    let slots = slotContents(c, data)
    expect([slots.mainHand?.name, slots.offHand?.name, slots.back?.name]).toEqual(['Shortsword', 'Dagger', 'Shortbow'])
    // A Rapier into the main hand: the Shortsword goes back in the pack.
    c = equipItem(c, id('Rapier'), 'mainHand', data)
    slots = slotContents(c, data)
    expect(slots.mainHand?.name).toBe('Rapier')
    expect(c.inventory.find((i) => i.name === 'Shortsword')).not.toHaveProperty('equipped')
    // Taking the Dagger off puts it back on its stack.
    c = unequipItem(c, slotContents(c, data).offHand!.id, data)
    expect(c.inventory.filter((i) => i.name === 'Dagger')).toEqual([expect.objectContaining({ qty: 2 })])
    expect(equippedWeapons(c, data).map((w) => [w.name, w.slot])).toEqual([['Shortbow', 'back'], ['Rapier', 'mainHand']])
  })

  it('a Two-Handed weapon takes both hands', async () => {
    const data = await loadSrdEquipment()
    let c = rogue()
    for (const id of ['shield', 'longsword', 'greatsword']) c = addSrdItem(c, findItem(data, id)!, data)
    const [shield, longsword, greatsword] = c.inventory
    c = equipItem(c, longsword.id, 'mainHand', data)
    c = equipItem(c, shield.id, 'offHand', data)
    // A Greatsword can't go in the off hand; in the main hand it pushes out the Longsword and the Shield.
    expect(equipItem(c, greatsword.id, 'offHand', data)).toBe(c)
    c = equipItem(c, greatsword.id, 'mainHand', data)
    const slots = slotContents(c, data)
    expect([slots.mainHand?.name, slots.offHand?.name]).toEqual(['Greatsword', 'Greatsword'])
    expect(c.inventory.filter((i) => i.equipped).map((i) => i.name)).toEqual(['Greatsword'])
    // The Shield back in the off hand: the Greatsword goes in the pack.
    c = equipItem(c, shield.id, 'offHand', data)
    expect(c.inventory.filter((i) => i.equipped).map((i) => i.name)).toEqual(['Shield'])
  })

  it('custom items: added by name, worn in the slot the player picked', async () => {
    const data = await loadSrdEquipment()
    let c = addPlainItem(rogue(), '  Cloak of the Old King ', 1, 'cloak')
    c = addPlainItem(c, 'Lucky coin')
    expect(addPlainItem(c, '   ')).toBe(c)
    expect(c.inventory.map((i) => [i.name, i.wear])).toEqual([['Cloak of the Old King', 'cloak'], ['Lucky coin', undefined]])
    c = toggleEquipped(c, c.inventory[0].id, data)
    expect(c.inventory[0]).toMatchObject({ equipped: true, slot: 'cloak' })
    // Without a slot it can't be worn.
    expect(toggleEquipped(c, c.inventory[1].id, data)).toBe(c)
    c = addPlainItem(c, 'Other cloak', 1, 'cloak')
    c = toggleEquipped(c, c.inventory[2].id, data)
    expect(c.inventory.filter((i) => i.equipped).map((i) => i.name)).toEqual(['Other cloak'])
  })

  it('older saves: equipped items get slots; ones that do not fit go back in the pack', async () => {
    const data = await loadSrdEquipment()
    const item = (srdId: string, extra = {}) => ({ id: srdId + Math.random(), name: findItem(data, srdId)!.name, qty: 1, srdId, equipped: true as const, ...extra })
    const old = {
      ...rogue(),
      inventory: [
        item('dagger'), item('shortsword'), item('shortbow'), item('rapier'),
        item('leather-armor'), item('studded-leather-armor'),
        { id: 'rope', name: 'Rope', qty: 1, srdId: 'rope', equipped: true as const },
      ],
    }
    const c = normalizeEquipment(old, data)
    expect(c.inventory.map((i) => [i.name, i.slot ?? null])).toEqual([
      ['Dagger', 'mainHand'], ['Shortsword', 'offHand'], ['Shortbow', 'back'], ['Rapier', null],
      ['Leather Armor', 'body'], ['Studded Leather Armor', null], ['Rope', null],
    ])
    // Nothing is deleted, and the extras are no longer equipped.
    expect(c.inventory).toHaveLength(7)
    expect(c.inventory.filter((i) => i.equipped)).toHaveLength(4)
    // Already fine: the same object back (nothing to save).
    expect(normalizeEquipment(c, data)).toBe(c)
    // A slot that clashes keeps the first item.
    const clash = normalizeEquipment({ ...old, inventory: [item('dagger', { slot: 'offHand' }), item('shield', { slot: 'offHand' })] }, data)
    expect(clash.inventory.map((i) => i.slot ?? null)).toEqual(['offHand', null])
  })

  it('keeps slot and wear through export/import', async () => {
    const data = await loadSrdEquipment()
    let c = addPlainItem(rogue(), 'Boots', 1, 'feet')
    c = toggleEquipped(c, c.inventory[0].id, data)
    const back = parseCharacterImport(JSON.stringify({ ...c, inventory: [...c.inventory, { id: 'x', name: 'Bad', qty: 1, wear: 'tail', slot: 'tail' }] }))
    expect(back.ok && back.character.inventory).toEqual([
      expect.objectContaining({ name: 'Boots', wear: 'feet', slot: 'feet', equipped: true }),
      { id: 'x', name: 'Bad', qty: 1 },
    ])
  })

  it('older saves: a Shield keeps the off hand before weapons', async () => {
    const data = await loadSrdEquipment()
    const item = (srdId: string) => ({ id: srdId, name: findItem(data, srdId)!.name, qty: 1, srdId, equipped: true as const })
    const old = { ...rogue(), className: 'Fighter' as const, inventory: [item('dagger'), item('shortsword'), item('shield'), item('chain-mail')] }
    const c = normalizeEquipment(old, data)
    expect(c.inventory.map((i) => i.slot ?? null)).toEqual(['mainHand', 'back', 'offHand', 'body'])
    expect(characterArmorClass(c, data).ac).toBe(18)
  })

  it('equipping a twin of the item in the slot leaves one in the slot and one in the pack', async () => {
    const data = await loadSrdEquipment()
    let c = addSrdItem(rogue(), findItem(data, 'dagger')!, data, 2)
    c = equipItem(c, c.inventory[0].id, 'mainHand', data)
    const spare = c.inventory.find((i) => !i.equipped)!
    c = equipItem(c, spare.id, 'mainHand', data)
    expect(c.inventory.map((i) => [i.qty, i.slot ?? null])).toEqual([[1, null], [1, 'mainHand']])
  })

  it('two ring slots: a third ring replaces the first', async () => {
    const data = await loadSrdEquipment()
    let c = rogue()
    for (const n of ['Ring A', 'Ring B', 'Ring C']) c = addPlainItem(c, n, 1, 'ring1')
    for (const i of [...c.inventory]) c = toggleEquipped(c, i.id, data)
    const slots = slotContents(c, data)
    expect([slots.ring1?.name, slots.ring2?.name]).toEqual(['Ring C', 'Ring B'])
    expect(c.inventory.filter((i) => i.equipped)).toHaveLength(2)
  })

  it('use one, edit and remove items', async () => {
    const data = await loadSrdEquipment()
    let c = addPlainItem(rogue(), 'Potion of Healing', 2)
    c = addSrdItem(c, findItem(data, 'rope')!, data)
    const [potion, rope] = c.inventory
    c = consumeItem(c, potion.id)
    expect(c.inventory[0].qty).toBe(1)
    c = consumeItem(c, potion.id)
    expect(c.inventory.map((i) => i.name)).toEqual(['Rope'])
    c = editItem(c, rope.id, '  Silk Rope ', 3)
    expect(c.inventory[0]).toMatchObject({ name: 'Silk Rope', qty: 3, srdId: 'rope' })
    expect(editItem(c, rope.id, '', 3)).toBe(c)
    expect(editItem(c, rope.id, 'X', 0).inventory).toEqual([])
    expect(removeItem(c, rope.id).inventory).toEqual([])
    expect(removeItem(c, 'nope')).toBe(c)
  })

  it('sets a custom item\'s effect text and magic mark (not on SRD items)', async () => {
    const data = await loadSrdEquipment()
    let c = addPlainItem(rogue(), 'Ring of the Old King', 1, 'ring1')
    const id = c.inventory[0].id
    c = setItemDetails(c, id, { description: '  +1 AC while worn ', magic: true })
    expect(c.inventory[0]).toMatchObject({ description: '+1 AC while worn', magic: true })
    expect(setItemDetails(c, id, { description: '+1 AC while worn', magic: true })).toBe(c)
    c = setItemDetails(c, id, { description: '' })
    expect(c.inventory[0].description).toBeUndefined()
    expect(c.inventory[0].magic).toBeUndefined()
    expect(setItemDetails(c, id, { description: 'x'.repeat(MAX_ITEM_DESCRIPTION + 50) }).inventory[0].description).toHaveLength(MAX_ITEM_DESCRIPTION)
    const withDagger = addSrdItem(c, findItem(data, 'dagger')!, data)
    expect(setItemDetails(withDagger, withDagger.inventory[1].id, { description: 'no' })).toBe(withDagger)
  })
})
