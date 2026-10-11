// The on-device database (IndexedDB via Dexie). Each phone/laptop has its own copy.
import Dexie, { type EntityTable } from 'dexie'
import type { Character } from '../model/character'

export interface LogEntry {
  id: string
  characterId: string
  /** Time in milliseconds (Date.now()). */
  at: number
  text: string
}

export const db = new Dexie('dnd-table-companion') as Dexie & {
  characters: EntityTable<Character, 'id'>
  log: EntityTable<LogEntry, 'id'>
}

// Only listed fields are indexed (searchable); every other field is still saved.
// Never edit an old version: add a new one. Existing data is kept when the version goes up.
db.version(1).stores({
  characters: 'id, name, updatedAt',
})
db.version(2).stores({
  characters: 'id, name, updatedAt',
  log: 'id, characterId, at',
})
