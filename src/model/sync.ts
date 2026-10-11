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

/** Stamp a change: next revision, by this device, now. */
export function stamp<T extends SyncMeta>(record: T, deviceId: string, now = Date.now()): T {
  return { ...record, rev: record.rev + 1, updatedBy: deviceId, updatedAt: now }
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
