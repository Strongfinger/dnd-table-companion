// Carrying Capacity (SRD 5.2.1 Rules Glossary): how much weight a character can carry, from Strength and size.
// Pure functions; the inventory screen adds up the weights (model/carrying.ts) and shows the result.
import { COINS, type Coins } from './coins'

export type CreatureSize = 'Tiny' | 'Small' | 'Medium' | 'Large' | 'Huge' | 'Gargantuan'

/** Pounds carried per point of Strength, by size (Carrying Capacity table). */
const LB_PER_STR: Record<CreatureSize, number> = { Tiny: 7.5, Small: 15, Medium: 15, Large: 30, Huge: 60, Gargantuan: 120 }
const SIZES: CreatureSize[] = ['Tiny', 'Small', 'Medium', 'Large', 'Huge', 'Gargantuan']

/** SRD 5.2.1 "Coins": fifty coins weigh a pound (any kind of coin). */
export const COINS_PER_LB = 50

/**
 * Most weight (lb) a character can carry: Strength score × 15 for Small or Medium.
 * `sizeUp`: counts as one size larger, e.g. the Goliath's Powerful Build (Medium → Str × 30).
 */
export function carryingCapacity(strScore: number, size: CreatureSize = 'Medium', sizeUp = false): number {
  const i = SIZES.indexOf(size)
  const s = sizeUp ? SIZES[Math.min(SIZES.length - 1, i + 1)] : size
  return Math.max(0, strScore) * LB_PER_STR[s]
}

/** Most weight (lb) a character can drag, lift or push: twice the carrying capacity. */
export function dragLiftPushLimit(capacity: number): number {
  return capacity * 2
}

/** Weight of the coin purse in lb (50 coins = 1 lb). */
export function coinWeight(coins: Coins): number {
  return COINS.reduce((n, k) => n + coins[k], 0) / COINS_PER_LB
}

/**
 * Where a load stands:
 * - 'ok': within carrying capacity;
 * - 'over': more than the character can carry, but within drag/lift/push (Speed can be no more than 5 feet);
 * - 'tooHeavy': more than the character can even drag, lift or push.
 */
export type LoadState = 'ok' | 'over' | 'tooHeavy'

export function loadState(weight: number, capacity: number): LoadState {
  if (weight <= capacity) return 'ok'
  return weight <= dragLiftPushLimit(capacity) ? 'over' : 'tooHeavy'
}

/** Speed while over carrying capacity (dragging, lifting or pushing): no more than 5 feet. */
export const OVER_CAPACITY_SPEED = 5

/** Speed with this load: unchanged within capacity, at most 5 ft over it, 0 when too heavy to move at all. */
export function loadedSpeed(speed: number, state: LoadState): number {
  if (state === 'tooHeavy') return 0
  return state === 'over' ? Math.min(speed, OVER_CAPACITY_SPEED) : speed
}
