// SRD 5.2.1 spells for the lookup (data: src/data/srd-spells.json, built by scripts/srd/spells.mjs).
export interface SrdSpell {
  id: string
  name: string
  /** 0 = cantrip */
  level: number
  school: string
  classes: string[]
  castingTime: string
  ritual: boolean
  range: string
  components: ('V' | 'S' | 'M')[]
  material?: string
  duration: string
  concentration: boolean
  text: string
  /** "Using a Higher-Level Spell Slot" / cantrip upgrade text, when the source keeps it apart. */
  higher?: string
}

/** Loaded only when the spell lookup opens (about 330 KB). */
export async function loadSrdSpells(): Promise<SrdSpell[]> {
  const mod = await import('../data/srd-spells.json')
  return mod.default as SrdSpell[]
}

export interface SpellFilter {
  query: string
  /** null = any level */
  level: number | null
  /** e.g. "Wizard"; null = any class */
  className: string | null
}

/** Search by name, school or text words; by level and class. Lower level first, then by name. */
export function searchSpells(list: SrdSpell[], f: SpellFilter): SrdSpell[] {
  const words = f.query.toLowerCase().split(/\s+/).filter(Boolean)
  return list
    .filter((s) => (f.level === null || s.level === f.level) && (!f.className || s.classes.includes(f.className)))
    .filter((s) => {
      const name = s.name.toLowerCase()
      return words.every((w) => name.includes(w) || s.school.toLowerCase() === w)
    })
    .sort((a, b) => a.level - b.level || a.name.localeCompare(b.name))
}

/** "Level 3 Evocation" or "Evocation Cantrip", as the 2024 books write it. */
export function spellLevelLine(s: Pick<SrdSpell, 'level' | 'school'>): string {
  return s.level === 0 ? `${s.school} Cantrip` : `Level ${s.level} ${s.school}`
}

/** "V, S, M (a ball of bat guano and sulfur)" */
export function componentsLine(s: Pick<SrdSpell, 'components' | 'material'>): string {
  return s.components.map((c) => (c === 'M' && s.material ? `M (${s.material})` : c)).join(', ')
}

/** "Action or Ritual", "1 minute"… (Ritual spells can also be cast as a ritual, taking 10 minutes longer.) */
export function castingTimeLine(s: Pick<SrdSpell, 'castingTime' | 'ritual'>): string {
  return s.ritual ? `${s.castingTime} or Ritual` : s.castingTime
}

/** Find a spell by the name written on a character sheet (case and spacing don't matter). */
export function findSpellByName(list: SrdSpell[], name: string): SrdSpell | undefined {
  const n = name.trim().toLowerCase().replace(/\s+/g, ' ')
  return list.find((s) => s.name.toLowerCase() === n)
}
