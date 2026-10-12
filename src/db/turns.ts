// Fight changes used from more than one place, so they always work the same:
// - next turn: the tracker's "ถัดไป" button, and a player ending their own turn from their phone
// - adding monsters: the tracker, and the SRD lookup's "add to fight"
import { isDead } from '../model/actions'
import { withDefaults } from '../model/character'
import { conditionsToClear, createMonsters, isConditionName, type MonsterInput } from '../model/encounter'
import { characterFromCombatant, characterFromMonster } from '../model/monsterCharacter'
import { findMonsterForCombatant, loadFullMonsters } from '../model/monsterDetails'
import { isTurnEventForPlayers } from '../model/playerView'
import { nextTurn, sortByInitiative, startOfTurn } from '../rules'
import { saveCharacter } from './characters'
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

/** Add `count` copies of a monster to a fight (numbered "Goblin 1", "Goblin 2"…), logged like the tracker does. */
export async function addMonstersToFight(encounterId: string, input: MonsterInput, count: number): Promise<string[]> {
  const added = await updateEncounter(encounterId, (x) => {
    const list = createMonsters(input, count, x.combatants)
    return { encounter: { ...x, combatants: sortByInitiative([...x.combatants, ...list]) }, result: { list, round: x.round } }
  })
  if (!added) return []
  for (const c of added.list) await addLog('', `➕ ${c.name} เข้าร่วมการต่อสู้`, { encounterId, round: added.round }, true)
  return added.list.map((c) => c.name)
}

/**
 * A monster/NPC in a fight becomes a character (saved on this device), so the DM can hand it to a
 * player or export it. Its fight row stays where it is (same initiative, same effects) but is now
 * linked to the new sheet like any player character. SRD monsters keep their full stat block.
 * Returns the new character's id, or null if it was already a character.
 */
export async function makeCharacterFromCombatant(encounterId: string, combatantId: string): Promise<string | null> {
  const e = await getEncounter(encounterId)
  const c = e?.combatants.find((x) => x.id === combatantId)
  if (!e || !c || c.kind === 'pc') return null
  const statBlock = findMonsterForCombatant(await loadFullMonsters(), c.name)
  const base = statBlock ? characterFromMonster(statBlock, { name: c.name, hp: c.hp }) : characterFromCombatant(c)
  const character = await saveCharacter({
    ...base,
    campaignId: e.campaignId,
    // Conditions from the fight go on the sheet too (like a player character's).
    conditions: [...new Set(c.effects.map((ef) => ef.name).filter(isConditionName))],
    turn: { ...(c.turn ?? base.turn) },
  })
  const done = await updateEncounter(encounterId, (x) => ({
    encounter: { ...x, combatants: x.combatants.map((m) => (m.id === combatantId && m.kind !== 'pc' ? { ...m, kind: 'pc' as const, characterId: character.id } : m)) },
    result: x.round,
  }))
  if (done === undefined) return null
  await addLog('', `🧑 ${c.name} เป็นตัวละครแล้ว (ส่งออกไฟล์ หรือให้ผู้เล่นควบคุมได้)`, { encounterId, round: done }, false)
  return character.id
}
