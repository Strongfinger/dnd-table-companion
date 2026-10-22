// The DM's pinned pages and recently opened pages, per campaign, in this device's settings table
// (keys `pins:<campaignId>` and `recent:<campaignId>`). DM-only: never synced to players, never in a backup.
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from './db'
import { pushRecent, togglePin, movePin, type Pin } from '../model/pins'

const scope = (campaignId: string | null) => campaignId ?? 'all'
const pinsKey = (c: string | null) => `pins:${scope(c)}`
const recentKey = (c: string | null) => `recent:${scope(c)}`

async function readList<T>(key: string): Promise<T[]> {
  const v = (await db.settings.get(key))?.value
  return Array.isArray(v) ? (v as T[]) : []
}

/** Read-change-write in one transaction, so two quick taps don't overwrite each other. */
async function changeList<T>(key: string, fn: (list: T[]) => T[]): Promise<void> {
  await db.transaction('rw', db.settings, async () => {
    const before = await readList<T>(key)
    const after = fn(before)
    if (after !== before) await db.settings.put({ key, value: after })
  })
}

export const togglePinned = (campaignId: string | null, p: Pin) => changeList<Pin>(pinsKey(campaignId), (l) => togglePin(l, p))
export const movePinned = (campaignId: string | null, p: Pin, dir: -1 | 1) => changeList<Pin>(pinsKey(campaignId), (l) => movePin(l, p, dir))
export const setPins = (campaignId: string | null, pins: Pin[]) => changeList<Pin>(pinsKey(campaignId), () => pins)
export const markOpened = (campaignId: string | null, noteId: string) => changeList<string>(recentKey(campaignId), (l) => pushRecent(l, noteId))

/** Live lists for the screen (undefined while loading). */
export const usePins = (campaignId: string | null) => useLiveQuery(() => readList<Pin>(pinsKey(campaignId)), [campaignId])
export const useRecent = (campaignId: string | null) => useLiveQuery(() => readList<string>(recentKey(campaignId)), [campaignId])
