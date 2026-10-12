// The SRD 5.2.1 feature texts (src/data/srd-features.json, built by scripts/srd/features.mjs): which ones a
// character has, and looking one up by id.
import type { Character } from './character'

export interface SrdFeatureTexts {
  classFeatures: { id: string; name: string; className: string; subclass?: string; level: number; text: string }[]
  traits: { id: string; name: string; species: string[]; text: string }[]
  feats: { id: string; name: string; type: string; repeatable: boolean; text: string }[]
}

export async function loadFeatureTexts(): Promise<SrdFeatureTexts> {
  const mod = await import('../data/srd-features.json')
  return mod.default as SrdFeatureTexts
}

export function findFeatureText(data: SrdFeatureTexts | null, id: string): string | null {
  if (!data) return null
  return [...data.classFeatures, ...data.traits, ...data.feats].find((f) => f.id === id)?.text ?? null
}

export interface FeatureEntry { id: string; name: string; tag: string; text: string }

/**
 * What this character has: class features up to their level (and their subclass's), species traits, feats.
 * Variant traits ("Breath Weapon: Fire", "Gnomish Lineage: Rock Gnome") only when the sheet names the variant.
 */
export function characterFeatureEntries(
  c: Pick<Character, 'className' | 'subclass' | 'level' | 'species' | 'feats' | 'monster'>,
  data: SrdFeatureTexts,
): FeatureEntry[] {
  if (c.monster) return []
  const sub = c.subclass.trim().toLowerCase()
  const species = c.species.toLowerCase()
  const cls = data.classFeatures
    .filter((f) => f.className === c.className && f.level <= c.level && (!f.subclass || f.subclass.toLowerCase() === sub))
    .map((f) => ({ id: f.id, name: f.name, tag: `${f.subclass ?? f.className} ${f.level}`, text: f.text }))
  const traits = data.traits
    .filter((t) => t.species.some((s) => species.startsWith(s.toLowerCase())))
    .filter((t) => !t.name.includes(':') || species.includes(t.name.split(':')[1].trim().toLowerCase()))
    .map((t) => ({ id: t.id, name: t.name, tag: t.species[0], text: t.text }))
  const feats = data.feats.filter((f) => c.feats.includes(f.name)).map((f) => ({ id: f.id, name: f.name, tag: `${f.type} Feat`, text: f.text }))
  return [...cls, ...traits, ...feats]
}
