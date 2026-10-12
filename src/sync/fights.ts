// Fights and logs on a player's phone in a live room (read-only): the DM's device sends the list of
// started fights ('fights') and log lines ('log'): each fight's player-safe lines, and the log of the
// player's own character. 'log' carries new lines and deleted ones, so a line the DM deletes goes
// away on phones too; a 'full' log (on (re)connect) replaces everything from its `from` time on.
import type { Encounter } from '../model/encounter'
import { liveFight } from '../model/playerView'

export interface FightSummary {
  id: string
  name: string
  status: 'active' | 'ended'
  round: number
  updatedAt: number
}

export interface PlayerLogEntry {
  id: string
  at: number
  round: number
  text: string
}

/** At most this many fights and log lines per fight go to players. */
export const MAX_FIGHTS = 10
export const MAX_LOG_LINES = 200
/** Room for the lines in one message (messages are limited to 64,000 characters). */
export const MAX_LOG_CHARS = 48_000

/**
 * Fights players may see: started ones (setup stays secret) of the room's campaign, newest first,
 * plus the running fight shown on their phones even if it was filed under another campaign.
 */
export function fightsForPlayers(encounters: Encounter[], campaignId: string | null): FightSummary[] {
  const live = liveFight(encounters, campaignId)
  return encounters
    .filter((e) => e === live || (e.status !== 'setup' && (!campaignId || e.campaignId === campaignId)))
    .sort((a, b) => b.updatedAt - a.updatedAt)
    .slice(0, MAX_FIGHTS)
    .map((e) => ({ id: e.id, name: e.name, status: e.status as FightSummary['status'], round: e.round, updatedAt: e.updatedAt }))
}

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v)
const shortId = (v: unknown) => typeof v === 'string' && v.length > 0 && v.length <= 64

export function parseFights(body: unknown): FightSummary[] | null {
  const list = isObj(body) ? body.fights : null
  if (!Array.isArray(list) || list.length > MAX_FIGHTS) return null
  const out: FightSummary[] = []
  for (const f of list) {
    if (!isObj(f) || !shortId(f.id) || typeof f.name !== 'string' || (f.status !== 'active' && f.status !== 'ended')) return null
    if (!Number.isInteger(f.round) || !Number.isFinite(f.updatedAt)) return null
    out.push({ id: f.id as string, name: f.name.slice(0, 100), status: f.status, round: f.round as number, updatedAt: f.updatedAt as number })
  }
  return out
}

/** Which log a 'log' message is about: a fight's (player-safe) log, or a character's log. */
export type LogTarget = { kind: 'fight'; id: string } | { kind: 'character'; id: string }

export interface LogMessage {
  target: LogTarget
  entries: PlayerLogEntry[]
  /** Lines the DM deleted. */
  removed: string[]
  /** A full copy: replaces every line from this time on (0 = everything). */
  from: number | null
}

export function parseLogBody(body: unknown): LogMessage | null {
  if (!isObj(body) || !Array.isArray(body.entries) || body.entries.length > MAX_LOG_LINES) return null
  const target: LogTarget | null = shortId(body.encounterId) ? { kind: 'fight', id: body.encounterId as string }
    : shortId(body.characterId) ? { kind: 'character', id: body.characterId as string } : null
  if (!target) return null
  const entries: PlayerLogEntry[] = []
  for (const e of body.entries) {
    if (!isObj(e) || !shortId(e.id) || !Number.isFinite(e.at) || !Number.isInteger(e.round) || typeof e.text !== 'string') return null
    entries.push({ id: e.id as string, at: e.at as number, round: e.round as number, text: e.text.slice(0, 300) })
  }
  const removed = Array.isArray(body.removed) ? body.removed.filter(shortId).slice(0, 1000) as string[] : []
  const from = Number.isFinite(body.from) ? (body.from as number) : null
  return { target, entries, removed, from }
}

/**
 * What changed in a log since the last send (`sent`: line id → time). A line that only dropped out of
 * the newest MAX_LOG_LINES isn't "removed" (phones keep it); one the DM deleted is.
 * `current` is oldest first.
 */
export function logDiff(sent: Map<string, number>, current: PlayerLogEntry[], limit = MAX_LOG_LINES): { added: PlayerLogEntry[]; removed: string[] } {
  const ids = new Set(current.map((e) => e.id))
  const windowStart = current.length >= limit ? current[0].at : -Infinity
  return {
    added: current.filter((e) => !sent.has(e.id)),
    removed: [...sent].filter(([id, at]) => !ids.has(id) && at >= windowStart).map(([id]) => id),
  }
}

/** The newest lines that fit in one message, and the time they start from (0 = all of them fit). */
export function fullLog(entries: PlayerLogEntry[], maxChars = MAX_LOG_CHARS): { entries: PlayerLogEntry[]; from: number } {
  let size = 0
  let first = entries.length
  while (first > 0 && size + JSON.stringify(entries[first - 1]).length + 1 <= maxChars) size += JSON.stringify(entries[--first]).length + 1
  const kept = entries.slice(first)
  return { entries: kept, from: first === 0 ? 0 : kept[0]?.at ?? Infinity }
}

/** Apply a 'log' message to a fight log kept in memory on a phone. */
export function applyLogMessage(old: PlayerLogEntry[], m: Pick<LogMessage, 'entries' | 'removed' | 'from'>): PlayerLogEntry[] {
  const base = m.from === null ? old : old.filter((e) => e.at < (m.from as number))
  const gone = new Set(m.removed)
  return mergeLog(base, m.entries).filter((e) => !gone.has(e.id))
}

/** Add received lines to a fight's log: no duplicates, in time order, newest MAX_LOG_LINES kept. */
export function mergeLog(old: PlayerLogEntry[], add: PlayerLogEntry[]): PlayerLogEntry[] {
  const byId = new Map(old.map((e) => [e.id, e]))
  for (const e of add) byId.set(e.id, e)
  return [...byId.values()].sort((a, b) => a.at - b.at).slice(-MAX_LOG_LINES)
}
