// Read/write characters. UI code uses these instead of touching `db` directly.
import { withDefaults, type Character } from '../model/character'
import { db } from './db'

/** All characters, most recently edited first. */
export function listCharacters(): Promise<Character[]> {
  return db.characters.orderBy('updatedAt').reverse().toArray().then((all) => all.map(withDefaults))
}

export function getCharacter(id: string): Promise<Character | undefined> {
  return db.characters.get(id).then((c) => c && withDefaults(c))
}

/** Insert or update. Stamps updatedAt and returns the saved copy. */
export async function saveCharacter(character: Character): Promise<Character> {
  const saved = { ...character, updatedAt: Date.now() }
  await db.characters.put(saved)
  return saved
}

/**
 * Change a character safely: read the latest saved copy, apply `fn`, save — in one transaction.
 * Quick taps (damage, then a condition) each start from the newest data, so none is lost.
 * `fn` returns the new character and a log line; the log line is returned (or null if not found).
 */
export async function updateCharacter(id: string, fn: (c: Character) => { character: Character; text: string }): Promise<string | null> {
  return db.transaction('rw', db.characters, async () => {
    const stored = await db.characters.get(id)
    if (!stored) return null
    const r = fn(withDefaults(stored))
    await db.characters.put({ ...r.character, updatedAt: Date.now() })
    return r.text
  })
}

/** Deletes the character and its play log. */
export async function deleteCharacter(id: string): Promise<void> {
  await db.transaction('rw', db.characters, db.log, async () => {
    await db.characters.delete(id)
    await db.log.where('characterId').equals(id).delete()
  })
}
