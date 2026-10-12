// The on-device database (IndexedDB via Dexie). Each phone/laptop has its own copy.
import Dexie, { type EntityTable } from 'dexie'
import type { Character } from '../model/character'
import type { Campaign } from '../model/campaign'
import type { Encounter } from '../model/encounter'

export interface LogEntry {
  id: string
  characterId: string
  /** Time in milliseconds (Date.now()). */
  at: number
  text: string
  /** Set when it happened in a tracked fight. */
  encounterId?: string
  round?: number
  /**
   * Players in a live room may see this fight-log line (no DM secrets: turns of visible creatures,
   * round changes, shared rolls...). Lines about a player character (characterId set) always may.
   */
  forPlayers?: true
  /** On a player's phone: a copy of the DM device's line for this character (kept in step with it). */
  fromDm?: true
}

export const db = new Dexie('dnd-table-companion') as Dexie & {
  characters: EntityTable<Character, 'id'>
  log: EntityTable<LogEntry, 'id'>
  encounters: EntityTable<Encounter, 'id'>
  campaigns: EntityTable<Campaign, 'id'>
  /** Per-device key/value settings (device identity, selected campaign). */
  settings: EntityTable<{ key: string; value: unknown }, 'key'>
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
db.version(3).stores({
  characters: 'id, name, updatedAt',
  log: 'id, characterId, encounterId, at',
  encounters: 'id, updatedAt',
})
db.version(4).stores({
  characters: 'id, name, updatedAt, campaignId',
  log: 'id, characterId, encounterId, at',
  encounters: 'id, updatedAt, campaignId',
  campaigns: 'id, updatedAt',
  settings: 'key',
})
