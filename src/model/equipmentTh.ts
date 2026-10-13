// Thai equipment text: DND-TH's translation (https://dnd-th.com/, used with their permission, 2026-10-13) of the
// SRD 5.2.1 equipment, in src/data/srd-equipment-th.json, keyed by the ids in src/data/srd-equipment.json, plus
// the weapon properties and masteries by English name. Built by scripts/srd/equipment-th.ts.
// DND-TH translates the 2024 Player's Handbook, whose armor and weapons have flavour text the SRD doesn't: an
// item only gets Thai text when our (PDF-checked) English item has text too.
// Nothing here is imported at runtime except dndTh.ts, so Node can run the build script on it directly.
import { cleanMarkdown, findTypos, nonSrdName, stripNonSrdNames } from './dndTh.ts'

export interface EquipmentItemTh {
  name: string
  /** Description in simple markdown (only where the English item has text). */
  text?: string
  /** Tools: what the tool is used for, with DCs (the English `utilize` list in Thai). */
  utilize?: string
}

export interface RuleTextTh { name: string; text: string }

export interface EquipmentThFile {
  source: string
  license: string
  builtAt: string
  /** By SRD item id. */
  items: Record<string, EquipmentItemTh>
  /** Weapon properties and masteries by English name ("Finesse", "Vex"). */
  properties: Record<string, RuleTextTh>
  masteries: Record<string, RuleTextTh>
}

interface DndThDetail { name?: unknown; name_th?: unknown; title?: unknown; description?: unknown }
interface DndThEquipment {
  name: string
  title: string
  description?: unknown
  utilize?: unknown
  property_details?: DndThDetail[]
  mastery_details?: DndThDetail | null
}

export interface EquipmentThReport {
  matched: number
  /** SRD items with no Thai entry (they stay English). */
  missing: string[]
  nonSrd: string[]
  typos: string[]
}

/** Same words in any order: "Crossbow, Hand" = "Hand Crossbow", "Spikes, Iron" = "Iron Spikes". */
const wordKey = (name: string) => name.toLowerCase().replace(/[’']/g, '').split(/[^a-z0-9]+/).filter(Boolean).sort().join(' ')
/** Looser: also without "armor" and spaces, for DND-TH's "Leather" (Leather Armor) and "Great Club" (Greatclub). */
const looseKey = (name: string) => name.toLowerCase().replace(/\barmor\b/g, '').replace(/[^a-z0-9]/g, '')
const str = (x: unknown) => (typeof x === 'string' ? x.trim() : '')

export function buildEquipmentTh(
  data: unknown,
  srd: { items: { id: string; name: string; text?: string; utilize?: string[] }[]; properties: { name: string }[]; masteries: { name: string }[] },
): { file: Omit<EquipmentThFile, 'source' | 'license' | 'builtAt'>; report: EquipmentThReport } | { error: string } {
  if (!Array.isArray(data)) return { error: 'equipments.json should be a list' }
  const rows = data.filter((x): x is DndThEquipment => typeof x === 'object' && x !== null && typeof x.name === 'string' && typeof x.title === 'string')
  const byName = new Map(rows.map((r) => [wordKey(r.name), r]))
  const byLoose = new Map(rows.map((r) => [looseKey(r.name), r]))
  const report: EquipmentThReport = { matched: 0, missing: [], nonSrd: [], typos: [] }
  const clean = (md: string) => stripNonSrdNames(cleanMarkdown(md.slice(0, 20000)))
  const check = (label: string, text: string) => {
    const bad = nonSrdName(text)
    if (bad) report.nonSrd.push(`${label} (${bad})`)
    for (const t of findTypos(text)) report.typos.push(`${label}: ${t}`)
    return !bad
  }

  const items: Record<string, EquipmentItemTh> = {}
  for (const it of srd.items) {
    const row = byName.get(wordKey(it.name)) ?? byLoose.get(looseKey(it.name))
    if (!row || !row.title.trim()) { report.missing.push(it.name); continue }
    const name = clean(row.title).slice(0, 100)
    const text = it.text ? clean(str(row.description)) : ''
    const utilize = it.utilize?.length ? clean(str(row.utilize)) : ''
    if (!check(it.name, `${name}\n${text}\n${utilize}`)) continue
    items[it.id] = { name, ...(text ? { text } : {}), ...(utilize ? { utilize } : {}) }
    report.matched++
  }

  // Property and mastery texts come with every weapon; keep one of each that the SRD has.
  const details = (pick: (r: DndThEquipment) => DndThDetail[], wanted: { name: string }[]) => {
    const names = new Map(wanted.map((w) => [wordKey(w.name), w.name]))
    const out: Record<string, RuleTextTh> = {}
    for (const d of rows.flatMap(pick)) {
      const en = names.get(wordKey(str(d.name)))
      const th = str(d.name_th) || str(d.title)
      const text = clean(str(d.description))
      if (!en || out[en] || !th || !text || !check(en, `${th}\n${text}`)) continue
      out[en] = { name: th.slice(0, 100), text }
    }
    for (const w of wanted) if (!out[w.name]) report.missing.push(w.name)
    return out
  }
  const properties = details((r) => (Array.isArray(r.property_details) ? r.property_details : []), srd.properties)
  const masteries = details((r) => (r.mastery_details && typeof r.mastery_details === 'object' ? [r.mastery_details] : []), srd.masteries)
  return { file: { items, properties, masteries }, report }
}
