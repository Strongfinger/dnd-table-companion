// Inventory changes on the sheet: add SRD items (a pack adds what's inside), equip weapons and armor,
// and turn equipped weapons into attacks. Pure functions; the screen saves the result.
import { abilityModifier, armorClass, classHasWeaponTraining, deriveSheet, WEAPON_MASTERY_CLASSES, weaponAttack, type ArmorClassResult, type WeaponAttack } from '../rules'
import { newId, type Character, type EquipSlot, type InventoryItem } from './character'
import { findItem, type SrdEquipment, type SrdItem, type SrdWeapon } from './equipment'

/** SRD kinds that can be equipped (held or worn). Other items can be worn when they have a `wear` slot. */
export const EQUIPPABLE = ['weapon', 'armor', 'shield'] as const

export function isEquippable(item: SrdItem | undefined): boolean {
  return !!item && (EQUIPPABLE as readonly string[]).includes(item.kind)
}

/**
 * Add one SRD item (or `qty` pieces, e.g. 20 Arrows), or stack it on the same unequipped item.
 * A pack adds its contents instead.
 */
export function addSrdItem(c: Character, item: SrdItem, data: SrdEquipment, qty?: number): Character {
  if (item.kind === 'pack' && item.contents) {
    let next = c
    for (const part of item.contents) {
      const found = data.items.find((i) => i.name === part.name)
      next = found ? addOne(next, found.id, found.name, part.qty) : addOne(next, undefined, part.name, part.qty)
    }
    return next
  }
  return addOne(c, item.id, item.name, qty ?? item.qty ?? 1)
}

/**
 * A plain item without SRD data: a custom item the player types in (e.g. "Ring of the Old King"), or
 * "Musical Instrument" from starting gear. `wear`: the slot it can be worn in, if any.
 */
export function addPlainItem(c: Character, name: string, qty = 1, wear?: EquipSlot): Character {
  const n = name.trim().slice(0, 200)
  if (!n || qty < 1) return c
  return addOne(c, undefined, n, Math.min(9999, Math.floor(qty)), wear)
}

function addOne(c: Character, srdId: string | undefined, name: string, qty: number, wear?: EquipSlot): Character {
  // Weapons and armor stay separate entries, so each one can be equipped on its own.
  const stack = c.inventory.find((i) => i.name === name && i.srdId === srdId && i.wear === wear && !i.equipped)
  const inventory: InventoryItem[] = stack
    ? c.inventory.map((i) => (i === stack ? { ...i, qty: Math.min(9999, i.qty + qty) } : i))
    : [...c.inventory, { id: newId(), name, qty, ...(srdId ? { srdId } : {}), ...(wear ? { wear } : {}) }]
  return { ...c, inventory }
}

/** Use up one (a potion, a ration…): the quantity goes down by 1, and the item goes when none are left. */
export function consumeItem(c: Character, itemId: string): Character {
  const item = c.inventory.find((i) => i.id === itemId)
  if (!item) return c
  return item.qty > 1 ? setItemQty(c, itemId, item.qty - 1) : removeItem(c, itemId)
}

/** Rename an item and set how many there are (0 removes it). An empty name keeps the old one. */
export function editItem(c: Character, itemId: string, name: string, qty: number): Character {
  const item = c.inventory.find((i) => i.id === itemId)
  if (!item) return c
  const n = Number.isFinite(qty) ? Math.max(0, Math.min(9999, Math.floor(qty))) : item.qty
  if (n === 0) return removeItem(c, itemId)
  const newName = name.trim().slice(0, 200) || item.name
  if (newName === item.name && n === item.qty) return c
  return { ...c, inventory: c.inventory.map((i) => (i.id === itemId ? { ...i, name: newName, qty: n } : i)) }
}

function setItemQty(c: Character, itemId: string, qty: number): Character {
  return { ...c, inventory: c.inventory.map((i) => (i.id === itemId ? { ...i, qty } : i)) }
}

/** Longest custom item text (a magic item's effect), so sheets stay small for room messages and backups. */
export const MAX_ITEM_DESCRIPTION = 2000

/**
 * A custom item's own text (e.g. a magic item's effect) and whether it is a magic item. Empty text removes it.
 * SRD items keep the SRD text instead.
 */
