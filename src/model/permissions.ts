// Who may change what during play (pure checks; src/db/play.ts applies them).
// - Players in a live room may spend (Action, slots, feature uses) but never give anything back to
//   themselves, start a new turn or rest: the DM does those.
// - The DM (or any device outside a room) may give a use back only in the same round of the fight it
//   was spent in, to fix a mistake; outside a fight, any time.
import type { Character } from './character'
import type { CharacterAction } from './characterActions'

const TURN_KINDS = ['action', 'bonusAction', 'reaction'] as const

/** What an action gives back, as keys like 'turn:action', 'slot:0' or 'feature:<id>' (none = not a give-back). */
export function refundKeys(c: Character, a: CharacterAction): string[] {
  switch (a.type) {
    case 'setActionUsed':
      return !a.used && c.turn[a.kind] ? [`turn:${a.kind}`] : []
    case 'resetTurn':
      return TURN_KINDS.filter((k) => c.turn[k]).map((k) => `turn:${k}`)
    case 'setSlotUsed':
      return a.used < (c.spellSlots[a.level]?.used ?? 0) ? [`slot:${a.level}`] : []
    case 'setSlotsFromTable':
      return c.spellSlots.flatMap((s, i) => (s.used > 0 ? [`slot:${i}`] : []))
    case 'setFeatureUsed': {
      const f = c.features.find((x) => x.id === a.featureId)
      return f && a.used < f.used ? [`feature:${f.id}`] : []
    }
    default:
      return []
  }
}

/** What an action spends, with the same keys. */
export function useKeys(c: Character, a: CharacterAction): string[] {
  switch (a.type) {
    case 'setActionUsed':
      return a.used && !c.turn[a.kind] ? [`turn:${a.kind}`] : []
    case 'setSlotUsed':
      return a.used > (c.spellSlots[a.level]?.used ?? 0) ? [`slot:${a.level}`] : []
    case 'setFeatureUsed': {
      const f = c.features.find((x) => x.id === a.featureId)
      return f && a.used > f.used ? [`feature:${f.id}`] : []
    }
    default:
      return []
  }
}

export type Permission = { ok: true } | { ok: false; reason: string }

/** Only the DM starts these for a player in a room: rests bring back slots and features, a new turn brings back actions. */
const DM_ONLY: CharacterAction['type'][] = ['shortRest', 'longRest', 'resetTurn']

/** May a player in a live room do this to their own character? Spending yes, giving back no. */
export function playerMay(c: Character, a: CharacterAction): Permission {
  if (DM_ONLY.includes(a.type)) return { ok: false, reason: 'พักสั้น/พักยาว และเริ่มเทิร์นใหม่: DM เป็นคนกดให้' }
  if (refundKeys(c, a).length > 0) return { ok: false, reason: 'คืนแต้มเองไม่ได้: ขอให้ DM คืนให้ (คืนได้เฉพาะในรอบเดียวกับที่ใช้)' }
  return { ok: true }
}

/** When each use was spent: `${characterId}|${key}` → the fight and its round at that moment. */
export type UseRounds = Record<string, { encounterId: string; round: number }>

/** The running fight a character is in, or null. */
export type FightRound = { id: string; round: number } | null

/** DM (or a device outside a room): a give-back is allowed outside fights, or in the round the use was spent. */
export function refundAllowed(characterId: string, keys: string[], uses: UseRounds, fight: FightRound): Permission {
  if (keys.length === 0 || !fight) return { ok: true }
  const sameRound = keys.every((k) => {
    const u = uses[`${characterId}|${k}`]
    return u?.encounterId === fight.id && u.round === fight.round
  })
  return sameRound ? { ok: true } : { ok: false, reason: `คืนได้เฉพาะในรอบเดียวกับที่ใช้ (ตอนนี้รอบที่ ${fight.round}) · นอกการต่อสู้คืนได้ตลอด` }
}

/** Remember the round of new uses. Only uses in the given fight are kept (older fights don't matter any more). */
export function recordUses(uses: UseRounds, characterId: string, keys: string[], fight: FightRound): UseRounds {
  if (!fight || keys.length === 0) return uses
  const kept = Object.fromEntries(Object.entries(uses).filter(([, u]) => u.encounterId === fight.id))
  for (const k of keys) kept[`${characterId}|${k}`] = { encounterId: fight.id, round: fight.round }
  return kept
}
