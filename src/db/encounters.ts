// Read/write encounters for the combat tracker.
import { liveQuery } from 'dexie'
import { withDefaults } from '../model/character'
import { withEncounterDefaults, type Encounter } from '../model/encounter'
import { liveFight, playerView, type PlayerEncounterView } from '../model/playerView'
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

/**
 * Live lobby (DM device): call `onChange` with what players should see of the running fight
 * (or null when none is running), now and after every change to fights or the PCs in them.
 */
export function watchPlayerFight(campaignId: string | null, onChange: (view: PlayerEncounterView | null) => void): () => void {
  const sub = liveQuery(async () => {
    const e = liveFight((await db.encounters.toArray()).map(withEncounterDefaults), campaignId)
    if (!e) return null
    const ids = e.combatants.flatMap((c) => (c.characterId ? [c.characterId] : []))
    const characters = (await db.characters.where('id').anyOf(ids).toArray()).map(withDefaults)
    return playerView(e, new Map(characters.map((c) => [c.id, c])))
  }).subscribe({ next: onChange, error: (err) => console.error('watchPlayerFight', err) })
  return () => sub.unsubscribe()
}

/** The running fight a character is in (the most recently changed one), or null. */
export async function runningFightOf(characterId: string): Promise<Encounter | null> {
  const fights = await db.encounters.filter((e) => e.status === 'active' && e.combatants.some((c) => c.characterId === characterId)).toArray()
  return fights.map(withEncounterDefaults).sort((a, b) => b.updatedAt - a.updatedAt)[0] ?? null
}
