import { describe, expect, it } from 'vitest'
import { createCharacter } from './character'
import { findItem, loadSrdEquipment } from './equipment'
import { addPlainItem, addSrdItem, equipItem, unequipItem } from './inventory'
import { exportCharacter, parseCharacterImport } from './io'
import { countItemImages, isItemImage, itemImageUrls, MAX_ITEM_IMAGE_CHARS, MAX_ITEM_IMAGES, setItemImage } from './itemImage'

const PIC = 'data:image/webp;base64,UklGRhIAAABXRUJQVlA4TAYAAAAvAAAAAAfQ//73v/+BiOh/AAA='

describe('item pictures', () => {
  it('tries the item art, then its kind icon, then the plain item icon', async () => {
    const data = await loadSrdEquipment()
    const rope = findItem(data, 'rope')!
    expect(itemImageUrls({ srdId: 'rope' }, rope)).toEqual(['/items/rope.webp', '/items/kind-gear.webp', '/items/kind-item.webp'])
  })

  it('custom items: own picture first, then the icon for the slot they are worn in', () => {
    expect(itemImageUrls({ wear: 'ring2' })).toEqual(['/items/wear-ring.webp', '/items/kind-item.webp'])
    expect(itemImageUrls({ wear: 'mainHand' })).toEqual(['/items/kind-item.webp'])
    expect(itemImageUrls({ image: PIC, wear: 'cloak' })).toEqual([PIC, '/items/wear-cloak.webp', '/items/kind-item.webp'])
  })

  it('accepts only small image data URLs', () => {
    expect(isItemImage(PIC)).toBe(true)
    expect(isItemImage('https://example.com/a.png')).toBe(false)
    expect(isItemImage('data:image/svg+xml;base64,PHN2Zz4=')).toBe(false)
    expect(isItemImage('data:image/webp;base64,' + 'A'.repeat(MAX_ITEM_IMAGE_CHARS))).toBe(false)
  })

  it('sets and removes a picture, at most MAX_ITEM_IMAGES per character', () => {
    let c = createCharacter()
    for (let n = 0; n <= MAX_ITEM_IMAGES; n++) c = addPlainItem(c, `Trinket ${n}`)
    const ids = c.inventory.map((i) => i.id)
    for (const id of ids.slice(0, MAX_ITEM_IMAGES)) c = setItemImage(c, id, PIC)
    expect(countItemImages(c)).toBe(MAX_ITEM_IMAGES)
    // One more is refused; replacing an existing one is fine.
    expect(setItemImage(c, ids[MAX_ITEM_IMAGES], PIC)).toBe(c)
    expect(setItemImage(c, ids[0], PIC.replace('AAA=', 'AAE='))).not.toBe(c)
    c = setItemImage(c, ids[0], undefined)
    expect(c.inventory[0]).not.toHaveProperty('image')
    expect(setItemImage(c, ids[1], 'not a picture')).toBe(c)
  })

  it('keeps the picture through equip, take off and export/import', async () => {
    const data = await loadSrdEquipment()
    let c = addPlainItem(createCharacter({ name: 'Nyx' }), 'Ring of the Old King', 1, 'ring1')
    c = addSrdItem(c, findItem(data, 'dagger')!, data)
    const id = c.inventory[0].id
    c = setItemImage(c, id, PIC)
    c = equipItem(c, id, 'ring1', data)
    expect(c.inventory[0]).toMatchObject({ slot: 'ring1', image: PIC })
    c = unequipItem(c, id, data)
    expect(c.inventory[0].image).toBe(PIC)
    const back = parseCharacterImport(exportCharacter(c))
    expect(back.ok && back.character.inventory[0].image).toBe(PIC)
  })

  it('a picture does not merge into a plain stack of the same name', async () => {
    const data = await loadSrdEquipment()
    let c = addPlainItem(createCharacter(), 'Amulet', 2, 'neck')
    c = equipItem(c, c.inventory[0].id, 'neck', data)
    const worn = c.inventory.find((i) => i.slot)!
    c = setItemImage(c, worn.id, PIC)
    c = unequipItem(c, worn.id, data)
    expect(c.inventory.map((i) => [i.qty, !!i.image])).toEqual([[1, false], [1, true]])
  })
})
