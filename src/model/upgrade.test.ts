import { describe, expect, it } from 'vitest'
import { createCharacter } from './character'
import { loadSrdEquipment } from './equipment'
import { equippedWeapons } from './inventory'
import { applyUpgrade, matchSrdItem, planUpgrade, upgradedAC, upgradeIsEmpty } from './upgrade'

const old = () => createCharacter({
  name: 'Bram', className: 'Fighter', level: 2, species: 'Human', ac: 16,
  scores: { str: 16, dex: 12, con: 14, int: 10, wis: 10, cha: 8 },
  inventory: [
    { id: 'a', name: 'Chain mail', qty: 1 }, { id: 'b', name: 'Longsword', qty: 1 }, { id: 'c', name: 'Daggers', qty: 2 },
    { id: 'd', name: "Traveler's Clothes", qty: 1 }, { id: 'e', name: 'ดาบวิเศษ', qty: 1 }, { id: 'f', name: 'Shield', qty: 1 },
  ],
  features: [{ id: 'sw', name: 'second wind', max: 1, used: 1, recharge: 'short' }],
  attacks: [{ id: 'atk', name: 'Longsword', ability: 'str', proficient: true, damageDice: '1d8', damageType: 'Slashing', addModToDamage: true }],
})

describe('upgrade an older character to SRD data', () => {
  it('matches typed names to SRD items', async () => {
    const data = await loadSrdEquipment()
    expect(matchSrdItem('Daggers', data)?.name).toBe('Dagger')
    expect(matchSrdItem('leather', data)?.name).toBe('Leather Armor')
    expect(matchSrdItem("Traveler's Clothes", data)?.name).toBe("Clothes, Traveler's")
    expect(matchSrdItem('ดาบวิเศษ', data)).toBeUndefined()
  })

  it('plans links, features, armor and attacks; applying keeps the used count and works out AC', async () => {
    const data = await loadSrdEquipment()
    const c = old()
    const plan = planUpgrade(c, data)
    expect(plan.links.map((l) => l.to.name)).toEqual(['Chain Mail', 'Longsword', 'Dagger', "Clothes, Traveler's", 'Shield'])
    expect(plan.linkFeatures.map((l) => l.to.name)).toEqual(['Second Wind'])
    expect(plan.addFeatures.map((f) => f.name)).toEqual(['Action Surge'])
    expect(plan.armor.map((a) => a.name)).toEqual(['Chain Mail', 'Shield'])
    expect(plan.attacks.map((a) => a.name)).toEqual(['Longsword'])
    expect(upgradedAC(c, data, plan)).toBe(18)

    const up = applyUpgrade(c, data, plan, { wearArmor: true, replaceAttacks: true })
    expect(up).toMatchObject({ srdLinked: true, acAuto: true, ac: 18 })
    expect(up.features[0]).toMatchObject({ srdId: 'fighter-second-wind', max: 2, used: 1, recharge: 'shortOne' })
    expect(up.attacks).toEqual([])
    expect(equippedWeapons(up, data).map((w) => w.name)).toEqual(['Longsword'])
    expect(up.inventory.find((i) => i.id === 'e')?.srdId).toBeUndefined()
    // Nothing left to do afterwards.
    expect(upgradeIsEmpty(planUpgrade(up, data))).toBe(true)
  })

  it('without the options: AC and attacks stay as they were', async () => {
    const data = await loadSrdEquipment()
    const c = old()
    const up = applyUpgrade(c, data, planUpgrade(c, data), { wearArmor: false, replaceAttacks: false })
    expect(up.ac).toBe(16)
    expect(up.acAuto).toBeUndefined()
    expect(up.attacks).toHaveLength(1)
  })
})
