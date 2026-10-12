// The wrapper around every lobby message. Phase 4 needs, from the Step A review:
// an id per message (so duplicates are dropped), the sender taken from the connection,
// the data version, and a size limit. The body is checked separately by its own parser.
import { newId } from '../model/character'
import { DATA_VERSION } from '../model/sync'

export const MESSAGE_KINDS = ['hello', 'action', 'roll', 'state', 'ping', 'kick', 'fight', 'ack'] as const
export type MessageKind = (typeof MESSAGE_KINDS)[number]

export interface Envelope {
  v: number
  id: string
  kind: MessageKind
  /** Sender device id. The connection fills this in; receivers never trust the body for it. */
  from: string
  /** Sender's display name (device name). */
  fromName: string
  at: number
  body: unknown
}

/** Biggest message we accept (a full character is a few KB). */
export const MAX_MESSAGE_BYTES = 64_000

export function makeEnvelope(kind: MessageKind, body: unknown, from: { id: string; name: string }, now = Date.now()): Envelope {
  return { v: DATA_VERSION, id: newId(), kind, from: from.id, fromName: from.name, at: now, body }
}

export type ParsedEnvelope = { ok: true; envelope: Envelope } | { ok: false; reason: 'invalid' | 'version' | 'too-big' }

/** Check a received message. `sender` (from the connection) overrides whatever the message claims. */
export function parseEnvelope(raw: unknown, sender?: { id: string; name: string }): ParsedEnvelope {
  if (typeof raw === 'string') {
    if (raw.length > MAX_MESSAGE_BYTES) return { ok: false, reason: 'too-big' }
    try {
      raw = JSON.parse(raw)
    } catch {
      return { ok: false, reason: 'invalid' }
    }
  }
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) return { ok: false, reason: 'invalid' }
  const m = raw as Record<string, unknown>
  if (m.v !== DATA_VERSION) return { ok: false, reason: 'version' }
  const idOk = typeof m.id === 'string' && /^[\w-]{1,64}$/.test(m.id)
  const kindOk = (MESSAGE_KINDS as readonly string[]).includes(m.kind as string)
  const atOk = Number.isFinite(m.at)
  const from = sender ?? (typeof m.from === 'string' && typeof m.fromName === 'string' ? { id: m.from, name: m.fromName } : null)
  if (!idOk || !kindOk || !atOk || !from || from.id.length > 64 || from.name.length > 40) return { ok: false, reason: 'invalid' }
  if (JSON.stringify(m.body ?? null).length > MAX_MESSAGE_BYTES) return { ok: false, reason: 'too-big' }
  return { ok: true, envelope: { v: DATA_VERSION, id: m.id as string, kind: m.kind as MessageKind, from: from.id, fromName: from.name, at: m.at as number, body: m.body ?? null } }
}

/** Remembers recent message ids so a message delivered twice is handled once. */
export class Deduper {
  private seen = new Set<string>()
  private order: string[] = []
  private limit: number

  /** `initial`: ids already handled before (e.g. saved before a reload), oldest first. */
  constructor(limit = 2000, initial: string[] = []) {
    this.limit = limit
    for (const id of initial) this.firstTime(id)
  }

  /** The remembered ids, oldest first (to save them). */
  ids(): string[] {
    return [...this.order]
  }

  /** True the first time an id is seen, false for repeats. */
  firstTime(id: string): boolean {
    if (this.seen.has(id)) return false
    this.seen.add(id)
    this.order.push(id)
    if (this.order.length > this.limit) this.seen.delete(this.order.shift()!)
    return true
  }
}

/**
 * Limits how many messages each sender may get through in a time window, so one
 * misbehaving (or stuck) device can't flood the DM's device. Generous for real play:
 * quick taps on HP or slots stay far below it.
 */
export class RateLimiter {
  private times = new Map<string, number[]>()
  private max: number
  private windowMs: number

  constructor(max = 40, windowMs = 10_000) {
    this.max = max
    this.windowMs = windowMs
  }

  /** True if a message from `sender` at `now` is allowed (and counts it). */
  allow(sender: string, now = Date.now()): boolean {
    const recent = (this.times.get(sender) ?? []).filter((t) => now - t < this.windowMs)
    if (recent.length >= this.max) {
      this.times.set(sender, recent)
      return false
    }
    recent.push(now)
    this.times.set(sender, recent)
    return true
  }
}
