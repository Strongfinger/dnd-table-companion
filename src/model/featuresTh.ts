// Thai feature text: DND-TH's translation (https://dnd-th.com/, used with their permission, 2026-10-13) of SRD
// 5.2.1 features, kept apart from the English text in src/data/srd-features-th.json and keyed by the same ids as
// src/data/srd-features.json: feats (from DND-TH's feats.json, buildFeatsTh), class and subclass features
// (DND-TH's class markdown pages, buildClassFeaturesTh) and species traits (species pages, buildTraitsTh).
// The file is built by scripts/srd/features-th.ts.
// Nothing here is imported at runtime except dndTh.ts, so Node can run the build script.
import { cleanMarkdown, findTypos, nonSrdName, stripNonSrdNames } from './dndTh.ts'

export interface FeatureTh {
  /** Thai name (the English name stays the main one). */
  name: string
  /** Rules text in simple markdown (see model/miniMarkdown.ts). */
  text: string
}

export interface FeaturesThFile {
  source: string
  license: string
  builtAt: string
  /** By SRD feature id (as in srd-features.json). */
  features: Record<string, FeatureTh>
}

/** One feat as DND-TH publishes it (only the fields we use). */
interface DndThFeat {
  version: string
  name: string
  name_th: string
  description: string
  benefits: string[]
}

export interface FeatsThReport {
  translated2024: number
  matched: number
  /** SRD feats with no Thai entry (they stay English). */
  missing: string[]
  /** Likely typos to tell DND-TH about. */
  typos: string[]
}

const norm = (name: string) => name.toLowerCase().replace(/-/g, ' ').replace(/\s+/g, ' ').trim()

/**
 * Pick DND-TH's 2024 feats that are SRD 5.2.1 feats, matched by English name. The Thai text is the
 * description, then each benefit as its own paragraph. (Prerequisites aren't in the English text either:
 * the feat picker shows them.)
 */
export function buildFeatsTh(data: unknown, srd: { id: string; name: string }[]): { features: Record<string, FeatureTh>; report: FeatsThReport } | { error: string } {
  if (!Array.isArray(data)) return { error: 'feats.json should be a list' }
  const rows = data.filter((x): x is DndThFeat =>
    typeof x === 'object' && x !== null && x.version === '2024' && typeof x.name === 'string' &&
    typeof x.name_th === 'string' && typeof x.description === 'string' &&
    Array.isArray(x.benefits) && x.benefits.every((b: unknown) => typeof b === 'string'))
  const byName = new Map(rows.map((r) => [norm(r.name), r]))
  const features: Record<string, FeatureTh> = {}
  const report: FeatsThReport = { translated2024: rows.length, matched: 0, missing: [], typos: [] }
  for (const f of srd) {
    const row = byName.get(norm(f.name))
    if (!row || !row.name_th.trim() || !row.description.trim()) { report.missing.push(f.name); continue }
    const text = [row.description, ...row.benefits].map((p) => stripNonSrdNames(cleanMarkdown(p.slice(0, 5000)))).filter(Boolean).join('\n\n')
    features[f.id] = { name: row.name_th.trim().slice(0, 100), text }
    report.matched++
    for (const t of findTypos(`${row.name_th}\n${text}`)) report.typos.push(`${f.name}: ${t}`)
  }
  return { features, report }
}

// ---- Class features and species traits, from DND-TH's markdown pages (the 2024 Free Rules in Thai) ----
// The pages also hold things the SRD doesn't have (other subclasses, Aasimar): only sections that match an SRD
// feature of ours are kept.

export interface MarkdownThReport {
  matched: number
  /** SRD features/traits with no Thai section found (they stay English). */
  missing: string[]
  nonSrd: string[]
  typos: string[]
}

/** Lower case letters and digits only, so "Commander’s Strike" = "Commanders Strike". */
const key = (name: string) => name.toLowerCase().replace(/[^a-z0-9]/g, '')

