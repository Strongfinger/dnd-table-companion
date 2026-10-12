// Inventory changes on the sheet: add SRD items (a pack adds what's inside), equip weapons and armor,
// and turn equipped weapons into attacks. Pure functions; the screen saves the result.
import { classHasWeaponTraining, deriveSheet, WEAPON_MASTERY_CLASSES, weaponAttack, type WeaponAttack } from '../rules'
import { newId, type Character, type InventoryItem } from './character'
import { findItem, type SrdEquipment, type SrdItem, type SrdWeapon } from './equipment'

/** Kinds that can be equipped (held or worn). */
export const EQUIPPABLE = ['weapon', 'armor', 'shield'] as const

export function isEquippable(item: SrdItem | undefined): boolean {
  return !!item && (EQUIPPABLE as readonly string[]).includes(item.kind)
}

/** Add one SRD item, or stack it on the same unequipped item. A pack adds its contents instead. */
export function addSrdItem(c: Character, item: SrdItem, data: SrdEquipment): Character {
  if (item.kind === 'pack' && item.contents) {
    let next = c
    for (const part of item.contents) {
      const found = data.items.find((i) => i.name === part.name)
      next = found ? addOne(next, found.id, found.name, part.qty) : addOne(next, undefined, part.name, part.qty)
    }
    return next
  }
  return addOne(c, item.id, item.name, item.qty ?? 1)
}

function addOne(c: Character, srdId: string | undefined, name: string, qty: number): Character {
  // Weapons and armor stay separate entries, so each one can be equipped on its own.
  const stack = c.inventory.find((i) => i.name === name && i.srdId === srdId && !i.equipped)
  const inventory: InventoryItem[] = stack
    ? c.inventory.map((i) => (i === stack ? { ...i, qty: Math.min(9999, i.qty + qty) } : i))
    : [...c.inventory, { id: newId(), name, qty, ...(srdId ? { srdId } : {}) }]
  return { ...c, inventory }
}

/**
 * Equip or unequip an item. One suit of armor and one Shield at a time (2024): equipping a new one
 * takes off the old one. Weapons: any number (the player knows what's in their hands).
 */
export function toggleEquipped(c: Character, itemId: string, data: SrdEquipment): Character {
  const target = c.inventory.find((i) => i.id === itemId)
  const srd = target?.srdId ? findItem(data, target.srdId) : undefined
  if (!target || !isEquippable(srd)) return c
  const on = !target.equipped
  const sameSlot = (i: InventoryItem) => {
    if (srd!.kind === 'weapon') return false
    const other = i.srdId ? findItem(data, i.srdId) : undefined
    return other?.kind === srd!.kind
  }
  return {
    ...c,
    inventory: c.inventory.map((i) => {
      if (i.id === itemId) return { ...i, equipped: on || undefined }
      if (on && i.equipped && sameSlot(i)) return { ...i, equipped: undefined }
      return i
    }),
  }
}

export interface EquippedWeapon {
  itemId: string
  name: string
  weapon: SrdWeapon
  trained: boolean
  attack: WeaponAttack
  /**
   * The weapon's mastery property. `usable`: the character's Weapon Mastery feature can cover this weapon
   * (it works only for the few weapon kinds the player chose; that choice isn't tracked).
   */
  mastery: { name: string; text: string; usable: boolean }
}

/** Attacks from equipped SRD weapons. A creature from a stat block counts as trained with everything. */
export function equippedWeapons(c: Character, data: SrdEquipment): EquippedWeapon[] {
  const sheet = deriveSheet(c)
  const out: EquippedWeapon[] = []
  for (const item of c.inventory) {
    const srd = item.equipped && item.srdId ? findItem(data, item.srdId) : undefined
    if (!srd?.weapon) continue
    const trained = !!c.monster || classHasWeaponTraining(c.className, srd.weapon)
    const masteryText = data.masteries.find((m) => m.name === srd.weapon!.mastery)?.text ?? ''
    out.push({
      itemId: item.id,
      name: item.name,
      weapon: srd.weapon,
      trained,
      attack: weaponAttack(srd.weapon, {
        modifiers: sheet.modifiers,
        proficiencyBonus: sheet.proficiencyBonus,
        trained,
        feats: c.feats,
        d20Penalty: sheet.d20Penalty,
      }),
      mastery: { name: srd.weapon.mastery, text: masteryText, usable: masteryEligible(c, srd.weapon, trained) },
    })
  }
  return out
}

/** Weapon Mastery (level 1 feature): trained weapons of the class's choice; a Barbarian's must be Melee weapons. */
function masteryEligible(c: Character, weapon: SrdWeapon, trained: boolean): boolean {
  if (!trained || c.monster || !WEAPON_MASTERY_CLASSES.includes(c.className)) return false
  return c.className !== 'Barbarian' || weapon.type === 'Melee'
}
