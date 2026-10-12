// A new character's starting equipment (wizard): the class's and background's "A or B" choices become
// inventory items (packs unpacked) and gold; armor and Shield start worn, so AC is right; weapons are equipped by the player.
import { BACKGROUND_STARTING_GEAR, CLASS_STARTING_GEAR, type GearOption } from '../rules'
import type { Character } from './character'
import type { SrdEquipment } from './equipment'
import { addPlainItem, addSrdItem, applyAutoAC, isEquippable } from './inventory'

export function classGearOptions(c: Pick<Character, 'className'>): GearOption[] {
  return CLASS_STARTING_GEAR[c.className]
}

export function backgroundGearOptions(background: string): GearOption[] {
  return BACKGROUND_STARTING_GEAR[background as keyof typeof BACKGROUND_STARTING_GEAR] ?? []
}

/**
 * Add the chosen options' items and gold. Armor and a Shield are worn (so AC is right from the start);
 * weapons stay in the pack for the player to equip on the sheet (owner decision 2026-10-13).
 */
export function applyStartingGear(c: Character, options: GearOption[], data: SrdEquipment): Character {
  let next = c
  for (const o of options) {
    for (const g of o.items) {
      const item = g.choose ? undefined : data.items.find((x) => x.name === g.name)
      next = item ? addSrdItem(next, item, data, item.kind === 'pack' ? undefined : g.qty) : addPlainItem(next, g.name, g.qty)
    }
  }
  const gp = options.reduce((sum, o) => sum + o.gp, 0)
  let armorOn = false
  let shieldOn = false
  const inventory = next.inventory.map((i) => {
    const srd = i.srdId ? data.items.find((x) => x.id === i.srdId) : undefined
    if (!isEquippable(srd) || srd!.kind === 'weapon') return i
    if (srd!.kind === 'armor') { if (armorOn) return i; armorOn = true }
    if (srd!.kind === 'shield') { if (shieldOn) return i; shieldOn = true }
    return { ...i, equipped: true as const }
  })
  return applyAutoAC({ ...next, inventory, coins: { ...next.coins, gp: next.coins.gp + gp }, acAuto: true }, data)
}
