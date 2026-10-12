// Moving a fight to the next turn: used by the tracker's "ถัดไป" button and by a player ending their
// own turn from their phone in a live room (the DM's device runs it), so both do exactly the same.
import { isDead } from '../model/actions'
import { withDefaults } from '../model/character'
import { conditionsToClear } from '../model/encounter'
import { isTurnEventForPlayers } from '../model/playerView'
import { nextTurn, startOfTurn } from '../rules'
import { db } from './db'
import { getEncounter, updateEncounter } from './encounters'
import { addLog } from './log'
import { playAction } from './play'

/**
 * Next turn. With `expect`, only if it's still that combatant's turn in that round (so a late or
 * repeated "end my turn" can't skip someone else's turn). Returns false if nothing moved.
 */
export async function advanceTurn(encounterId: string, expect?: { activeId: string; round: number }): Promise<boolean> {
  const e = await getEncounter(encounterId)
  if (!e || e.status !== 'active') return false
  // Dead PCs (3 failed death saves on their sheet) are marked defeated so turns skip them.
  const ids = e.combatants.flatMap((c) => (c.kind === 'pc' && c.characterId ? [c.characterId] : []))
  const dead = new Set((await db.characters.where('id').anyOf(ids).toArray()).map(withDefaults).filter(isDead).map((c) => c.id))

  const r = await updateEncounter(encounterId, (x) => {
    if (x.status !== 'active' || (expect && (x.activeId !== expect.activeId || x.round !== expect.round))) return { encounter: x, result: null }
    const before = x.combatants.map((c) => (c.kind === 'pc' && c.characterId ? { ...c, defeated: dead.has(c.characterId) } : c))
    const t = nextTurn(before, { round: x.round, activeId: x.activeId })
    // A monster's Action / Bonus Action / Reaction come back at the start of its turn.
    const combatants = t.combatants.map((c) => (c.id === t.state.activeId && c.kind === 'monster' ? { ...c, turn: startOfTurn() } : c))
    return { encounter: { ...x, combatants, round: t.state.round, activeId: t.state.activeId }, result: { t, before } }
  })
  if (!r) return false

  // A PC's turn starts: their Action, Bonus Action and Reaction come back (on the sheet).
  const who = r.t.combatants.find((c) => c.id === r.t.state.activeId)
  if (who?.kind === 'pc' && who.characterId) await playAction(who.characterId, { type: 'resetTurn' }, 'system')
  // PC conditions live on the sheet too: when a timed condition runs out, take it off the sheet.
  for (const b of r.before) {
    if (b.kind !== 'pc' || !b.characterId) continue
    const after = r.t.combatants.find((x) => x.id === b.id)?.effects ?? []
    const clear = conditionsToClear(b.effects.filter((ef) => !after.some((x) => x.id === ef.id)), after)
    for (const condition of clear) await playAction(b.characterId, { type: 'setCondition', condition, on: false }, 'system')
  }
  const round = r.t.state.round
  for (const ev of r.t.events) await addLog('', ev.text, { encounterId, round }, isTurnEventForPlayers(ev, r.t.combatants))
  return true
}
