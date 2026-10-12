// The live lobby's small pure helpers: the saved session (so a reload rejoins the room),
// the join link in the QR code, kick messages and the member list shown on screen.
import { isValidRoomCode } from './roomCode'
import type { Member } from './transport'

/** The room this device is in, saved in settings so the app rejoins after a reload or sleep. */
export interface LobbySession {
  code: string
  role: 'dm' | 'player'
  /** DM: the campaign this live session belongs to. */
  campaignId: string | null
  /** Player: the character they play here. */
  characterId: string | null
  characterName: string | null
  /** Test mode: browser tabs on this computer instead of Firebase. */
  local: boolean
  /** DM: devices removed from this session (their messages are ignored). */
  kicked: Kicked[]
}

export interface Kicked {
  deviceId: string
  name: string
}

const shortString = (v: unknown, max: number) => (typeof v === 'string' && v.length <= max ? v : null)

/** Check a saved session (settings can hold anything an older version wrote). */
export function parseLobbySession(v: unknown): LobbySession | null {
  if (typeof v !== 'object' || v === null) return null
  const s = v as Record<string, unknown>
  if (typeof s.code !== 'string' || !isValidRoomCode(s.code)) return null
  if (s.role !== 'dm' && s.role !== 'player') return null
  return {
    code: s.code,
    role: s.role,
    campaignId: shortString(s.campaignId, 64),
    characterId: shortString(s.characterId, 64),
    characterName: shortString(s.characterName, 60),
    local: s.local === true,
    kicked: Array.isArray(s.kicked) ? s.kicked.flatMap((k) => {
      const deviceId = shortString(k?.deviceId, 64)
      return deviceId ? [{ deviceId, name: shortString(k.name, 40) ?? '' }] : []
    }) : [],
  }
}

/** The link in the QR code: opens the lobby with the code filled in. */
export function joinLink(origin: string, code: string): string {
  return `${origin.replace(/\/$/, '')}/#/lobby/${code}`
}

/** Body of a 'kick' message: which device the DM removed. */
export function parseKick(body: unknown): { deviceId: string } | null {
  if (typeof body !== 'object' || body === null) return null
  const id = (body as Record<string, unknown>).deviceId
  return typeof id === 'string' && id.length > 0 && id.length <= 64 ? { deviceId: id } : null
}

/** True if `deviceId` is a DM in the room (only the DM may kick or, later, send the game state). */
export function isDm(members: Member[], deviceId: string): boolean {
  return members.some((m) => m.deviceId === deviceId && m.role === 'dm')
}

/**
 * Members to show: kicked ones left out; DM first, then online players, then by name.
 * A device listed twice (it signed in again, e.g. after clearing site data) shows once, online if it is.
 */
export function visibleMembers(members: Member[], kicked: Kicked[]): Member[] {
  const rank = (m: Member) => (m.role === 'dm' ? 0 : m.online ? 1 : 2)
  const byDevice = new Map<string, Member>()
  for (const m of members) if (!byDevice.get(m.deviceId)?.online) byDevice.set(m.deviceId, m)
  return [...byDevice.values()]
    .filter((m) => !isKicked(kicked, m.deviceId))
    .sort((a, b) => rank(a) - rank(b) || a.name.localeCompare(b.name, 'th'))
}

export const isKicked = (kicked: Kicked[], deviceId: string) => kicked.some((k) => k.deviceId === deviceId)
