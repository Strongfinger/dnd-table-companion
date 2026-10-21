// Pictures for inventory items (docs/ITEM-IMAGES.md). SRD items use the bundled art in public/items/<srdId>.webp;
// items without their own art fall back to a small icon for their kind (or the slot a custom item is worn in).
// A custom item can carry its own tiny picture (`InventoryItem.image`, a data: URL) that the player picks.
import type { Character, EquipSlot, InventoryItem } from './character'
import type { SrdItem } from './equipment'

export const ITEM_ART_DIR = '/items/'

/**
 * A custom picture is kept in the character, so it travels in every sheet sync (64 KB per message) and backup:
 * keep each one tiny and allow only a few per character.
 */
export const MAX_ITEM_IMAGE_CHARS = 8_000
export const MAX_ITEM_IMAGES = 4

/** Wear-slot icons for custom items; both rings share one, items held in a hand use the plain item icon. */
const WEAR_ICON: Partial<Record<EquipSlot, string>> = {
  head: 'head', neck: 'neck', hands: 'hands', ring1: 'ring', ring2: 'ring', cloak: 'cloak',
  body: 'body', waist: 'waist', legs: 'legs', feet: 'feet', back: 'back',
}

/** Pictures to try, best first: the player's own, the item's art, its kind or wear icon, then the plain item icon. */
export function itemImageUrls(item: Pick<InventoryItem, 'image' | 'srdId' | 'wear'>, srd?: SrdItem): string[] {
  const urls: string[] = []
  if (item.image) urls.push(item.image)
  if (item.srdId) urls.push(`${ITEM_ART_DIR}${item.srdId}.webp`)
  if (srd) urls.push(`${ITEM_ART_DIR}kind-${srd.kind}.webp`)
  else if (item.wear && WEAR_ICON[item.wear]) urls.push(`${ITEM_ART_DIR}wear-${WEAR_ICON[item.wear]}.webp`)
  urls.push(`${ITEM_ART_DIR}kind-item.webp`)
  return urls
}

/** A small picture the app made itself (WebP, JPEG or PNG data: URL within the size limit). */
export function isItemImage(v: unknown): v is string {
  return typeof v === 'string' && v.length <= MAX_ITEM_IMAGE_CHARS && /^data:image\/(webp|jpeg|png);base64,[A-Za-z0-9+/=]+$/.test(v)
}

/** How many items of this character have their own picture. */
export function countItemImages(c: Character): number {
  return c.inventory.filter((i) => i.image).length
}

/**
 * Give an item its own picture, or remove it (`image` undefined). Refused (character unchanged) when the picture
 * is not a valid small image, or when the character already has MAX_ITEM_IMAGES pictures on other items.
 */
export function setItemImage(c: Character, itemId: string, image: string | undefined): Character {
  const target = c.inventory.find((i) => i.id === itemId)
  if (!target) return c
  if (image !== undefined) {
    if (!isItemImage(image)) return c
    if (!target.image && countItemImages(c) >= MAX_ITEM_IMAGES) return c
  }
  const inventory = c.inventory.map((i) => {
    if (i.id !== itemId) return i
    const next = { ...i, image }
    if (!image) delete next.image
    return next
  })
  return { ...c, inventory }
}