export function setItemDetails(c: Character, itemId: string, details: { description?: string; magic?: boolean }): Character {
  const item = c.inventory.find((i) => i.id === itemId)
  if (!item || item.srdId) return c
  const description = details.description?.trim().slice(0, MAX_ITEM_DESCRIPTION) || undefined
  const magic = details.magic ? (true as const) : undefined
  if (description === item.description && magic === item.magic) return c
  const { description: _d, magic: _m, ...rest } = item
  const next: InventoryItem = { ...rest, ...(description ? { description } : {}), ...(magic ? { magic } : {}) }
  return { ...c, inventory: c.inventory.map((i) => (i.id === itemId ? next : i)) }
}

/**
 * Where a custom item in the pack can be worn (undefined = not worn), e.g. a magic cloak added without a slot.
 * SRD items get their slots from the SRD, and an item that is worn now must be taken off first.
 */
export function setItemWear(c: Character, itemId: string, wear: EquipSlot | undefined): Character {
  const item = c.inventory.find((i) => i.id === itemId)
  if (!item || item.srdId || item.equipped || item.slot || item.wear === wear) return c
  const { wear: _w, ...rest } = item
  const next: InventoryItem = { ...rest, ...(wear ? { wear } : {}) }
  return { ...c, inventory: c.inventory.map((i) => (i.id === itemId ? next : i)) }
}

/** Equipped (worn or held) custom magic items with an effect text: shown with the buffs on the play panel. */
export function equippedMagicEffects(c: Pick<Character, 'inventory'>): { id: string; name: string; description: string }[] {
  return c.inventory
    .filter((i) => i.magic && (i.equipped || i.slot) && i.description)
    .map((i) => ({ id: i.id, name: i.name, description: i.description! }))
}

/** Throw an item away. */
export function removeItem(c: Character, itemId: string): Character {
  if (!c.inventory.some((i) => i.id === itemId)) return c
  return { ...c, inventory: c.inventory.filter((i) => i.id !== itemId) }
}

/** Thai names of the slots, in the order the sheet shows them. */
export const SLOT_LABEL: Record<EquipSlot, string> = {
  head: 'หัว', neck: 'คอ', hands: 'ถุงมือ', ring1: 'แหวน 1', ring2: 'แหวน 2', cloak: 'ผ้าคลุม', body: 'เกราะ/ชุด',
  legs: 'ขา', feet: 'เท้า', mainHand: 'มือหลัก', offHand: 'มือรอง', back: 'สะพายหลัง',
}

const HANDS: EquipSlot[] = ['mainHand', 'offHand']
const RINGS: EquipSlot[] = ['ring1', 'ring2']

function isTwoHanded(srd: SrdItem | undefined): boolean {
  return !!srd?.weapon?.properties.includes('Two-Handed')
}

/**
 * The slots an item can go in. Weapons: either hand or slung on the back; a Two-Handed weapon is held in the
 * main hand and takes the off hand too. Shield: off hand. Armor: body. Anything else: its `wear` slot
 * (a hand slot means either hand, a ring slot either ring).
 */
export function slotsFor(item: InventoryItem, srd: SrdItem | undefined): EquipSlot[] {
  if (srd?.kind === 'weapon') return isTwoHanded(srd) ? ['mainHand', 'back'] : ['mainHand', 'offHand', 'back']
  if (srd?.kind === 'shield') return ['offHand']
  if (srd?.kind === 'armor') return ['body']
  if (!item.wear) return []
  if (RINGS.includes(item.wear)) return RINGS
  return HANDS.includes(item.wear) ? HANDS : [item.wear]
}

const srdOf = (item: InventoryItem, data: SrdEquipment) => (item.srdId ? findItem(data, item.srdId) : undefined)

/** The slots an item in a slot fills: a Two-Handed weapon in the main hand fills the off hand too. */
function filled(item: InventoryItem, slot: EquipSlot, data: SrdEquipment): EquipSlot[] {
  return slot === 'mainHand' && isTwoHanded(srdOf(item, data)) ? HANDS : [slot]
}

