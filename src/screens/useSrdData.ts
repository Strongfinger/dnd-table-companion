// The SRD data for the lookup and the DM panel, loaded on first use (the files are large).
import { useEffect, useState } from 'react'
import { loadFullMonsters, type FullMonster } from '../model/monsterDetails'
import { loadSrdSpells, type SrdSpell } from '../model/spells'

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
