// Thai magic item text: DND-TH's translation (https://dnd-th.com/, used with their permission, 2026-10-13) of
// the SRD 5.2.1 magic items, kept apart from the English data in src/data/srd-magic-items-th.json, keyed by the
// same ids as src/data/srd-magic-items.json. Built by scripts/srd/magic-items-th.ts with buildMagicItemsTh().
// Nothing here is imported at runtime except dndTh.ts, so Node can run the build script on it directly.
import { cleanMarkdown, findTypos, nonSrdName, stripNonSrdNames } from './dndTh.ts'

export interface MagicItemTh {
  /** Thai name (the English name stays the main one). */
  name: string
  /** Description in simple markdown (see model/miniMarkdown.ts). */
  text: string
}

export interface MagicItemsThFile {
  source: string
  license: string
  builtAt: string
  /** By SRD magic item id. */
  items: Record<string, MagicItemTh>
}

/** One item as DND-TH publishes it (only the fields we use). */
interface DndThItem {
  version: string
  name: string
  name_th: string
  description: string
}

/**
 * SRD items DND-TH lists under another name: SRD name → [DND-TH's entry, Thai name]. Either the SRD drops a
 * person's name (Handy Haversack), or DND-TH has one entry for several SRD items (+1/+2/+3, potion tiers,
 * spell scroll levels, the four horns). Without a Thai name here, DND-TH's is used with the names taken out.
 */
const ALIASES: Record<string, [string, string?]> = {
  'Apparatus of the Crab': ['Apparatus of Kwalish', 'เครื่องกลรูปปู'],
  'Efficient Quiver': ['Quiver of Ehlonna', 'กระบอกธนูวิเศษ'],
  'Feather Token': ["Quaal's Feather Token"],
  'Handy Haversack': ["Heward's Handy Haversack"],
  'Instant Fortress': ["Daern's Instant Fortress"],
  'Iron Bands': ['Iron Bands of Bilarro'],
  'Marvelous Pigments': ["Nolzur's Marvelous Pigments"],
  'Mysterious Deck': ['Deck of Many Things', 'สำรับไพ่ลึกลับ'],
  'Potion of Healing': ['Potions of Healing', 'โพชันแห่งการฟื้นฟู'],
  'Potion of Greater Healing': ['Potions of Healing', 'โพชันแห่งการฟื้นฟู (ยิ่งขึ้น)'],
  'Potion of Superior Healing': ['Potions of Healing', 'โพชันแห่งการฟื้นฟู (ยิ่งกว่า)'],
  'Potion of Supreme Healing': ['Potions of Healing', 'โพชันแห่งการฟื้นฟู (สูงสุด)'],
  'Spell Scroll (Cantrip or Level 1)': ['Spell Scroll', 'ม้วนคาถา (แคนทริปหรือเลเวล 1)'],
  'Spell Scroll (Level 2 or 3)': ['Spell Scroll', 'ม้วนคาถา (เลเวล 2 หรือ 3)'],
  'Spell Scroll (Level 4 or 5)': ['Spell Scroll', 'ม้วนคาถา (เลเวล 4 หรือ 5)'],
  'Spell Scroll (Level 6 to 8)': ['Spell Scroll', 'ม้วนคาถา (เลเวล 6 ถึง 8)'],
  'Spell Scroll (Level 9)': ['Spell Scroll', 'ม้วนคาถา (เลเวล 9)'],
  'Silver Horn of Valhalla': ['Horn of Valhalla', 'แตรวัลฮัลลาแบบเงิน'],
  'Brass Horn of Valhalla': ['Horn of Valhalla', 'แตรวัลฮัลลาแบบทองเหลือง'],
  'Bronze Horn of Valhalla': ['Horn of Valhalla', 'แตรวัลฮัลลาแบบสัมฤทธิ์'],
  'Iron Horn of Valhalla': ['Horn of Valhalla', 'แตรวัลฮัลลาแบบเหล็ก'],
  // DND-TH's Crystal Ball entry has all four balls; each variant gets the whole text.
  'Crystal Ball of Mind Reading': ['Crystal Ball', 'ลูกแก้วพยากรณ์อ่านจิต'],
  'Crystal Ball of Telepathy': ['Crystal Ball', 'ลูกแก้วพยากรณ์โทรจิต'],
  'Crystal Ball of True Seeing': ['Crystal Ball', 'ลูกแก้วพยากรณ์ตาทิพย์'],
}
/** "Armor +2", "Ammunition, +1", "Wand of the War Mage +3" → DND-TH's "…, +1, +2, or +3" entry. */
const PLUS = /^(Ammunition|Armor|Shield|Weapon|Wand of the War Mage),? \+([123])$/
/**
 * Not used even though a name matches: DND-TH's Orb of Dragonkind is the longer Dragonlance artifact, not the
 * SRD's Dragon Orb.
 */
const SKIP = new Set(['Dragon Orb'])

export interface MagicItemsThReport {
  translated2024: number
  matched: number
  /** SRD items with no Thai entry (they stay English). */
  missing: string[]
  /** Left English because the Thai text names a non-SRD world or person. */
  nonSrd: string[]
  typos: string[]
}

const norm = (name: string) => name.toLowerCase().replace(/[’‘`]/g, "'").replace(/\s+/g, ' ').trim()

export function buildMagicItemsTh(data: unknown, srd: { id: string; name: string }[]): { items: Record<string, MagicItemTh>; report: MagicItemsThReport } | { error: string } {
  if (!Array.isArray(data)) return { error: 'magic-items.json should be a list' }
  const rows = data.filter((x): x is DndThItem =>
    typeof x === 'object' && x !== null && x.version === '2024' && typeof x.name === 'string' &&
    typeof x.name_th === 'string' && typeof x.description === 'string')
  const byName = new Map(rows.map((r) => [norm(r.name), r]))
  const items: Record<string, MagicItemTh> = {}
  const report: MagicItemsThReport = { translated2024: rows.length, matched: 0, missing: [], nonSrd: [], typos: [] }
  for (const it of srd) {
    if (SKIP.has(it.name)) { report.missing.push(it.name); continue }
    const plus = it.name.match(PLUS)
    const [source, thaiName] = plus ? [`${plus[1]}, +1, +2, or +3`] : ALIASES[it.name] ?? [it.name]
    const row = byName.get(norm(source))
    if (!row || !row.name_th.trim() || !row.description.trim()) { report.missing.push(it.name); continue }
    const text = cleanMarkdown(stripNonSrdNames(row.description.slice(0, 20000)))
    const bad = nonSrdName(text)
    if (bad) { report.nonSrd.push(`${it.name} (${bad})`); continue }
    const name = thaiName ?? (plus
      ? stripNonSrdNames(row.name_th).replace(/,?\s*\+1, \+2 หรือ \+3/, ` +${plus[2]}`)
      : stripNonSrdNames(row.name_th))
    items[it.id] = { name: name.trim().slice(0, 100), text }
    report.matched++
    for (const t of findTypos(`${row.name_th}\n${text}`)) report.typos.push(`${it.name}: ${t}`)
  }
  return { items, report }
}