const takeOff = ({ slot: _slot, equipped: _equipped, ...rest }: InventoryItem): InventoryItem => rest

/**
 * One item per slot. Equipped items without a slot (saved before slots, or from an older device) get the first
 * free slot that fits; items that don't fit anywhere go back in the pack (nothing is deleted).
 * Returns the same character when nothing changes.
 */
export function normalizeEquipment(c: Character, data: SrdEquipment): Character {
  const used = new Set<EquipSlot>()
  const place = new Map<string, EquipSlot | null>()
  const tryPlace = (item: InventoryItem, slot: EquipSlot) => {
    const fills = filled(item, slot, data)
    if (fills.some((s) => used.has(s))) return false
    fills.forEach((s) => used.add(s))
    place.set(item.id, slot)
    return true
  }
  const worn = c.inventory.filter((i) => i.equipped)
  // Items that already have a valid slot keep it (first come, first served); then the older ones without one.
  for (const i of worn) {
    if (i.slot && slotsFor(i, srdOf(i, data)).includes(i.slot) && tryPlace(i, i.slot)) continue
    place.set(i.id, null)
  }
  // Armor and Shields before weapons, so a Shield keeps the off hand (and the AC it gives).
  const legacy = worn.filter((i) => place.get(i.id) === null && !i.slot)
  const isWeapon = (i: InventoryItem) => srdOf(i, data)?.kind === 'weapon'
  for (const i of [...legacy.filter((i) => !isWeapon(i)), ...legacy.filter(isWeapon)]) {
    slotsFor(i, srdOf(i, data)).some((s) => tryPlace(i, s))
  }
  let changed = false
  const inventory = c.inventory.map((i) => {
    const slot = place.get(i.id) ?? null
    if (slot) {
      if (i.slot === slot) return i
      changed = true
      return { ...i, slot }
    }
    if (!i.equipped && !i.slot) return i
    changed = true
    return takeOff(i)
  })
  return changed ? { ...c, inventory } : c
}

/** What is in each slot (a Two-Handed weapon shows in both hands). */
export function slotContents(c: Character, data: SrdEquipment): Partial<Record<EquipSlot, InventoryItem>> {
  const out: Partial<Record<EquipSlot, InventoryItem>> = {}
  for (const i of normalizeEquipment(c, data).inventory) {
    if (i.slot) for (const s of filled(i, i.slot, data)) out[s] = i
  }
  return out
}

/** Put a piece back in the pack, on a matching unequipped stack if there is one. */
function toPack(inventory: InventoryItem[], item: InventoryItem): InventoryItem[] {
  const plain = takeOff(item)
  const same = (i: InventoryItem) => i.id !== item.id && !i.equipped && i.name === item.name && i.srdId === item.srdId && i.wear === item.wear && i.image === item.image && i.weight === item.weight
  const stack = inventory.find(same)
  if (!stack) return inventory.map((i) => (i.id === item.id ? plain : i))
  return inventory
    .filter((i) => i.id !== item.id)
    .map((i) => (i === stack ? { ...i, qty: Math.min(9999, i.qty + item.qty) } : i))
}

const touchesAC = (items: InventoryItem[], data: SrdEquipment) =>
  items.some((i) => ['armor', 'shield'].includes(srdOf(i, data)?.kind ?? ''))

/**
 * Hold or wear one piece of an item in a slot. Whatever was there goes back in the pack; from a stack
 * (2 Daggers), one comes off the stack. Putting on or taking off SRD armor or a Shield switches AC to
 * "worked out from armor".
 */
export function equipItem(c: Character, itemId: string, slot: EquipSlot, data: SrdEquipment): Character {
  const start = normalizeEquipment(c, data)
  const target = start.inventory.find((i) => i.id === itemId)
  if (!target || !slotsFor(target, srdOf(target, data)).includes(slot) || target.slot === slot) return c
  const needs = filled(target, slot, data)
  const out = start.inventory.filter((i) => i.slot && i.id !== itemId && filled(i, i.slot, data).some((s) => needs.includes(s)))
  let inventory = start.inventory
  for (const o of out) inventory = toPack(inventory, o)
  // Read it again: a displaced twin may have just stacked onto it.
  const stack = inventory.find((i) => i.id === itemId)!
  if (stack.qty > 1 && !stack.slot) {
    inventory = inventory.flatMap((i) => (i.id === itemId
      ? [{ ...i, qty: i.qty - 1 }, { ...takeOff(i), id: newId(), qty: 1, equipped: true as const, slot }]
      : [i]))
  } else {
    inventory = inventory.map((i) => (i.id === itemId ? { ...i, equipped: true as const, slot } : i))
  }
  const next = { ...start, inventory }
  return touchesAC([target, ...out], data) ? applyAutoAC({ ...next, acAuto: true }, data) : next
}

