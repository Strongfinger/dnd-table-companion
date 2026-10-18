// Thai monster text: DND-TH's translation (https://dnd-th.com/, used with their permission, 2026-10-13) of the
// SRD 5.2.1 stat blocks, kept apart from the English data in src/data/srd-monsters-th.json. Built by
// scripts/srd/monsters-th.ts from DND-TH's published monsters.json using buildMonstersTh() below.
// Only the words are taken: the Thai monster name and the traits, actions, bonus actions, reactions and
// legendary actions. Every number on the stat block (AC, HP, scores, CR…) still comes from our English data.
// Nothing here is imported at runtime except dndTh.ts, so Node can run the build script on it directly.
import { cleanMarkdown, findTypos, nonSrdName, stripNonSrdNames } from './dndTh.ts'

export const MONSTER_SECTIONS = ['traits', 'actions', 'bonusActions', 'reactions', 'legendaryActions'] as const
export type MonsterSection = (typeof MONSTER_SECTIONS)[number]

/** DND-TH's list name for each of our sections. */
const SOURCE_KEYS: Record<MonsterSection, string> = {
  traits: 'traits', actions: 'actions', bonusActions: 'bonus_actions', reactions: 'reactions', legendaryActions: 'legendary_actions',
}

export interface MonsterEntryTh {
  /** Thai name without the English name or the usage ("ควบคุมจิตใจ"): the card adds those from the English data. */
  name: string
  /** Simple markdown: paragraphs, **bold**, _italic_ (spell lists are part of the text). */
  text: string
}

export interface MonsterTh {
  name: string
  /** By section, then by the English entry name ("Multiattack"). */
  entries: Partial<Record<MonsterSection, Record<string, MonsterEntryTh>>>
}

export interface MonstersThFile {
  source: string
  license: string
  builtAt: string
  /** By SRD monster id. */
  monsters: Record<string, MonsterTh>
}

/** Our English stat block, only what the build needs. */
export type MonsterForTh = { id: string; name: string } & Record<MonsterSection, { name: string; text: string }[]>

export interface MonstersThReport {
  /** SRD monsters with at least one Thai entry. */
  matched: number
  /** English entries with Thai text / all English entries. */
  entries: { translated: number; total: number }
  /** SRD monsters with no 2024 Thai entry (they stay English). */
  missing: string[]
  /** "Monster: Entry" left English because DND-TH has no matching entry. */
  missingEntries: string[]
  /** Left English because the Thai text names a non-SRD world or person. */
  nonSrd: string[]
  /** "Monster: Entry" left English because the Thai numbers differ from the English ones. */
  numbersDiffer: string[]
  typos: string[]
}

interface ThaiEntry { section: MonsterSection; key: string | null; name: string; paragraphs: string[]; used?: boolean }

const THAI = /[\u0e00-\u0e7f]/
/** Letters only, lower case: "Will-o’-Wisp" = "will-o'-wisp". */
const key = (name: string) => name.toLowerCase().replace(/[^a-z]/g, '')
/** DND-TH's English names that differ from the SRD's (a typo or a plural): their key → ours. */
const ENTRY_ALIASES: Record<string, string> = { lightingblade: 'lightningblade' }

/**
 * Every spelling of our English entry names a DND-TH header may use, mapped to the entry's key: the name, the
 * name without its note ("Entangling Rope (Requires Magic Rope)" → "Entangling Rope"), and plurals
 * ("Vampire Weaknesses" for "Vampire Weakness").
 */
export function entryKeys(names: string[]): Map<string, string> {
  const out = new Map<string, string>()
  for (const name of names) {
    const k = key(name)
    for (const v of [k, key(name.replace(/\s*\(.*\)\s*$/, ''))]) for (const end of ['', 's', 'es']) if (!out.has(v + end)) out.set(v + end, k)
  }
  for (const [from, to] of Object.entries(ENTRY_ALIASES)) if (out.has(to)) out.set(from, out.get(to)!)
  return out
}

/** Lycanthropes and the Vampire have one 2024 stat block but one entry per form in our data ("Werewolf, Wolf Form"). */
const baseName = (name: string) => name.replace(/,.*$/, '').trim()
const norm = (name: string) => name.trim().toLowerCase().replace(/[’‘]/g, "'")

/**
 * One entry's header, "**_ควบคุมจิตใจ (Dominate Mind) (2/วัน)._**" or the sub-entry "**น้ำไหล (Running Water):**":
 * the entry's key and the Thai name (usage such as "(2/วัน)" or "(ชาร์จใหม่ 5-6)" is dropped: the card shows the
 * English usage). Null when the paragraph doesn't start with a bold header that names one of our entries.
 */
