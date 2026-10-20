// An item's picture at a fixed square size, so a row never grows taller than its text (docs/ITEM-IMAGES.md).
// Falls back through the list from model/itemImage.ts (own picture, SRD art, kind icon) and draws nothing at all
// when none of them loads, or when the reader has turned item pictures off.
import { useState } from 'react'
import { itemImageUrls } from '../model/itemImage'
import type { InventoryItem } from '../model/character'
import type { SrdItem } from '../model/equipment'
import { useShowItemImages } from './useShowItemImages'

export function ItemImage({ item, srd, size = 32, className = '' }: {
  item: Pick<InventoryItem, 'image' | 'srdId' | 'wear'>
  srd?: SrdItem
  /** Side of the square box in pixels: 28 in equipment slots, 32 in list rows, 112 in item details. */
  size?: number
  className?: string
}) {
  const [show] = useShowItemImages()
  const urls = itemImageUrls(item, srd)
  const [tried, setTried] = useState(0)
  if (!show || tried >= urls.length) return null
  return (
    <img
      src={urls[tried]}
      alt=""
      aria-hidden
      width={size}
      height={size}
      loading="lazy"
      decoding="async"
      onError={() => setTried((n) => n + 1)}
      style={{ width: size, height: size }}
      className={`shrink-0 rounded bg-stone-900 object-contain ${className}`}
    />
  )
}
