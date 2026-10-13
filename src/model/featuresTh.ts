// Thai feature text: DND-TH's translation (https://dnd-th.com/, used with their permission, 2026-10-13) of SRD
// 5.2.1 features, kept apart from the English text in src/data/srd-features-th.json and keyed by the same ids as
// src/data/srd-features.json. Feats come first; class features and species traits can join the same file later.
// The file is built by scripts/srd/features-th.ts from DND-TH's published feats.json using buildFeatsTh() below.
// Nothing here is imported at runtime except dndTh.ts, so Node can run the build script.
import { cleanMarkdown, findTypos } from './dndTh.ts'

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
    const text = [row.description, ...row.benefits].map((p) => cleanMarkdown(p.slice(0, 5000))).filter(Boolean).join('\n\n')
    features[f.id] = { name: row.name_th.trim().slice(0, 100), text }
    report.matched++
    for (const t of findTypos(`${row.name_th}\n${text}`)) report.typos.push(`${f.name}: ${t}`)
  }
  return { features, report }
}
