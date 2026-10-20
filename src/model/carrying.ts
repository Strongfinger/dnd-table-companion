// How heavy a character's bag is, against their Carrying Capacity (rules/carrying.ts).
// SRD equipment has its weight in the data; custom and magic items use the weight the player typed (or 0).
import { carryingCapacity, coinWeight, dragLiftPushLimit, isSrdSpecies, loadState, SPECIES_INFO, type LoadState } from '../rules'
import type { Character, InventoryItem } from './character'
import { findItem, type SrdEquipment, type SrdItem } from './equipment'

/** Heaviest weight one piece may be given by hand (lb). */
export const MAX_ITEM_WEIGHT = 9999

/**
 * Weight of one piece in lb. SRD weights are per bundle when the item comes in bundles
 * (Arrows: 20 for 1 lb), and the inventory counts single pieces, so divide by the bundle size.
 */
export function itemUnitWeight(item: Pick<InventoryItem, 'weight'>, srd?: SrdItem): number {
  if (srd?.weight !== undefined) return srd.weight / (srd.qty ?? 1)
  return item.weight ?? 0
}

/** Whether the player types this item's weight (it isn't SRD equipment with a known weight). */
export function hasTypedWeight(srd?: SrdItem): boolean {
  return srd?.weight === undefined
}

export interface Load {
  /** Everything in the bag and worn or held, in lb. */
  items: number
  coins: number
  total: number
  capacity: number
  /** Drag, lift or push limit. */
  limit: number
  state: LoadState
}

/** The character's load: items (worn and carried count the same) plus coins, against Str × 15 lb. */
export function characterLoad(c: Character, data: SrdEquipment | undefined): Load {
  const items = c.inventory.reduce((n, i) => n + i.qty * itemUnitWeight(i, data && i.srdId ? findItem(data, i.srdId) : undefined), 0)
  const coins = coinWeight(c.coins)
  const total = items + coins
  const info = isSrdSpecies(c.species) ? SPECIES_INFO[c.species] : undefined
  // "Medium or Small" carries the same either way; Goliath's Powerful Build counts as one size larger.
  const capacity = carryingCapacity(c.scores.str, info?.size === 'Small' ? 'Small' : 'Medium', !!info?.traits.includes('Powerful Build'))
  return { items, coins, total, capacity, limit: dragLiftPushLimit(capacity), state: loadState(total, capacity) }
}

/** Set (or clear, with undefined) the weight of one piece of an item without SRD weight. */
export function setItemWeight(c: Character, itemId: string, weight: number | undefined): Character {
  const w = weight === undefined || !Number.isFinite(weight) ? undefined : Math.min(MAX_ITEM_WEIGHT, Math.max(0, Math.round(weight * 100) / 100))
  const inventory = c.inventory.map((i) => {
    if (i.id !== itemId) return i
    const next = { ...i, weight: w }
    if (!w) delete next.weight
    return next
  })
  return { ...c, inventory }
}

/** "12.5 lb" with at most one decimal. */
export function formatLb(lb: number): string {
  return `${Math.round(lb * 10) / 10} lb`
}
