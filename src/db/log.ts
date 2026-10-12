// Play log: what happened to a character, newest first, so the table can look back after a fight.
import { newId } from '../model/character'
import { withEncounterDefaults } from '../model/encounter'
import { liveFight } from '../model/playerView'
import { db, type LogEntry } from './db'

// Several entries can be written in the same millisecond (e.g. rolling for all monsters);
// a strictly increasing time keeps them in the order they happened.
let lastAt = 0
function nextTime(): number {
  lastAt = Math.max(Date.now(), lastAt + 1)
  return lastAt
}

/** characterId is '' for entries that aren't about a saved character (e.g. a monster). */
export function addLog(characterId: string, text: string, fight?: { encounterId: string; round: number }): Promise<string> {
  return db.log.add({ id: newId(), characterId, at: nextTime(), text, ...fight })
}

/**
 * Log something about a character. If the character is in a fight that's running on this
 * device, it goes into that fight's log too (with the current round).
 */
export async function logCharacterEvent(characterId: string, text: string): Promise<string> {
  const fights = await db.encounters.filter((e) => e.status === 'active' && e.combatants.some((c) => c.characterId === characterId)).toArray()
  const fight = fights.sort((a, b) => b.updatedAt - a.updatedAt)[0]
  return addLog(characterId, text, fight ? { encounterId: fight.id, round: fight.round } : undefined)
}

/**
 * Live lobby (DM device): a roll shared from a phone goes into the running fight's log (the one
 * players see), and into the roller's sheet log if they play a character saved here.
 */
export async function logSharedRoll(text: string, characterId: string | null, campaignId: string | null): Promise<void> {
  const fight = liveFight((await db.encounters.toArray()).map(withEncounterDefaults), campaignId)
  const known = characterId && (await db.characters.get(characterId)) ? characterId : ''
  if (fight || known) await addLog(known, text, fight ? { encounterId: fight.id, round: fight.round } : undefined)
}

/** Remove one log line added by mistake (only the line: HP and other values are not changed back). */
export function deleteLog(id: string): Promise<void> {
  return db.log.delete(id)
}

/** A fight's log, oldest first (reads like a story of the battle). */
export function listEncounterLog(encounterId: string): Promise<LogEntry[]> {
  return db.log.where('encounterId').equals(encounterId).sortBy('at')
}

/** Latest entries for one character, newest first. */
export function listLog(characterId: string, limit = 100): Promise<LogEntry[]> {
  return db.log.where('characterId').equals(characterId).reverse().sortBy('at').then((all) => all.slice(0, limit))
}

export function clearLog(characterId: string): Promise<number> {
  return db.log.where('characterId').equals(characterId).delete()
}
