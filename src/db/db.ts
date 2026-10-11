// The on-device database (IndexedDB via Dexie). Each phone/laptop has its own copy.
import Dexie, { type EntityTable } from 'dexie'
import type { Character } from '../model/character'

export const db = new Dexie('dnd-table-companion') as Dexie & {
  characters: EntityTable<Character, 'id'>
}

// Version 1. Only listed fields are indexed (searchable); every other field is still saved.
// To change this later, add db.version(2) below instead of editing version 1.
db.version(1).stores({
  characters: 'id, name, updatedAt',
})
