// Thai spell text: DND-TH's translation (https://dnd-th.com/, used with their permission, 2026-10-13) of the
// SRD 5.2.1 spells, kept apart from the English data in src/data/srd-spells-th.json. The file is built by
// scripts/srd/spells-th.ts from DND-TH's published spells.json using buildSpellsTh() below; the app shows it
// on spell cards with a TH/EN switch.
// Nothing here is imported at runtime except dndTh.ts, so Node can run the build script on it directly.
import type { SrdSpell } from './spells'
import { cleanMarkdown, findTypos, nonSrdName, stripNonSrdNames } from './dndTh.ts'

export interface SpellTh {
  /** Thai spell name (the English name stays the main one). */
  name: string
  /** Description in simple markdown: paragraphs, **bold**, _italic_, "- " lists, | tables |. */
  text: string
  /** "Using a Higher-Level Spell Slot" / cantrip upgrade, without its heading. */
  higher?: string
  /** The material component, in Thai. */
  material?: string
}

export interface SpellsThFile {
  source: string
  license: string
  builtAt: string
  /** By SRD spell id. */
  spells: Record<string, SpellTh>
}

/** One spell as DND-TH publishes it (only the fields we use). */
interface DndThSpell {
  version: string
  name: string
  title: string
  description: string
}

/** Lower case, straight apostrophes, and no "Tenser's"-style owner: the SRD drops the wizard's name. */
const norm = (name: string) => name.toLowerCase().replace(/[’‘`]/g, "'").replace(/\s+/g, ' ').trim()
const withoutOwner = (name: string) => norm(name).replace(/^[a-z]+'s /, '')
/** SRD names that the 2024 books give another name (not just a wizard's name in front). */
const SRD_ALIASES: Record<string, string> = { 'arcane hand': "bigby's hand", 'arcane sword': "mordenkainen's sword" }
/** Thai names for those two: without the wizard, DND-TH's would be just "มือ" and "ดาบ". */
const ALIAS_NAMES_TH: Record<string, string> = { 'arcane-hand': 'มือเวทมนตร์', 'arcane-sword': 'ดาบเวทมนตร์' }

const HIGHER = /^(?:\*\*_?|_\*\*)\s*(เมื่อใช้(?:กับ)?สล็อตคาถา(?:ที่)?เลเวลสูงขึ้น|เพิ่ม(?:ระ+ดับ|อำนาจ)แคนทริป)\s*\.?\s*(?:\*\*_|_?\*\*)\s*/
const MATERIAL = /^\\\*\s*\((.+)\)\s*$/

/** Split one description into text, higher-level paragraph and material note. */
export function splitDescription(md: string): Pick<SpellTh, 'text' | 'higher' | 'material'> {
  const paragraphs = cleanMarkdown(md).split(/\n\n/)
  const text: string[] = []
  let higher: string | undefined
  let material: string | undefined
  for (const p of paragraphs) {
    const m = p.match(MATERIAL)
    if (m) material = m[1].trim()
    else if (!higher && HIGHER.test(p)) higher = p.replace(HIGHER, '').trim()
    else text.push(p)
  }
  return { text: text.join('\n\n'), ...(higher ? { higher } : {}), ...(material ? { material } : {}) }
}

export interface SpellsThReport {
  translated2024: number
  matched: number
  /** Matched only after dropping the wizard's name ("Tenser's Floating Disk" → "Floating Disk"). */
  matchedWithoutOwner: string[]
  /** SRD spells with no 2024 Thai entry (they stay English). */
  missing: string[]
  /** Likely typos to tell DND-TH about (they asked for reports). */
  typos: string[]
  /** Left English because the Thai text names a non-SRD world or person. */
  nonSrd: string[]
}

/** Pick DND-TH's 2024 spells that are SRD 5.2.1 spells, matched by English name. */
export function buildSpellsTh(data: unknown, srd: Pick<SrdSpell, 'id' | 'name'>[]): { spells: Record<string, SpellTh>; report: SpellsThReport } | { error: string } {
  if (!Array.isArray(data)) return { error: 'spells.json should be a list' }
  const rows = data.filter((x): x is DndThSpell =>
    typeof x === 'object' && x !== null && x.version === '2024' &&
    typeof x.name === 'string' && typeof x.title === 'string' && typeof x.description === 'string')
  const exact = new Map(rows.map((r) => [norm(r.name), r]))
  const loose = new Map(rows.map((r) => [withoutOwner(r.name), r]))
  const spells: Record<string, SpellTh> = {}
  const report: SpellsThReport = { translated2024: rows.length, matched: 0, matchedWithoutOwner: [], missing: [], typos: [], nonSrd: [] }
  for (const s of srd) {
    let row = exact.get(norm(s.name)) ?? exact.get(SRD_ALIASES[norm(s.name)] ?? '')
    if (!row) {
      row = loose.get(withoutOwner(s.name))
      if (row) report.matchedWithoutOwner.push(`${s.name} = ${row.name}`)
    }
    if (!row || !row.title.trim() || !row.description.trim()) { report.missing.push(s.name); continue }
    const parts = Object.fromEntries(Object.entries(splitDescription(row.description.slice(0, 20000))).map(([k, v]) => [k, stripNonSrdNames(v)])) as ReturnType<typeof splitDescription>
    const bad = nonSrdName(Object.values(parts).join('\n'))
    if (bad) { report.nonSrd.push(`${s.name} (${bad})`); continue }
    spells[s.id] = { name: ALIAS_NAMES_TH[s.id] ?? stripNonSrdNames(row.title).trim().slice(0, 100), ...parts }
    report.matched++
    for (const t of findTypos(`${row.title}\n${row.description}`)) report.typos.push(`${s.name}: ${t}`)
  }
  return { spells, report }
}
