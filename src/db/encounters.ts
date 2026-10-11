// Read/write encounters for the combat tracker.
import type { Encounter } from '../model/encounter'
import { db } from './db'

/** All encounters, most recently changed first. */
export function listEncounters(): Promise<Encounter[]> {
  return db.encounters.orderBy('updatedAt').reverse().toArray()
}

export function getEncounter(id: string): Promise<Encounter | undefined> {
  return db.encounters.get(id)
}

export async function saveEncounter(e: Encounter): Promise<Encounter> {
  const saved = { ...e, updatedAt: Date.now() }
  await db.encounters.put(saved)
  return saved
}

/** Deletes the encounter and its fight log (PC sheet logs keep their own copies). */
export async function deleteEncounter(id: string): Promise<void> {
  await db.transaction('rw', db.encounters, db.log, async () => {
    await db.encounters.delete(id)
    await db.log.where('encounterId').equals(id).filter((e) => e.characterId === '').delete()
  })
}
