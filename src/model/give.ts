// Handing items and coins to another party member (ส่งของในปาร์ตี้). Pure functions; src/db/give.ts saves both
// characters in one go, and in a live room src/app/lobby.tsx does it on the DM's device (players send a 'give' message).
// - Only items in the pack can be given (take a worn or held item off first).
// - The item keeps what it is: name (even renamed), SRD id, wear slot, weight, effect text, Magic Item mark, picture.
import { gainCoins, spendCoins, type Coin } from '../rules'
import { newId, type Character, type InventoryItem } from './character'
import { editItem, removeItem } from './inventory'
import { countItemImages, MAX_ITEM_IMAGES } from './itemImage'
import { COINS } from './rewards'

const MAX_QTY = 9999

/** What went across, for the log and the screen. */
export type Gift = { kind: 'item'; name: string; qty: number } | { kind: 'coins'; coin: Coin; amount: number }

/**
 * Give up to `qty` of an item from `from`'s pack to `to`. Null when it can't be done (no such item, it is worn or held,
 * giving to oneself). Asking for more than there is gives all of it.
 */
export function giveItem(from: Character, to: Character, itemId: string, qty: number): { from: Character; to: Character; gift: Gift } | null {
  const item = from.inventory.find((i) => i.id === itemId)
  const want = Math.floor(qty)
  if (!item || from.id === to.id || item.equipped || item.slot || !(want >= 1)) return null
  // The receiver's pile can't go past 9999: send only what fits.
  const stack = to.inventory.find((i) => sameItem(i, item))
  const n = Math.min(item.qty, want, MAX_QTY - (stack?.qty ?? 0))
  if (n < 1) return null
  const giver = n === item.qty ? removeItem(from, itemId) : editItem(from, itemId, item.name, item.qty - n)
  return { from: giver, to: receive(to, item, n, stack), gift: { kind: 'item', name: item.name, qty: n } }
}

/** Two pack items are the same kind of thing (so they stack). */
function sameItem(a: InventoryItem, b: InventoryItem): boolean {
  return !a.equipped && !a.slot && a.name === b.name && a.srdId === b.srdId && a.wear === b.wear && a.weight === b.weight &&
    a.description === b.description && a.magic === b.magic && a.image === b.image
}

function receive(to: Character, item: InventoryItem, qty: number, stack: InventoryItem | undefined): Character {
  if (stack) return { ...to, inventory: to.inventory.map((i) => (i === stack ? { ...i, qty: i.qty + qty } : i)) }
  const { equipped: _e, slot: _s, image, ...rest } = item
  // Each character has room for a few own pictures only: past that the item comes without its picture.
  const keepImage = image && countItemImages(to) < MAX_ITEM_IMAGES
  return { ...to, inventory: [...to.inventory, { ...rest, id: newId(), qty, ...(keepImage ? { image } : {}) }] }
}

/** Give coins of one kind. Null when the giver can't pay (bigger coins are broken, with change, like paying). */
export function giveCoins(from: Character, to: Character, coin: Coin, amount: number): { from: Character; to: Character; gift: Gift } | null {
  const n = Math.floor(amount)
  if (from.id === to.id || !COINS.includes(coin) || !(n >= 1)) return null
  const left = spendCoins(from.coins, coin, n)
  if (!left) return null
  return { from: { ...from, coins: left }, to: { ...to, coins: gainCoins(to.coins, coin, n) }, gift: { kind: 'coins', coin, amount: n } }
}

/** "Potion of Healing ×2" / "50 GP" */
export function giftLabel(g: Gift): string {
  if (g.kind === 'coins') return `${g.amount.toLocaleString('en-US')} ${g.coin.toUpperCase()}`
  return `${g.name}${g.qty > 1 ? ` ×${g.qty}` : ''}`
}

/** A player's 'give' message: an item (itemId + qty) or coins (coin + amount) from one character to another. */
export type GiveRequest =
  | { fromId: string; toId: string; itemId: string; qty: number }
  | { fromId: string; toId: string; coin: Coin; amount: number }

/** Check a 'give' message (network data: never trust its shape). Null = invalid. */
export function parseGive(body: unknown): GiveRequest | null {
  if (typeof body !== 'object' || body === null) return null
  const b = body as Record<string, unknown>
  if (!id(b.fromId) || !id(b.toId) || b.fromId === b.toId) return null
  const fromId = b.fromId as string
  const toId = b.toId as string
  if (id(b.itemId) && whole(b.qty, MAX_QTY)) return { fromId, toId, itemId: b.itemId as string, qty: b.qty as number }
  if (COINS.includes(b.coin as Coin) && whole(b.amount, 9_999_999)) return { fromId, toId, coin: b.coin as Coin, amount: b.amount as number }
  return null
}

const id = (v: unknown) => typeof v === 'string' && v.length > 0 && v.length <= 64
const whole = (v: unknown, max: number) => Number.isInteger(v) && (v as number) >= 1 && (v as number) <= max
