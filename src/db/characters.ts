// Read/write characters. UI code uses these instead of touching `db` directly.
import type { Character } from '../model/character'
import { db } from './db'

/** All characters, most recently edited first. */
export function listCharacters(): Promise<Character[]> {
  return db.characters.orderBy('updatedAt').reverse().toArray()
}

export function getCharacter(id: string): Promise<Character | undefined> {
  return db.characters.get(id)
}

/** Insert or update. Stamps updatedAt and returns the saved copy. */
export async function saveCharacter(character: Character): Promise<Character> {
  const saved = { ...character, updatedAt: Date.now() }
  await db.characters.put(saved)
  return saved
}

export function deleteCharacter(id: string): Promise<void> {
  return db.characters.delete(id)
}
