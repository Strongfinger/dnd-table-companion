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

/**
 * Change an encounter safely: read the latest saved copy, apply `fn`, save — in one transaction.
 * `fn` returns the new encounter plus any extra result (e.g. turn events to log).
 */
export async function updateEncounter<R>(id: string, fn: (e: Encounter) => { encounter: Encounter; result: R }): Promise<R | undefined> {
  return db.transaction('rw', db.encounters, async () => {
    const stored = await db.encounters.get(id)
    if (!stored) return undefined
    const r = fn(stored)
    await db.encounters.put({ ...r.encounter, updatedAt: Date.now() })
    return r.result
  })
}

/** Deletes the encounter and its fight log (PC sheet logs keep their own copies). */
export async function deleteEncounter(id: string): Promise<void> {
  await db.transaction('rw', db.encounters, db.log, async () => {
    await db.encounters.delete(id)
    await db.log.where('encounterId').equals(id).filter((e) => e.characterId === '').delete()
  })
}
