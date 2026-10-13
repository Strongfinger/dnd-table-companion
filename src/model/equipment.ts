// SRD 5.2.1 equipment: weapons, armor, gear, tools, packs, plus the weapon property and Weapon Mastery
// texts (data: src/data/srd-equipment.json, built by scripts/srd/equipment.mjs).

export type EquipmentKind = 'weapon' | 'armor' | 'shield' | 'ammunition' | 'pack' | 'tool' | 'focus' | 'gear' | 'poison'

export interface SrdWeapon {
  category: 'Simple' | 'Martial'
  type: 'Melee' | 'Ranged'
  /** "1d8", or "1" (Blowgun) */
  dice: string
  damageType: string
  properties: string[]
  mastery: string
  /** Melee: { normal: 5 }; ranged: normal/long range in feet. */
  range: { normal: number; long?: number }
  /** Thrown range, for Thrown weapons. */
  thrown?: { normal: number; long?: number }
  /** Two-handed damage dice, for Versatile weapons. */
  versatile?: string
  /** Ammunition item name, e.g. "Arrows". */
  ammunition?: string
  notes?: string[]
}

export interface SrdArmor {
  category: 'Light' | 'Medium' | 'Heavy' | 'Shield'
  /** Base AC; a Shield's bonus (2). */
  base: number
  /** null = add the full DEX modifier, 0 = no DEX, 2 = DEX up to +2 (Medium armor). */
  dexCap: number | null
  /** Strength score needed to avoid −10 ft. Speed (0 = none). */
  strMin: number
  stealthDisadvantage: boolean
}

export interface SrdItem {
  id: string
  name: string
  kind: EquipmentKind
  cost: { qty: number; unit: 'cp' | 'sp' | 'gp' }
  weight?: number
  /** How many come in one purchase (e.g. 20 Arrows). */
  qty?: number
  text?: string
  weapon?: SrdWeapon
  armor?: SrdArmor
  /** Tools: the ability used and what you can do with them. */
  ability?: string
  utilize?: string[]
  /** Packs: what is inside. */
  contents?: { name: string; qty: number }[]
}

export interface SrdEquipment {
  items: SrdItem[]
  /** Weapon properties (Finesse, Light…), including "Range". */
  properties: { name: string; text: string }[]
  /** The eight Weapon Mastery properties (Cleave, Graze…). */
  masteries: { name: string; text: string }[]
}

/** Loaded only when needed (about 50 KB). */
export async function loadSrdEquipment(): Promise<SrdEquipment> {
  const mod = await import('../data/srd-equipment.json')
  return mod.default as SrdEquipment
}

export function findItem(data: SrdEquipment, id: string): SrdItem | undefined {
  return data.items.find((i) => i.id === id)
}

/** Search by name words, optionally only some kinds. Sorted by name. */
/** Items whose English name (or Thai name, from `thaiNames` by id) has every word of the query. */
export function searchItems(data: SrdEquipment, query: string, kinds?: EquipmentKind[], thaiNames?: Record<string, { name: string }>): SrdItem[] {
  const words = query.toLowerCase().split(/\s+/).filter(Boolean)
  return data.items.filter((i) => (!kinds || kinds.includes(i.kind)) &&
    words.every((w) => i.name.toLowerCase().includes(w) || !!thaiNames?.[i.id]?.name.includes(w)))
}

const feet = (r: { normal: number; long?: number }) => (r.long ? `${r.normal}/${r.long}` : `${r.normal}`)

/** The ammunition item ("Arrows", "Bullets, Sling") as the weapon table names it ("Arrow", "Bullet"). */
function ammunitionType(item: string): string {
  return item.startsWith('Bullets') ? 'Bullet' : item.replace(/s$/, '')
}

/** Properties as the 2024 table writes them: "Thrown (Range 20/60)", "Versatile (1d10)", "Ammunition (Range 150/600; Arrow)". */
export function weaponPropertiesLine(w: SrdWeapon): string {
  return w.properties.map((p) => {
    if (p === 'Thrown' && w.thrown) return `Thrown (Range ${feet(w.thrown)})`
    if (p === 'Versatile' && w.versatile) return `Versatile (${w.versatile})`
    if (p === 'Ammunition') return `Ammunition (Range ${feet(w.range)}${w.ammunition ? `; ${ammunitionType(w.ammunition)}` : ''})`
    return p
  }).join(', ')
}

/** "14 + Dex modifier (max 2)", "18", "+2" — the AC column of the armor table. */
export function armorClassLine(a: SrdArmor): string {
  if (a.category === 'Shield') return `+${a.base}`
  if (a.dexCap === 0) return `${a.base}`
  return a.dexCap === null ? `${a.base} + Dex modifier` : `${a.base} + Dex modifier (max ${a.dexCap})`
}

export function costLine(c: SrdItem['cost']): string {
  return `${c.qty.toLocaleString('en-US')} ${c.unit.toUpperCase()}`
}

/** Kind filters for item pickers (Thai labels). */
export const KIND_FILTERS: { label: string; kinds: EquipmentKind[] }[] = [
  { label: 'อาวุธ', kinds: ['weapon', 'ammunition'] },
  { label: 'เกราะ/โล่', kinds: ['armor', 'shield'] },
  { label: 'แพ็ก', kinds: ['pack'] },
  { label: 'เครื่องมือ', kinds: ['tool'] },
  { label: 'ของใช้', kinds: ['gear', 'focus'] },
  { label: 'พิษ', kinds: ['poison'] },
]
