import { describe, expect, it } from 'vitest'
import { createCharacter } from './character'
import { characterLoad, formatLb, itemUnitWeight, setItemWeight } from './carrying'
import { findItem, loadSrdEquipment } from './equipment'
import { addPlainItem, addSrdItem } from './inventory'

describe('character load', () => {
  it('weighs single pieces of bundled SRD items (20 Arrows = 1 lb)', async () => {
    const data = await loadSrdEquipment()
    expect(itemUnitWeight({}, findItem(data, 'arrows'))).toBe(0.05)
    expect(itemUnitWeight({ weight: 9 }, findItem(data, 'chain-mail'))).toBe(55)
    // "Iron Spikes come in bundles of ten", 5 lb a bundle.
    expect(itemUnitWeight({}, findItem(data, 'spikes-iron'))).toBe(0.5)
  })

  it('adds items, worn or not, and coins, against Str × 15', async () => {
    const data = await loadSrdEquipment()
    let c = { ...createCharacter(), scores: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 } }
    c = addSrdItem(c, findItem(data, 'chain-mail')!, data)
    c = addSrdItem(c, findItem(data, 'arrows')!, data)
    c = { ...c, coins: { cp: 0, sp: 0, ep: 0, gp: 100, pp: 0 } }
    const load = characterLoad(c, data)
    expect(load.items).toBeCloseTo(56)
    expect(load.coins).toBe(2)
    expect(load.total).toBeCloseTo(58)
    expect(load.capacity).toBe(150)
    expect(load.limit).toBe(300)
    expect(load.state).toBe('ok')
  })

  it('uses the typed weight for custom items and goes over capacity', async () => {
    const data = await loadSrdEquipment()
    let c = { ...createCharacter(), scores: { str: 8, dex: 10, con: 10, int: 10, wis: 10, cha: 10 } }
    c = addPlainItem(c, 'Stone statue', 2)
    expect(characterLoad(c, data).total).toBe(0)
    c = setItemWeight(c, c.inventory[0].id, 70)
    expect(characterLoad(c, data)).toMatchObject({ total: 140, capacity: 120, state: 'over' })
    c = setItemWeight(c, c.inventory[0].id, 150)
    expect(characterLoad(c, data).state).toBe('tooHeavy')
    c = setItemWeight(c, c.inventory[0].id, undefined)
    expect(c.inventory[0].weight).toBeUndefined()
  })

  it('gives a Goliath (Powerful Build) Str × 30', async () => {
    const data = await loadSrdEquipment()
    const c = { ...createCharacter(), species: 'Goliath', scores: { str: 16, dex: 10, con: 10, int: 10, wis: 10, cha: 10 } }
    expect(characterLoad(c, data).capacity).toBe(480)
  })

  it('writes pounds with one decimal', () => {
    expect(formatLb(12.345)).toBe('12.3 lb')
    expect(formatLb(150)).toBe('150 lb')
  })
})
