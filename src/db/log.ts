// Play log: what happened to a character, newest first, so the table can look back after a fight.
import { newId } from '../model/character'
import { db, type LogEntry } from './db'

export function addLog(characterId: string, text: string): Promise<string> {
  return db.log.add({ id: newId(), characterId, at: Date.now(), text })
}

/** Latest entries for one character, newest first. */
export function listLog(characterId: string, limit = 100): Promise<LogEntry[]> {
  return db.log.where('characterId').equals(characterId).reverse().sortBy('at').then((all) => all.slice(0, limit))
}

export function clearLog(characterId: string): Promise<number> {
  return db.log.where('characterId').equals(characterId).delete()
}
