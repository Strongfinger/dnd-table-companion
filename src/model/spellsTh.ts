// Thai spell text: DND-TH's translation (https://dnd-th.com/, used with their permission, 2026-10-13) of the
// SRD 5.2.1 spells, kept apart from the English data in src/data/srd-spells-th.json. The file is built by
// scripts/srd/spells-th.ts from DND-TH's published spells.json using buildSpellsTh() below; the app shows it
// on spell cards with a TH/EN switch.
// This module has no runtime imports, so Node can run the build script on it directly.
import type { SrdSpell } from './spells'

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

export const SPELLS_TH_CREDIT = { name: 'DND-TH', url: 'https://dnd-th.com/', license: 'CC BY-NC-SA 4.0', licenseUrl: 'https://creativecommons.org/licenses/by-nc-sa/4.0/' }

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

const HIGHER = /^(?:\*\*_?|_\*\*)\s*(เมื่อใช้(?:กับ)?สล็อตคาถา(?:ที่)?เลเวลสูงขึ้น|เพิ่ม(?:ระ+ดับ|อำนาจ)แคนทริป)\s*\.?\s*(?:\*\*_|_?\*\*)\s*/
const MATERIAL = /^\\\*\s*\((.+)\)\s*$/

/** DND-TH's markdown → ours: site links become plain text, escaped "\*" a plain "*", tidy blank lines. */
export function cleanMarkdown(md: string): string {
  return md
    .replace(/\r\n?/g, '\n')
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
    .split('\n').map((l) => l.replace(/[ \t]+$/g, '')).join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

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
}

/**
 * Spots slips worth a human look, each with a little text around it: a vowel or tone mark typed twice,
 * a word typed twice in a row, and Latin letters stuck to a Thai word. Thai has no spaces between words, so
 * a repeat only counts when it starts a word and ends before a non-Thai character; "ที่ที่" is normal Thai.
 */
export function findTypos(text: string): string[] {
  const hits: { at: number; len: number }[] = []
  for (const m of text.matchAll(/([ะาิีึืุู่้๊๋็์])\1/g)) hits.push({ at: m.index, len: 2 })
  for (const m of text.matchAll(/(?<![ก-๛])([ก-ฮเแโใไ][ก-๛]{2,})\1(?![ก-๛])/g)) {
    if (m[1] !== 'ที่') hits.push({ at: m.index, len: m[0].length })
  }
  for (const m of text.matchAll(/[ก-๛][a-z]+\b/g)) hits.push({ at: m.index, len: m[0].length })
  return hits.map(({ at, len }) => `…${text.slice(Math.max(0, at - 15), at + len + 15).replace(/\s+/g, ' ')}…`)
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
  const report: SpellsThReport = { translated2024: rows.length, matched: 0, matchedWithoutOwner: [], missing: [], typos: [] }
  for (const s of srd) {
    let row = exact.get(norm(s.name)) ?? exact.get(SRD_ALIASES[norm(s.name)] ?? '')
    if (!row) {
      row = loose.get(withoutOwner(s.name))
      if (row) report.matchedWithoutOwner.push(`${s.name} = ${row.name}`)
    }
    if (!row || !row.title.trim() || !row.description.trim()) { report.missing.push(s.name); continue }
    const parts = splitDescription(row.description.slice(0, 20000))
    spells[s.id] = { name: row.title.trim().slice(0, 100), ...parts }
    report.matched++
    for (const t of findTypos(`${row.title}\n${row.description}`)) report.typos.push(`${s.name}: ${t}`)
  }
  return { spells, report }
}