/** Take an item off and put it back in the pack. */
export function unequipItem(c: Character, itemId: string, data: SrdEquipment): Character {
  const start = normalizeEquipment(c, data)
  const target = start.inventory.find((i) => i.id === itemId)
  if (!target?.slot) return c
  const next = { ...start, inventory: toPack(start.inventory, target) }
  return touchesAC([target], data) ? applyAutoAC({ ...next, acAuto: true }, data) : next
}

/** Equip in the first free slot that fits (else the first that fits), or take off. */
export function toggleEquipped(c: Character, itemId: string, data: SrdEquipment): Character {
  const start = normalizeEquipment(c, data)
  const target = start.inventory.find((i) => i.id === itemId)
  if (!target) return c
  if (target.slot) return unequipItem(start, itemId, data)
  const slots = slotsFor(target, srdOf(target, data))
  const taken = slotContents(start, data)
  const slot = slots.find((s) => filled(target, s, data).every((x) => !taken[x])) ?? slots[0]
  return slot ? equipItem(start, itemId, slot, data) : c
}

/** AC from the equipped SRD armor and Shield (plus the character's AC bonus), with its drawbacks. */
export function characterArmorClass(c: Character, data: SrdEquipment): ArmorClassResult {
  const equipped = normalizeEquipment(c, data).inventory.filter((i) => i.equipped && i.srdId).map((i) => ({ item: i, srd: findItem(data, i.srdId!) }))
  const suit = equipped.find((e) => e.srd?.kind === 'armor')
  const a = suit?.srd?.armor
  return armorClass({
    className: c.className,
    subclass: c.subclass,
    level: c.level,
    modifiers: Object.fromEntries(Object.entries(c.scores).map(([k, v]) => [k, abilityModifier(v)])) as Record<keyof Character['scores'], number>,
    strScore: c.scores.str,
    feats: c.feats,
    armor: a && a.category !== 'Shield' ? { name: suit!.item.name, category: a.category, base: a.base, dexCap: a.dexCap, strMin: a.strMin, stealthDisadvantage: a.stealthDisadvantage } : null,
    shield: equipped.some((e) => e.srd?.kind === 'shield'),
    monster: !!c.monster,
    bonus: c.acBonus ?? 0,
  })
}

/** With acAuto on, store the worked-out AC in `ac` (what the tracker and party views show). */
export function applyAutoAC(c: Character, data: SrdEquipment): Character {
  if (!c.acAuto) return c
  const ac = Math.min(40, Math.max(1, characterArmorClass(c, data).ac))
  return ac === c.ac ? c : { ...c, ac }
}

export interface EquippedWeapon {
  itemId: string
  name: string
  /** In a hand, or slung on the back. */
  slot: EquipSlot
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
  for (const item of normalizeEquipment(c, data).inventory) {
    const srd = item.equipped && item.srdId ? findItem(data, item.srdId) : undefined
    if (!srd?.weapon) continue
    const trained = !!c.monster || classHasWeaponTraining(c.className, srd.weapon)
    const masteryText = data.masteries.find((m) => m.name === srd.weapon!.mastery)?.text ?? ''
    out.push({
      itemId: item.id,
      name: item.name,
      slot: item.slot!,
      weapon: srd.weapon,
      trained,
      attack: weaponAttack(srd.weapon, {
        modifiers: sheet.modifiers,
        proficiencyBonus: sheet.proficiencyBonus,
        trained,
        feats: c.feats,
        d20Penalty: sheet.d20Penalty,
        attackBuff: sheet.buffs.attack,
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
