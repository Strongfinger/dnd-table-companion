// The party overview on players' phones in a live room ('party' message from the DM's device).
// Each phone keeps only its own character, so the DM sends a small read-only card for every
// character played in the room: who they are, AC, HP, conditions and this turn's actions. Nothing
// else of other players' sheets (no slots, features, abilities or notes).
import type { Character } from '../model/character'
import { isConditionName } from '../model/encounter'
import { classLabel } from '../model/monsterCharacter'
import type { ActionEconomy, Condition } from '../rules'

export interface PartyCard {
  characterId: string
  name: string
  /** "Rogue 3", or "Monster · CR 1/4" (see classLabel). */
  className: string
  level: number
  ac: number
  hp: { current: number; max: number; temp: number }
  conditions: Condition[]
  turn: ActionEconomy
}

/** At most this many cards (a table of friends; keeps the message small). */
export const MAX_PARTY = 12

export function partyCard(c: Character): PartyCard {
  return {
    characterId: c.id,
    name: c.name,
    className: classLabel(c),
    level: c.level,
    ac: c.ac,
    hp: { current: c.hp.current, max: c.hp.max, temp: c.hp.temp },
    conditions: [...c.conditions],
    turn: { action: c.turn.action, bonusAction: c.turn.bonusAction, reaction: c.turn.reaction },
  }
}

/** The cards in a stable order (by name), so an unchanged party gives the same message. */
export function partyCards(characters: Character[]): PartyCard[] {
  return characters.map(partyCard).sort((a, b) => a.name.localeCompare(b.name) || a.characterId.localeCompare(b.characterId)).slice(0, MAX_PARTY)
}

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v)
const text = (v: unknown, max: number) => (typeof v === 'string' ? v.slice(0, max) : null)
const whole = (v: unknown, min: number, max: number) => (Number.isInteger(v) && (v as number) >= min && (v as number) <= max ? (v as number) : null)

/** Check a 'party' message from the DM's device (network data: never trust its shape). Null = invalid. */
export function parseParty(body: unknown): PartyCard[] | null {
  const list = isObj(body) ? body.cards : null
  if (!Array.isArray(list) || list.length > MAX_PARTY) return null
  const cards: PartyCard[] = []
  for (const v of list) {
    if (!isObj(v) || !isObj(v.hp) || !isObj(v.turn)) return null
    const characterId = text(v.characterId, 64)
    const name = text(v.name, 100)
    const level = whole(v.level, 1, 20)
    const ac = whole(v.ac, 0, 50)
    const current = whole(v.hp.current, 0, 9999)
    const max = whole(v.hp.max, 0, 9999)
    if (!characterId || name === null || level === null || ac === null || current === null || max === null) return null
    cards.push({
      characterId,
      name,
      className: text(v.className, 40) ?? '',
      level,
      ac,
      hp: { current, max, temp: whole(v.hp.temp, 0, 9999) ?? 0 },
      conditions: Array.isArray(v.conditions) ? v.conditions.filter((x): x is Condition => typeof x === 'string' && isConditionName(x)) : [],
      turn: { action: v.turn.action === true, bonusAction: v.turn.bonusAction === true, reaction: v.turn.reaction === true },
    })
  }
  return cards
}
