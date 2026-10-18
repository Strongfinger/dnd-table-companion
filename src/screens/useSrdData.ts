// The SRD data for the lookup and the DM panel, loaded on first use (the files are large).
import { useEffect, useState } from 'react'
import { loadFullMonsters, type FullMonster } from '../model/monsterDetails'
import type { LootItem } from '../model/generators'
import { loadSrdSpells, type SrdSpell } from '../model/spells'
import type { SpellsThFile, SpellTh } from '../model/spellsTh'
import type { FeaturesThFile, FeatureTh } from '../model/featuresTh'
import type { MagicItemsThFile, MagicItemTh } from '../model/magicItemsTh'
import type { EquipmentThFile } from '../model/equipmentTh'
import type { MonstersThFile, MonsterTh } from '../model/monstersTh'
import { loadSrdEquipment, type SrdEquipment } from '../model/equipment'
import { loadFeatureTexts, type SrdFeatureTexts } from '../model/featureTexts'

// The Thai spell file is optional: until it's built (scripts/srd/spells-th.ts) this finds nothing and
// spells stay English. (A glob, unlike a plain import, doesn't fail the build when the file is missing.)
const thaiSpellFile = import.meta.glob<SpellsThFile>('../data/srd-spells-th.json', { import: 'default' })
const thaiFeatureFile = import.meta.glob<FeaturesThFile>('../data/srd-features-th.json', { import: 'default' })
const thaiItemFile = import.meta.glob<MagicItemsThFile>('../data/srd-magic-items-th.json', { import: 'default' })
const thaiEquipmentFile = import.meta.glob<EquipmentThFile>('../data/srd-equipment-th.json', { import: 'default' })
const thaiMonsterFile = import.meta.glob<MonstersThFile>('../data/srd-monsters-th.json', { import: 'default' })

/** Thai spell text by spell id, or {} when there is none. */
export function useSpellsTh(): Record<string, SpellTh> {
  const [map, setMap] = useState<Record<string, SpellTh>>({})
  useEffect(() => {
    const load = Object.values(thaiSpellFile)[0]
    load?.().then((f) => setMap(f.spells ?? {}))
  }, [])
  return map
}

/** Thai feature text (feats, class features, species traits) by SRD feature id, or {} when there is none. */
export function useFeaturesTh(): Record<string, FeatureTh> {
  const [map, setMap] = useState<Record<string, FeatureTh>>({})
  useEffect(() => {
    const load = Object.values(thaiFeatureFile)[0]
    load?.().then((f) => setMap(f.features ?? {}))
  }, [])
  return map
}

/** Thai magic item text by SRD item id, or {} when there is none. */
export function useMagicItemsTh(): Record<string, MagicItemTh> {
  const [map, setMap] = useState<Record<string, MagicItemTh>>({})
  useEffect(() => {
    const load = Object.values(thaiItemFile)[0]
    load?.().then((f) => setMap(f.items ?? {}))
  }, [])
  return map
}

const NO_EQUIPMENT_TH: Pick<EquipmentThFile, 'items' | 'properties' | 'masteries'> = { items: {}, properties: {}, masteries: {} }
/** Thai equipment names/text by item id, and weapon property/mastery text by English name (empty when none). */
export function useEquipmentTh(): Pick<EquipmentThFile, 'items' | 'properties' | 'masteries'> {
  const [data, setData] = useState(NO_EQUIPMENT_TH)
  useEffect(() => {
    const load = Object.values(thaiEquipmentFile)[0]
    load?.().then((f) => setData({ items: f.items ?? {}, properties: f.properties ?? {}, masteries: f.masteries ?? {} }))
  }, [])
  return data
}

/** Thai monster names and stat block text by SRD monster id, or {} when there is none. */
export function useMonstersTh(): Record<string, MonsterTh> {
  const [map, setMap] = useState<Record<string, MonsterTh>>({})
  useEffect(() => {
    const load = Object.values(thaiMonsterFile)[0]
    load?.().then((f) => setMap(f.monsters ?? {}))
  }, [])
  return map
}

export function useMonsters(): FullMonster[] | null {
  const [list, setList] = useState<FullMonster[] | null>(null)
  useEffect(() => {
    loadFullMonsters().then(setList)
  }, [])
  return list
}

export function useSpells(): SrdSpell[] | null {
  const [list, setList] = useState<SrdSpell[] | null>(null)
  useEffect(() => {
    loadSrdSpells().then(setList)
  }, [])
  return list
}

/** SRD 5.2.1 magic items (for the loot generator). */
export function useMagicItems(): LootItem[] | null {
  const [list, setList] = useState<LootItem[] | null>(null)
  useEffect(() => {
    import('../data/srd-magic-items.json').then((m) => setList(m.default as LootItem[]))
  }, [])
  return list
}

/** SRD 5.2.1 equipment (weapons, armor, gear) for the sheet's attacks and inventory. */
export function useEquipment(): SrdEquipment | null {
  const [data, setData] = useState<SrdEquipment | null>(null)
  useEffect(() => {
    loadSrdEquipment().then(setData)
  }, [])
  return data
}

/** SRD feature texts (about 145 KB) for feature cards and the feature list. */
export function useFeatureTexts(): SrdFeatureTexts | null {
  const [data, setData] = useState<SrdFeatureTexts | null>(null)
  useEffect(() => {
    loadFeatureTexts().then(setData)
  }, [])
  return data
}
