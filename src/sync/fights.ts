// Fights on a player's phone in a live room (read-only): the DM's device sends the list of started
// fights ('fights') and their player-safe log lines ('log', only lines without DM secrets).
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
export const MAX_LOG_LINES = 300

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

export function parseLogBody(body: unknown): { encounterId: string; entries: PlayerLogEntry[] } | null {
  if (!isObj(body) || !shortId(body.encounterId) || !Array.isArray(body.entries) || body.entries.length > 200) return null
  const entries: PlayerLogEntry[] = []
  for (const e of body.entries) {
    if (!isObj(e) || !shortId(e.id) || !Number.isFinite(e.at) || !Number.isInteger(e.round) || typeof e.text !== 'string') return null
    entries.push({ id: e.id as string, at: e.at as number, round: e.round as number, text: e.text.slice(0, 300) })
  }
  return { encounterId: body.encounterId as string, entries }
}

/** Add received lines to a fight's log: no duplicates, in time order, newest MAX_LOG_LINES kept. */
export function mergeLog(old: PlayerLogEntry[], add: PlayerLogEntry[]): PlayerLogEntry[] {
  const byId = new Map(old.map((e) => [e.id, e]))
  for (const e of add) byId.set(e.id, e)
  return [...byId.values()].sort((a, b) => a.at - b.at).slice(-MAX_LOG_LINES)
}
