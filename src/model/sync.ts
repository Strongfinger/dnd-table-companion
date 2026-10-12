// Groundwork for live sync between devices (planned lobby feature). No networking here:
// just the bookkeeping every shared record needs so two devices can agree on the newest copy.

/**
 * Version of the data shapes shared between devices. Bump it when a shared shape changes;
 * devices only sync with the same version (the update prompt brings them level).
 */
export const DATA_VERSION = 2

export function isCompatibleVersion(remote: unknown): boolean {
  return remote === DATA_VERSION
}

/** Fields every synced record carries. */
export interface SyncMeta {
  /** Counts saves: goes up by one every time the record changes. */
  rev: number
  /** Device id of the last change. */
  updatedBy: string
  updatedAt: number
}

/** A usable revision number (older or hand-edited records may lack one). */
const safeRev = (rev: unknown) => (Number.isSafeInteger(rev) && (rev as number) >= 0 ? (rev as number) : 0)

/** Stamp a change: next revision, by this device, now. */
export function stamp<T extends SyncMeta>(record: T, deviceId: string, now = Date.now()): T {
  return { ...record, rev: safeRev(record.rev) + 1, updatedBy: deviceId, updatedAt: now }
}

/**
 * Check the bookkeeping of a record received from another device.
 * (A misbehaving device could still inflate revisions: the DM device stays the source of truth.)
 */
export function isValidSyncMeta(v: { rev?: unknown; updatedAt?: unknown; updatedBy?: unknown }): boolean {
  return Number.isSafeInteger(v.rev) && (v.rev as number) >= 0 && (v.rev as number) < 1e9 &&
    Number.isFinite(v.updatedAt) && typeof v.updatedBy === 'string' && v.updatedBy.length <= 64
}

/**
 * Which copy of the same record is newer? Higher revision wins; if equal, the later
 * change; if still equal, the device id decides, so every device picks the same one.
 */
export function newerOf<T extends SyncMeta>(a: T, b: T): T {
  if (a.rev !== b.rev) return a.rev > b.rev ? a : b
  if (a.updatedAt !== b.updatedAt) return a.updatedAt > b.updatedAt ? a : b
  return a.updatedBy >= b.updatedBy ? a : b
}

const sameValue = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b)
const isPlainObject = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v)

/**
 * Save an edit form without losing changes made elsewhere while it was open (e.g. damage from the
 * tracker or the DM's device): fields the form changed come from `draft`, all others from `latest`.
 * `original` is the copy the form started from. Nested objects (like hp) are merged the same way.
 */
export function mergeDraft<T extends object>(original: T, draft: T, latest: T): T {
  const o = original as Record<string, unknown>
  const d = draft as Record<string, unknown>
  const out: Record<string, unknown> = { ...(latest as Record<string, unknown>) }
  for (const key of Object.keys(d)) {
    if (sameValue(o[key], d[key])) continue
    const l = out[key]
    out[key] = isPlainObject(o[key]) && isPlainObject(d[key]) && isPlainObject(l) ? mergeDraft(o[key], d[key], l) : d[key]
  }
  return out as T
}
