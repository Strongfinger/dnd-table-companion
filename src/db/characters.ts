// Read/write characters. UI code uses these instead of touching `db` directly.
import { liveQuery } from 'dexie'
import { withDefaults, type Character } from '../model/character'
import { buffedArmorClass } from '../rules'
import { stamp } from '../model/sync'
import { db } from './db'
import { deviceId } from './device'

/** All characters, most recently edited first. */
export function listCharacters(): Promise<Character[]> {
  return db.characters.orderBy('updatedAt').reverse().toArray().then((all) => all.map(withDefaults))
}

export function getCharacter(id: string): Promise<Character | undefined> {
  return db.characters.get(id).then((c) => c && withDefaults(c))
}

/**
 * Stamp a change for sync: next revision, by this device, now.
 * A character with no owner yet becomes owned by this device (where it was created).
 */
function stampCharacter(c: Character): Character {
  const me = deviceId()
  return stamp({ ...c, ownerDeviceId: c.ownerDeviceId || me }, me)
}

/** Insert or update. Stamps revision/updatedAt and returns the saved copy. */
export async function saveCharacter(character: Character): Promise<Character> {
  const saved = stampCharacter(character)
  await db.characters.put(saved)
  return saved
}

/**
 * Change a character safely: read the latest saved copy, apply `fn`, save — in one transaction.
 * Quick taps (damage, then a condition) each start from the newest data, so none is lost.
 * `fn` returns the new character and a log line; the log line is returned (or null if not found).
 * Returning the same character object it was given means "no change" (nothing is saved).
 */
export async function updateCharacter(id: string, fn: (c: Character) => { character: Character; text: string }): Promise<string | null> {
  return db.transaction('rw', db.characters, async () => {
    const stored = await db.characters.get(id)
    if (!stored) return null
    const current = withDefaults(stored)
    const r = fn(current)
    // Nothing changed (fn returned the same object): don't save, so the revision stays as it is.
    if (r.character !== current) await db.characters.put(stampCharacter(r.character))
    return r.text
  })
}

/**
 * Store a sheet received in a live lobby exactly as sent (no new revision), so both devices keep
 * the same revision number. `accept` decides against the copy stored here (in the same transaction).
 * The campaign stays this device's own choice; a new character gets `campaignIdIfNew`.
 * Returns the copy now stored here.
 */
export async function saveReceivedCharacter(
  incoming: Character,
  accept: (stored: Character | undefined) => boolean,
  campaignIdIfNew: string | null = null,
  /** Last check on what gets saved (e.g. the DM's level lock); null refuses it. */
  adjust: (incoming: Character, stored: Character | undefined) => Character | null = (x) => x,
): Promise<{ saved: boolean; stored: Character }> {
  return db.transaction('rw', db.characters, async () => {
    const raw = await db.characters.get(incoming.id)
    const stored = raw && withDefaults(raw)
    const adjusted = accept(stored) ? adjust(incoming, stored) : null
    if (!adjusted) return { saved: false, stored: stored! }
    const c = { ...adjusted, campaignId: stored ? stored.campaignId : campaignIdIfNew }
    await db.characters.put(c)
    return { saved: true, stored: c }
  })
}

/**
 * Put a character in a campaign on this device only (no new revision): which campaign a character
 * is filed under is each device's own choice, so it isn't a change other devices need.
 */
export async function setCharacterCampaign(id: string, campaignId: string | null): Promise<void> {
  await db.characters.update(id, { campaignId })
}

/**
 * Live room: the characters played there belong to the room's campaign on this device (the DM's and the
 * players' alike), whatever campaign they were filed under before. Only those not in it yet are changed.
 */
export async function moveToCampaign(ids: string[], campaignId: string): Promise<void> {
  await db.characters.where('id').anyOf(ids).filter((c) => c.campaignId !== campaignId).modify({ campaignId })
}

/** Call `onChange` with these characters now and after every change to them. Returns a stop function. */
export function watchCharacters(ids: string[], onChange: (list: Character[]) => void): () => void {
  const sub = liveQuery(() => db.characters.where('id').anyOf(ids).toArray()).subscribe({
    next: (list) => onChange(list.map(withDefaults)),
    error: (err) => console.error('watchCharacters', err),
  })
  return () => sub.unsubscribe()
}

/** Deletes the character and its play log. */
export async function deleteCharacter(id: string): Promise<void> {
  await db.transaction('rw', db.characters, db.log, db.encounters, async () => {
    // Fights keep showing a deleted character with its last HP and AC (a fight row's own copy is
    // otherwise only what it had when it joined: the sheet is the source while it exists).
    const sheet = await db.characters.get(id)
    if (sheet) {
      const me = deviceId()
      await db.encounters.filter((e) => e.combatants.some((c) => c.characterId === id)).modify((e) => {
        const combatants = e.combatants.map((c) => (c.characterId === id ? { ...c, hp: { ...sheet.hp }, ac: buffedArmorClass(sheet.ac, sheet.buffs) } : c))
        Object.assign(e, stamp({ ...e, combatants }, me))
      })
    }
    await db.characters.delete(id)
    await db.log.where('characterId').equals(id).delete()
  })
}
