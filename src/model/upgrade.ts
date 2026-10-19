// "อัปเกรด" for characters made before the SRD equipment and feature catalog (2026-10-13): link plain inventory
// items to SRD items by name, link or add catalog features, optionally wear the armor found (auto AC) and
// replace hand-made attacks by the matching SRD weapons. Pure: plan first (shown to the player), then apply.
import type { LimitedFeature } from '../rules'
import type { Character } from './character'
import type { SrdEquipment, SrdItem } from './equipment'
import { addCatalogFeature, featuresToAdd, refreshCatalogFeatures } from './featureCatalog'
import { applyAutoAC, characterArmorClass, normalizeEquipment } from './inventory'

const norm = (s: string) => s.toLowerCase().replace(/[’']/g, "'").replace(/[^a-z' ,]/g, ' ').replace(/\s+/g, ' ').trim()

/** The SRD item a typed name means: exact, singular ("Daggers"), "... Armor" added, or "Traveler's Clothes" ↔ "Clothes, Traveler's". */
export function matchSrdItem(name: string, data: SrdEquipment): SrdItem | undefined {
  const n = norm(name)
  if (!n) return undefined
  const byName = new Map(data.items.map((i) => [norm(i.name), i]))
  const tries = [n, n.replace(/es$/, ''), n.replace(/s$/, ''), `${n} armor`]
  const words = n.split(' ')
  if (words.length === 2) tries.push(`${words[1]}, ${words[0]}`)
  for (const t of tries) {
    const hit = byName.get(t)
    if (hit && hit.kind !== 'pack') return hit
  }
  return undefined
}

export interface UpgradePlan {
  /** Inventory items to link: item id → SRD item. */
  links: { itemId: string; from: string; to: SrdItem }[]
  /** Hand-typed features that are catalog features (linked, uses recalculated, used count kept). */
  linkFeatures: { featureId: string; from: string; to: LimitedFeature }[]
  /** Catalog features the character qualifies for and doesn't have. */
  addFeatures: LimitedFeature[]
  /** Armor / Shield found in the inventory (after linking), which can be worn for auto AC. */
  armor: { itemId: string; name: string }[]
  /** Hand-made attacks with the same name as a linked SRD weapon. */
  attacks: { attackId: string; name: string; itemId: string }[]
}

export function planUpgrade(c: Character, data: SrdEquipment): UpgradePlan {
  const links = c.inventory
    .filter((i) => !i.srdId)
    .flatMap((i) => {
      const to = matchSrdItem(i.name, data)
      return to ? [{ itemId: i.id, from: i.name, to }] : []
    })
  const srdOf = (itemId: string) => links.find((l) => l.itemId === itemId)?.to ?? data.items.find((x) => x.id === c.inventory.find((i) => i.id === itemId)?.srdId)
  const available = featuresToAdd(c)
  const linkFeatures: UpgradePlan['linkFeatures'] = []
  for (const f of available) {
    const typed = c.features.find((x) => !x.srdId && !linkFeatures.some((l) => l.featureId === x.id) &&
      (norm(x.name) === norm(f.name) || norm(f.name).startsWith(norm(x.name))))
    if (typed) linkFeatures.push({ featureId: typed.id, from: typed.name, to: f })
  }
  const addFeatures = available.filter((f) => !linkFeatures.some((l) => l.to.id === f.id))
  const armor = c.inventory
    .filter((i) => !i.equipped && ['armor', 'shield'].includes(srdOf(i.id)?.kind ?? ''))
    .map((i) => ({ itemId: i.id, name: srdOf(i.id)!.name }))
  const attacks = c.attacks.flatMap((a) => {
    const item = c.inventory.find((i) => srdOf(i.id)?.kind === 'weapon' && norm(srdOf(i.id)!.name) === norm(a.name))
    return item ? [{ attackId: a.id, name: a.name, itemId: item.id }] : []
  })
  return { links, linkFeatures, addFeatures, armor, attacks }
}

export function upgradeIsEmpty(p: UpgradePlan): boolean {
  return p.links.length + p.linkFeatures.length + p.addFeatures.length + p.armor.length + p.attacks.length === 0
}

export interface UpgradeOptions {
  /** Wear the first armor and Shield found and turn on auto AC. */
  wearArmor: boolean
  /** Equip the matching SRD weapons and remove the hand-made attacks with the same name. */
  replaceAttacks: boolean
}

export function applyUpgrade(c: Character, data: SrdEquipment, plan: UpgradePlan, opts: UpgradeOptions): Character {
  let inventory = c.inventory.map((i) => {
    const l = plan.links.find((x) => x.itemId === i.id)
    return l ? { ...i, srdId: l.to.id } : i
  })
  let next: Character = { ...c, inventory, srdLinked: true }
  next = { ...next, features: next.features.map((f) => {
    const l = plan.linkFeatures.find((x) => x.featureId === f.id)
    return l ? { ...f, srdId: l.to.id, ...(l.to.pool ? { pool: true } : {}) } : f
  }) }
  next = refreshCatalogFeatures(next)
  next = plan.addFeatures.reduce(addCatalogFeature, next)
  if (opts.wearArmor && plan.armor.length) {
    const kindOf = (id: string) => data.items.find((x) => x.id === next.inventory.find((i) => i.id === id)?.srdId)?.kind
    const suit = plan.armor.find((a) => kindOf(a.itemId) === 'armor')
    const shield = plan.armor.find((a) => kindOf(a.itemId) === 'shield')
    inventory = next.inventory.map((i) => (i.id === suit?.itemId || i.id === shield?.itemId ? { ...i, equipped: true as const } : i))
    next = applyAutoAC({ ...next, inventory, acAuto: true }, data)
  }
  if (opts.replaceAttacks && plan.attacks.length) {
    const ids = new Set(plan.attacks.map((a) => a.itemId))
    next = {
      ...next,
      inventory: next.inventory.map((i) => (ids.has(i.id) ? { ...i, equipped: true as const } : i)),
      attacks: next.attacks.filter((a) => !plan.attacks.some((x) => x.attackId === a.id)),
    }
  }
  // One item per slot: weapons beyond two hands and the back go back in the pack.
  return normalizeEquipment(next, data)
}

/** The AC the character would have with the armor found worn (to show before upgrading). */
export function upgradedAC(c: Character, data: SrdEquipment, plan: UpgradePlan): number {
  const after = applyUpgrade(c, data, plan, { wearArmor: true, replaceAttacks: false })
  return after.acAuto ? characterArmorClass(after, data).ac : c.ac
}