/** "เลเวล 3: คริติคัลขั้นสูง (Improved Critical) {#Level3ImprovedCritical}" → its parts. */
function parseHeading(text: string): { level?: number; th: string; en?: string; anchor?: string } {
  const anchor = text.match(/\{#([^}]*)\}\s*$/)
  const t = text.replace(/\s*\{#[^}]*\}\s*$/, '').trim()
  const level = t.match(/^เลเวล\s*(\d+)\s*:\s*/)
  const rest = level ? t.slice(level[0].length) : t
  const en = rest.match(/\(([^()]*)\)\s*$/)
  return {
    ...(level ? { level: Number(level[1]) } : {}),
    th: (en ? rest.slice(0, en.index) : rest).trim(),
    // "(แบ็ทเทิลมาสเตอร์ - Battle Master)": the English is after the dash.
    ...(en ? { en: en[1].split(' - ').pop()!.trim() } : {}),
    // "{#Level3SorcererSubclass}": the anchor names the section in English (used when there's no "(English)").
    ...(anchor ? { anchor: anchor[1].replace(/^Level\d+/, '') } : {}),
  }
}

/** Sidebars ("> …" boxes of advice and flavour) aren't SRD rules text. */
const isSidebar = (line: string) => /^\s*>/.test(line)

/** A sub-heading inside a section stays a markdown heading, without its "{#anchor}". */
const tidyLine = (line: string) => line.replace(/^(#{1,6} .*?)\s*\{#[^}]*\}\s*$/, '$1')

interface Section { en: string; th: string; level?: number; subclass?: string; text: string }

/**
 * One class page → its features: every "เลเวล N: Thai (English)" heading, with the text up to the next heading
 * of the same size or bigger, except the feature's own table heading ("Life Domain Spells" under "เลเวล 3: …
 * (Life Domain Spells)"). Features under "### คลาสย่อย…" belong to the subclass heading above them. A heading
 * with a level but no "(English)" is named by its anchor ("{#Level3SorcererSubclass}" → "SorcererSubclass").
 */
export function classSections(md: string): Section[] {
  const out: Section[] = []
  let inSubclasses = false
  let subclass: string | undefined
  let cur: (Section & { depth: number; lines: string[] }) | null = null
  const close = () => { if (cur) out.push({ en: cur.en, th: cur.th, level: cur.level, subclass: cur.subclass, text: cur.lines.join('\n') }); cur = null }
  for (const line of md.replace(/\r\n?/g, '\n').split('\n')) {
    const h = line.match(/^(#{1,6})\s+(.*)$/)
    if (h) {
      const depth = h[1].length
      const head = parseHeading(h[2])
      const en = head.en ?? (head.level !== undefined ? head.anchor : undefined)
      const isFeature = head.level !== undefined && !!en
      const ownTable = cur && [head.en, head.anchor].some((n) => n && key(n) === key(cur!.en))
      if (cur && (depth < cur.depth || (depth === cur.depth && (isFeature || !ownTable)))) close()
      if (depth <= 3) { inSubclasses = /คลาสย่อย/.test(h[2]); subclass = undefined }
      else if (depth === 4 && inSubclasses && !isFeature) subclass = head.en
      if (isFeature) { cur = { en: en!, th: head.th, level: head.level, subclass: depth > 4 || inSubclasses ? subclass : undefined, text: '', depth, lines: [] }; continue }
    }
    if (!isSidebar(line)) cur?.lines.push(tidyLine(line))
  }
  close()
  return out
}

/**
 * One species page → its traits: each "**_Thai (English)_** text" paragraph and what follows it. A lineage
 * table under its own small heading ("##### Elven Lineages") goes with the trait it belongs to ("Elven
 * Lineage"), even when other traits come between.
 */
export function traitSections(md: string): Section[] {
  const out: (Section & { lines: string[] })[] = []
  let cur: (Section & { lines: string[] }) | null = null
  // Same word, give or take a plural or "-y/-ies" ending: "Elven Lineages" ~ "Elven Lineage", "Ancestors" ~ "Ancestry".
  const sameWord = (a: string, b: string) => {
    const [x, y] = [key(a), key(b)]
    const stem = Math.min(x.length, y.length) - 2
    return stem >= 4 && x.slice(0, stem) === y.slice(0, stem) && Math.abs(x.length - y.length) <= 2
  }
  for (const line of md.replace(/\r\n?/g, '\n').split('\n')) {
    const trait = line.match(/^\*\*_\s*(.+?)\s*\(([^()]+)\)\.?\s*_\*\*\.?\s*(.*)$/)
    if (trait) { cur = { en: trait[2].trim(), th: trait[1].trim(), text: '', lines: [trait[3]] }; out.push(cur); continue }
    const h = line.match(/^(#{1,6})\s+(.*)$/)
    if (h) {
      const head = parseHeading(h[2])
      const owner = h[1].length >= 5 && out.find((t) => [head.en, head.anchor].some((n) => n && sameWord(n, t.en)))
      cur = owner || null
      if (owner) owner.lines.push('', tidyLine(line))
      continue
    }
    if (!isSidebar(line)) cur?.lines.push(tidyLine(line))
  }
  return out.map((t) => ({ en: t.en, th: t.th, text: t.lines.join('\n') }))
}

function finish(srdName: string, sec: Section, report: MarkdownThReport, out: Record<string, FeatureTh>, id: string) {
  const text = stripNonSrdNames(cleanMarkdown(sec.text.slice(0, 30000)))
  const bad = nonSrdName(text)
  if (bad) { report.nonSrd.push(`${srdName} (${bad})`); return }
  if (!text || !sec.th) { report.missing.push(srdName); return }
  out[id] = { name: stripNonSrdNames(sec.th).replace(/[.:]$/, '').trim().slice(0, 100), text }
  report.matched++
  for (const t of findTypos(`${sec.th}\n${text}`)) report.typos.push(`${srdName}: ${t}`)
}

/** Class and subclass features, matched by class, subclass and English name (the level breaks ties). */
export function buildClassFeaturesTh(
  pages: { className: string; md: string }[],
  srd: { id: string; name: string; className: string; subclass?: string; level: number }[],
): { features: Record<string, FeatureTh>; report: MarkdownThReport } {
  const sections = new Map(pages.map((p) => [p.className, classSections(p.md)]))
  const features: Record<string, FeatureTh> = {}
  const report: MarkdownThReport = { matched: 0, missing: [], nonSrd: [], typos: [] }
  for (const f of srd) {
    const found = (sections.get(f.className) ?? [])
      .filter((s) => key(s.en) === key(f.name) && key(s.subclass ?? '') === key(f.subclass ?? ''))
    const sec = found.find((s) => s.level === f.level) ?? found[0]
    const label = `${f.subclass ?? f.className} ${f.level}: ${f.name}`
    if (!sec) { report.missing.push(label); continue }
    finish(label, sec, report, features, f.id)
  }
  return { features, report }
}

/**
 * Species traits, matched by species and English name. "Darkvision (120 ft.)" takes the page whose text has
 * "120"; a variant like "Breath Weapon: Acid" gets its trait's text ("Breath Weapon") only when the SRD list
 * has no separate base entry (Giant Ancestry has one, so its variants stay English).
 */
export function buildTraitsTh(
  pages: { species: string; md: string }[],
  srd: { id: string; name: string; species: string[] }[],
): { features: Record<string, FeatureTh>; report: MarkdownThReport } {
  const sections = new Map(pages.map((p) => [p.species, traitSections(p.md)]))
  const bases = new Set(srd.map((t) => key(t.name)))
  const features: Record<string, FeatureTh> = {}
  const report: MarkdownThReport = { matched: 0, missing: [], nonSrd: [], typos: [] }
  for (const t of srd) {
    const plain = t.name.replace(/\s*\([^)]*\)\s*$/, '')
    const number = t.name.match(/\((\d+)/)?.[1]
    const [base] = plain.split(':')
    const names = [plain, ...(plain.includes(':') && !bases.has(key(base)) ? [base] : [])].map(key)
    let sec: Section | undefined
    for (const name of names) {
      for (const sp of t.species) {
        sec ??= (sections.get(sp) ?? []).find((s) => key(s.en) === name && (!number || s.text.includes(number)))
      }
    }
    if (!sec) { report.missing.push(`${t.species[0]}: ${t.name}`); continue }
    finish(`${t.species[0]}: ${t.name}`, sec, report, features, t.id)
  }
  return { features, report }
}
