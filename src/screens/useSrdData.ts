// The SRD data for the lookup and the DM panel, loaded on first use (the files are large).
import { useEffect, useState } from 'react'
import { loadFullMonsters, type FullMonster } from '../model/monsterDetails'
import type { LootItem } from '../model/generators'
import { loadSrdSpells, type SrdSpell } from '../model/spells'
import { loadSrdEquipment, type SrdEquipment } from '../model/equipment'

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
