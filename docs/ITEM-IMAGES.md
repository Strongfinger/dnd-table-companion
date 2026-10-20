# Requirement: item and equipment images

Status: **planned, waiting for the owner's approval** (requested 2026-10-20). No app code changed yet.

## What the owner asked
Add illustrations for items and equipment to make the sheet more fun. Watch the UI: images must not
clutter the screen or be too big.

## Where images appear (proposal)
| Place | Size | Notes |
|---|---|---|
| Inventory list row (`ItemRow` in `src/screens/Inventory.tsx`) | 32×32 px thumbnail, left of the name | Same height as the text line, so rows don't get taller. |
| Equipment slots (`SlotGrid` / `SlotRow`) | 28×28 px, between slot label and name | Empty slot shows nothing (no placeholder art). |
| Item details (`ItemDetails`, opened by tapping a name) | up to 128×128 px, floated next to the text | Tap the picture to see it larger (simple overlay). |
| Item picker / Lookup | none | Search lists stay text-only so they stay fast and compact. |

Layout rules: fixed square box with `object-contain`, rounded corners, `loading="lazy"`; never wider than
the text column on a phone; a setting "แสดงรูปไอเทม" (on by default) to hide all item pictures.

## How images are stored
- **SRD items:** bundled files `public/items/<srdId>.webp`, 256×256 px WebP (~10–20 KB each), found by the
  item's `srdId`. No change to saved characters or sync. Cached for offline use as they are viewed
  (runtime cache), so the first install doesn't download every picture.
- **Fallback:** a small icon per item kind (weapon, armor, shield, gear, tool, potion/poison, focus, pack,
  ammunition, magic item, ring…), bundled and precached, used when an item has no own picture.
- **Custom items** (no `srdId`): optional picture chosen by the player, shrunk with the existing
  `compressImage` (`src/ui/imageResize.ts`) to a small thumbnail and kept in a new optional
  `InventoryItem.image` field. Kept small so live-room sync and backups stay light.

## How many items
- SRD equipment: 196 (38 weapons, 12 armor, 1 shield, 72 gear, 37 tools, 14 poisons, 10 foci, 7 packs, 5 ammunition).
- SRD magic items: 278.
- Items the party actually carries after Session 1: 44 SRD items + 6 custom items.

## Suggested build order
1. Kind icons + image slots in the UI (every item gets at least an icon).
2. Art for the 44 items the party owns, then all weapons/armor/shield (51).
3. Custom-item pictures.
4. The rest of gear/tools and magic items as they show up in the campaign.

## Open choices for the owner
- Art source: generate with Gemini in one consistent style (default), like the chronicle images; or icons only.
- Style: painted fantasy icon on a plain dark background (default), or line-art.