export function parseHeader(paragraph: string, keys: Map<string, string>, subEntry = false): { key: string | null; name: string; rest: string } | null {
  const m = subEntry ? paragraph.match(/^\*\*(?!_)(.+?)\*\*:?\s*/) : paragraph.match(/^(?:\*\*_|_\*\*)(.+?)(?:_\.?\*\*|\*\*_)\.?\s*/)
  if (!m) return null
  const header = m[1].replace(/[.:\s]+$/, '')
  const rest = paragraph.slice(m[0].length).trim()
  // An English header with no Thai ("Hooves."): the card shows just the English name.
  if (!THAI.test(header) && keys.has(key(header))) return { key: keys.get(key(header))!, name: '', rest }
  // English names in brackets; DND-TH sometimes leaves one open ("ลมหายใจเย็น (Cold Breath (ชาร์จใหม่ 5-6)").
  for (const g of header.matchAll(/\(([A-Za-z][^()\u0e00-\u0e7f]*?)\s*(?=[()]|$)/g)) {
    const k = keys.get(key(g[1]))
    if (!k) continue
    const name = (header.slice(0, g.index) + ' ' + header.slice(g.index + g[0].length).replace(/^\)/, ''))
      .replace(/\([^()]*(?:\d|ชาร์จใหม่)[^()]*\)?/g, '')
      .replace(/\s+/g, ' ').trim()
    return { key: k, name, rest }
  }
  // A header for an entry this stat block doesn't have (another form's Bite): its paragraphs are dropped. A bold
  // line with no English name ("**ตามต้องการ:**", a spell list) is part of the entry before.
  return subEntry && !/\([A-Za-z]/.test(header) ? null : { key: null, name: '', rest }
}

/**
 * The numbers a DM reads off an entry: dice ("2d6 + 3"), DCs and bonuses ("+5"), sorted. Thai text whose numbers
 * differ from the English (a sentence left out, another form's attack) isn't used. DND-TH writes "spell save DC 14"
 * as "DC การทอยป้องกันคาถา 14".
 */
export function numbersOf(text: string): string {
  return [...text.replace(/DC\s*(?:การ)?(?:ทอย)?ป้องกัน(?:คาถา|เวทมนตร์|เวทย์มนต์)?\s*(\d+)/g, 'DC $1')
    .matchAll(/\d+d\d+(?:\s*[-+–−]\s*\d+)?|DC \d+|\+\d+/g)]
    .map((m) => m[0].replace(/\s/g, '').replace(/[–−]/g, '-')).sort().join(' ')
}

/** DND-TH's paragraphs of one monster, cut into entries (paragraphs without a header join the entry before). */
function thaiEntries(row: Record<string, unknown>, keys: Map<string, string>): ThaiEntry[] {
  const out: ThaiEntry[] = []
  for (const section of MONSTER_SECTIONS) {
    const list = row[SOURCE_KEYS[section]]
    if (!Array.isArray(list)) continue
    let current: ThaiEntry | undefined
    for (const p of list) {
      if (typeof p !== 'string' || !p.trim()) continue
      const head = parseHeader(p, keys) ?? (current?.key ? parseHeader(p, keys, true) : null)
      if (head) {
        current = { section, key: head.key, name: head.name, paragraphs: head.rest ? [head.rest] : [] }
        out.push(current)
      } else if (current) {
        current.paragraphs.push(p.trim())
      }
      // Before the first header: the Legendary Actions intro, which the card writes itself.
    }
  }
  return out
}

/** Pick DND-TH's 2024 monsters that are SRD 5.2.1 monsters (by English name) and match their entries to ours. */
export function buildMonstersTh(data: unknown, srd: MonsterForTh[]): { monsters: Record<string, MonsterTh>; report: MonstersThReport } | { error: string } {
  if (!Array.isArray(data)) return { error: 'monsters.json should be a list' }
  const rows = data.filter((x): x is Record<string, unknown> & { name: string; title: string } =>
    typeof x === 'object' && x !== null && x.version === '2024' && typeof x.name === 'string' && typeof x.title === 'string')
  const byName = new Map(rows.map((r) => [norm(r.name), r]))

  const monsters: Record<string, MonsterTh> = {}
  const report: MonstersThReport = { matched: 0, entries: { translated: 0, total: 0 }, missing: [], missingEntries: [], nonSrd: [], numbersDiffer: [], typos: [] }
  for (const m of srd) {
    const total = MONSTER_SECTIONS.reduce((n, s) => n + m[s].length, 0)
    report.entries.total += total
    const row = byName.get(norm(m.name)) ?? byName.get(norm(baseName(m.name)))
    if (!row) { report.missing.push(m.name); continue }

    const thai = thaiEntries(row, entryKeys(MONSTER_SECTIONS.flatMap((s) => m[s].map((e) => e.name))))
    const entries: MonsterTh['entries'] = {}
    for (const section of MONSTER_SECTIONS) {
      for (const e of m[section]) {
        const k = key(e.name)
        // Same section first: DND-TH sometimes files an entry under another heading.
        const t = thai.find((x) => x.section === section && x.key === k && !x.used) ?? thai.find((x) => x.key === k && !x.used)
        if (!t) { report.missingEntries.push(`${m.name}: ${e.name}`); continue }
        t.used = true
        const name = stripNonSrdNames(t.name)
        const text = stripNonSrdNames(cleanMarkdown(t.paragraphs.join('\n\n')))
        const bad = nonSrdName(name) ?? nonSrdName(text)
        if (bad) { report.nonSrd.push(`${m.name}: ${e.name} (${bad})`); continue }
        if (numbersOf(text) !== numbersOf(e.text)) { report.numbersDiffer.push(`${m.name}: ${e.name}`); continue }
        report.typos.push(...findTypos(`${name} ${text}`).map((x) => `${m.name}, ${e.name}: ${x}`))
        ;(entries[section] ??= {})[e.name] = { name, text }
        report.entries.translated++
      }
    }
    // "ฝูงกรงเล็บคลาน (Swarm of Crawling Claws)": the card shows the English name already.
    const title = stripNonSrdNames(row.title.replace(/\s*\([^()\u0e00-\u0e7f]*\)\s*$/, '').trim())
    monsters[m.id] = { name: title, entries }
    report.matched++
  }
  return { monsters, report }
}
