// Turns the free text of a stat block action into small pieces the Turn Card can show as buttons
// (to-hit, damage dice, save DC, Recharge, Legendary uses). Pure functions: no screens, no database.
// Anything that doesn't match comes back as `{ kind: 'text' }` so the card shows the raw sentence
// instead of hiding an action (the DM must never lose an action because parsing failed).
import type { StatBlockEntry } from './monsterDetails'

export interface DamagePart {
  /** Dice as the roller wants them, no spaces: "1d6+2". */
  dice: string
  /** The average printed in the book, e.g. 5. */
  average: number
  type: string
}

export type ParsedAction =
  | {
      kind: 'attack'
      name: string
      /** "Melee", "Ranged" or "Melee or Ranged". */
      range: string
      toHit: number
      /** "reach 5 ft." or "range 80/320 ft." */
      reach: string
      /** The first damage part (null if none). */
      damage: DamagePart | null
      /** Every damage part in order: the Hit damage and riders like "plus 5 (2d4) Fire damage". */
      damages: DamagePart[]
      /** Everything after the first damage: "plus 2 (1d4) Slashing damage if…", riders, conditions. */
      extra: string
    }
  | {
      kind: 'save'
      name: string
      ability: string
      dc: number
      /** Who it hits: "each creature in a 60-foot Cone". */
      target: string
      damage: DamagePart | null
      damages: DamagePart[]
      /** What a successful save does after the damage: "Half damage" (empty if not stated). */
      onSuccess: string
    }
  | { kind: 'text'; name: string; text: string }

const ABILITY_SHORT: Record<string, string> = {
  Strength: 'STR', Dexterity: 'DEX', Constitution: 'CON', Intelligence: 'INT', Wisdom: 'WIS', Charisma: 'CHA',
}

const MINUS = /[−–]/g
/** "5 (1d6 + 2) Slashing damage" and also flat "1 Piercing damage" (dice = the number). Unicode minus is read as "-". */
const DAMAGE = /(\d+)(?: \((\d+d\d+(?: [+\-−–] \d+)?)\))? ([A-Za-z]+) damage/g

function damageParts(text: string): { parts: DamagePart[]; firstEnd: number } {
  const parts: DamagePart[] = []
  let firstEnd = 0
  for (const m of text.matchAll(DAMAGE)) {
    if (parts.length === 0) firstEnd = (m.index ?? 0) + m[0].length
    parts.push({ dice: (m[2] ?? m[1]).replace(MINUS, '-').replace(/ /g, ''), average: Number(m[1]), type: m[3] })
  }
  return { parts, firstEnd }
}

/** Read one action's text. `usage` ("Recharge 5–6") is kept on the entry, not here. */
export function parseAction(entry: Pick<StatBlockEntry, 'name' | 'text'>): ParsedAction {
  const text = entry.text.trim()
  const raw: ParsedAction = { kind: 'text', name: entry.name, text }

  // "Melee Attack Roll: +4, reach 5 ft. Hit: 5 (1d6 + 2) Slashing damage, plus …"
  // The bonus may be followed by " to hit" or a note: "+5 (with Advantage if the target is Grappled), reach 5 ft."
  const atk = /^(Melee or Ranged|Melee|Ranged) Attack Roll: ([+\-−–]\d+)(?: to hit)?(?: \(([^)]*)\))?, (.+?) Hit: (.*)$/s.exec(text)
  if (atk) {
    const hit = atk[5]
    const { parts, firstEnd } = damageParts(hit)
    return {
      kind: 'attack', name: entry.name, range: atk[1], toHit: Number(atk[2].replace(MINUS, '-')),
      reach: atk[3] ? `${atk[4]} (${atk[3]})` : atk[4],
      damage: parts[0] ?? null, damages: parts,
      extra: (parts.length ? hit.slice(firstEnd) : hit).replace(/^[\s,.]+/, '').trim(),
    }
  }

  // "Dexterity Saving Throw: DC 21, each creature in a 60-foot Cone. Failure: 59 (17d6) Fire damage. Success: Half damage."
  const save = /^(Strength|Dexterity|Constitution|Intelligence|Wisdom|Charisma) Saving Throw: DC (\d+), (.+?)\. Failure: (.*)$/s.exec(text)
  if (save) {
    const fail = save[4]
    const { parts } = damageParts(fail)
    const success = /Success: ([^.]*)\./.exec(fail)
    return {
      kind: 'save', name: entry.name, ability: save[1], dc: Number(save[2]), target: save[3],
      damage: parts[0] ?? null, damages: parts, onSuccess: success ? success[1].trim() : '',
    }
  }
  return raw
}

/** A Spellcasting entry's numbers: "(spell save DC 20, +12 to hit with spell attacks)". Missing ones are null. */
export function parseSpellcasting(text: string): { dc: number | null; attack: number | null } {
  const dc = /spell save DC (\d+)/i.exec(text)?.[1]
  const atk = /([+\-−–]\d+) to hit with spell attacks/i.exec(text)?.[1]
  return { dc: dc ? Number(dc) : null, attack: atk ? Number(atk.replace(MINUS, '-')) : null }
}

/** "STR", "DEX"… for a save's ability name (falls back to the name). */
export const abilityShort = (ability: string): string => ABILITY_SHORT[ability] ?? ability

/** Recharge entries ("Recharge 5–6", "Recharge 6") → the lowest d6 that recharges it; otherwise null. */
export function rechargeMin(usage: string | undefined): number | null {
  const m = /^Recharge (\d)/.exec(usage ?? '')
  const n = m ? Number(m[1]) : 0
  return n >= 2 && n <= 6 ? n : null
}

/** Did this d6 recharge it? */
export const rechargeReady = (d6: number, min: number): boolean => d6 >= min

/** "3 (4 in Lair)" → 3. Missing or odd text → 0 (no counter). */
export function legendaryUsesMax(text: string | null | undefined): number {
  const n = Number(/^(\d+)/.exec(text ?? '')?.[1] ?? 0)
  return n >= 1 && n <= 9 ? n : 0
}

/** How many Legendary uses one action costs: "Costs 2 Actions" (older stat blocks); default 1. */
export function legendaryCost(text: string): number {
  const n = Number(/Costs (\d) Actions?/i.exec(text)?.[1] ?? 1)
  return n >= 1 && n <= 3 ? n : 1
}

/** The first sentence of a rules text, to fit one line (the full text opens on tap). */
export function firstSentence(text: string): string {
  const m = /^.*?[.!?](?=\s|$)/s.exec(text.trim())
  return m ? m[0] : text.trim()
}
