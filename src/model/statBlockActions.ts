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
      damage: DamagePart | null
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
      /** What a successful save does after the damage: "Half damage" (empty if not stated). */
      onSuccess: string
    }
  | { kind: 'text'; name: string; text: string }

const ABILITY_SHORT: Record<string, string> = {
  Strength: 'STR', Dexterity: 'DEX', Constitution: 'CON', Intelligence: 'INT', Wisdom: 'WIS', Charisma: 'CHA',
}

/** "5 (1d6 + 2) Slashing damage" → { dice: '1d6+2', average: 5, type: 'Slashing' }. */
function damageAt(text: string): { part: DamagePart; end: number } | null {
  const m = /(\d+) \((\d+d\d+(?: [+-] \d+)?)\) ([A-Za-z]+) damage/.exec(text)
  if (!m) return null
  return { part: { dice: m[2].replace(/ /g, ''), average: Number(m[1]), type: m[3] }, end: m.index + m[0].length }
}

/** Read one action's text. `usage` ("Recharge 5–6") is kept on the entry, not here. */
export function parseAction(entry: Pick<StatBlockEntry, 'name' | 'text'>): ParsedAction {
  const text = entry.text.trim()
  const raw: ParsedAction = { kind: 'text', name: entry.name, text }

  // "Melee Attack Roll: +4, reach 5 ft. Hit: 5 (1d6 + 2) Slashing damage, plus …"
  const atk = /^(Melee or Ranged|Melee|Ranged) Attack Roll: ([+-]\d+), (.+?) Hit: (.*)$/s.exec(text)
  if (atk) {
    const hit = atk[4]
    const dmg = damageAt(hit)
    return {
      kind: 'attack', name: entry.name, range: atk[1], toHit: Number(atk[2]), reach: atk[3],
      damage: dmg ? dmg.part : null,
      extra: (dmg ? hit.slice(dmg.end) : hit).replace(/^[\s,.]+/, '').trim(),
    }
  }

  // "Dexterity Saving Throw: DC 21, each creature in a 60-foot Cone. Failure: 59 (17d6) Fire damage. Success: Half damage."
  const save = /^(Strength|Dexterity|Constitution|Intelligence|Wisdom|Charisma) Saving Throw: DC (\d+), (.+?)\. Failure: (.*)$/s.exec(text)
  if (save) {
    const fail = save[4]
    const dmg = damageAt(fail)
    const success = /Success: ([^.]*)\./.exec(fail)
    return {
      kind: 'save', name: entry.name, ability: save[1], dc: Number(save[2]), target: save[3],
      damage: dmg ? dmg.part : null, onSuccess: success ? success[1].trim() : '',
    }
  }
  return raw
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
