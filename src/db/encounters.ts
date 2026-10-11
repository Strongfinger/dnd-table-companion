// Read/write encounters for the combat tracker.
import { withEncounterDefaults, type Encounter } from '../model/encounter'
import { stamp } from '../model/sync'
import { db } from './db'
import { deviceId } from './device'

/** All encounters, most recently changed first. */
export function listEncounters(): Promise<Encounter[]> {
  return db.encounters.orderBy('updatedAt').reverse().toArray().then((all) => all.map(withEncounterDefaults))
}

export function getEncounter(id: string): Promise<Encounter | undefined> {
  return db.encounters.get(id).then((e) => e && withEncounterDefaults(e))
}

export async function saveEncounter(e: Encounter): Promise<Encounter> {
  const saved = stamp(e, deviceId())
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
    const r = fn(withEncounterDefaults(stored))
    await db.encounters.put(stamp(r.encounter, deviceId()))
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
