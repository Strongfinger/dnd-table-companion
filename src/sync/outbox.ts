// Player's outbox in a live lobby: changes sent to the DM's device that it hasn't confirmed yet.
// Saved on the phone, so a change made with no signal (or just before the app was closed) is
// sent again until the DM's device answers with an 'ack'. Each message keeps its id, and the DM
// device remembers ids it has applied, so a change sent twice is still applied once.
import type { Envelope } from './envelope'

export interface OutboxItem {
  envelope: Envelope
  /** When it was last sent. */
  sentAt: number
  /** Times sent while connected. */
  tries: number
}

/**
 * Give up after this many sends while connected (about a minute and a half with no answer):
 * the DM's device refused it, e.g. the player switched to another character meanwhile.
 */
export const MAX_TRIES = 20

export interface SavedOutbox {
  code: string
  items: OutboxItem[]
}

/** Biggest outbox kept: a whole evening of taps without signal fits easily. */
export const OUTBOX_LIMIT = 500

/** Items not confirmed `afterMs` after their last send: send them again. */
export function dueForResend(items: OutboxItem[], now: number, afterMs = 4000): OutboxItem[] {
  return items.filter((i) => now - i.sentAt >= afterMs)
}

/**
 * One retry round while connected: which items to send again, the updated outbox
 * (sent items get a new time and one more try), and how many were given up.
 */
export function resendRound(items: OutboxItem[], now: number, afterMs = 4000): { send: OutboxItem[]; items: OutboxItem[]; dropped: number } {
  const due = new Set(dueForResend(items, now, afterMs))
  const kept = items.filter((i) => !(due.has(i) && i.tries >= MAX_TRIES))
  const next = kept.map((i) => (due.has(i) ? { ...i, sentAt: now, tries: i.tries + 1 } : i))
  return { send: next.filter((_, n) => due.has(kept[n])), items: next, dropped: items.length - kept.length }
}

/** Remove the items the DM confirmed. */
export function removeAcked(items: OutboxItem[], ids: string[]): OutboxItem[] {
  const done = new Set(ids)
  return items.filter((i) => !done.has(i.envelope.id))
}

/** A saved outbox for this room (an outbox from another room is dropped). */
export function outboxFor(saved: unknown, code: string): OutboxItem[] {
  if (typeof saved !== 'object' || saved === null) return []
  const s = saved as Partial<SavedOutbox>
  return s.code === code && Array.isArray(s.items) ? s.items.slice(-OUTBOX_LIMIT) : []
}

/** Body of an 'ack' message: the ids of messages the DM's device has handled. */
export function parseAck(body: unknown): string[] | null {
  const ids = typeof body === 'object' && body !== null ? (body as Record<string, unknown>).ids : null
  return Array.isArray(ids) && ids.length <= 100 && ids.every((x) => typeof x === 'string' && x.length <= 64) ? (ids as string[]) : null
}
