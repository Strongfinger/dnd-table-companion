// A character's spell list (cantrips and spells they know or have prepared). Each entry is a name and
// level; SRD spells are matched by name to show their card (homebrew spells are just names).
import { newId, type Character } from './character'

export type CharacterSpell = Character['spells'][number]

const sameName = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase()

/**
 * Add a spell (no duplicates by name). Cantrips are always ready, so they count as prepared.
 * Returns null if the character already has it or the name is empty.
 */
export function addSpell(c: Character, spell: { name: string; level: number }): Character | null {
  const name = spell.name.trim().slice(0, 100)
  const level = Math.min(9, Math.max(0, Math.floor(spell.level)))
  if (!name || c.spells.some((s) => sameName(s.name, name))) return null
  const spells = [...c.spells, { id: newId(), name, level, prepared: level === 0 }]
  return { ...c, spells: sortSpells(spells) }
}

export function removeSpell(c: Character, id: string): Character {
  return { ...c, spells: c.spells.filter((s) => s.id !== id) }
}

/** Prepare / unprepare a leveled spell (cantrips stay prepared). */
export function setPrepared(c: Character, id: string, prepared: boolean): Character {
  return { ...c, spells: c.spells.map((s) => (s.id === id && s.level > 0 ? { ...s, prepared } : s)) }
}

/** Cantrips first, then by level, then by name. */
export function sortSpells(list: CharacterSpell[]): CharacterSpell[] {
  return [...list].sort((a, b) => a.level - b.level || a.name.localeCompare(b.name))
}

/** Groups for the sheet: [level, spells] with cantrips (0) first; empty levels left out. */
export function spellsByLevel(list: CharacterSpell[]): [number, CharacterSpell[]][] {
  const groups = new Map<number, CharacterSpell[]>()
  for (const s of sortSpells(list)) groups.set(s.level, [...(groups.get(s.level) ?? []), s])
  return [...groups.entries()]
}

/** The highest spell level the character has slots for (0 = cantrips only / no slots). */
export function highestSlotLevel(c: Pick<Character, 'spellSlots'>): number {
  let best = 0
  c.spellSlots.forEach((s, i) => {
    if (s.max > 0) best = i + 1
  })
  return best
}

/** "Cantrips: 3 · Prepared: 4 of 6" style counts for the section header. */
export function spellCounts(list: CharacterSpell[]): { cantrips: number; leveled: number; prepared: number } {
  const leveled = list.filter((s) => s.level > 0)
  return { cantrips: list.length - leveled.length, leveled: leveled.length, prepared: leveled.filter((s) => s.prepared).length }
}
