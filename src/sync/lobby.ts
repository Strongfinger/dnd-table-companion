// The live lobby's small pure helpers: the saved session (so a reload rejoins the room),
// the join link in the QR code, kick messages and the member list shown on screen.
import { isValidRoomCode } from './roomCode'
import type { Member } from './transport'
import { MAX_GRANTS, type Grant } from './sheets'

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
  /**
   * Devices the DM removed from this session. DM: their messages are ignored. Player: learnt from the DM's
   * 'kick' messages, only to hide them from the member list.
   */
  kicked: Kicked[]
  /** DM: when the party's short rest started (players may spend Hit Dice until it ends), or null. */
  shortRestSince: number | null
  /** DM: extra characters handed to players' devices (e.g. a monster made into a character). */
  grants: Grant[]
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
    shortRestSince: Number.isFinite(s.shortRestSince) ? (s.shortRestSince as number) : null,
    grants: Array.isArray(s.grants) ? s.grants.slice(0, MAX_GRANTS).flatMap((g) => {
      const characterId = shortString(g?.characterId, 64)
      const deviceId = shortString(g?.deviceId, 64)
      return characterId && deviceId ? [{ characterId, deviceId }] : []
    }) : [],
    kicked: Array.isArray(s.kicked) ? s.kicked.flatMap((k) => {
      const deviceId = shortString(k?.deviceId, 64)
      return deviceId ? [{ deviceId, name: shortString(k.name, 40) ?? '' }] : []
    }) : [],
  }
}

/**
 * DM: the room this device hosted last, to open it again with the same code (players stay in it and
 * reconnect on their own). Kept: campaign, removed players, handed-over characters. A short rest that
 * was running is over: leaving the room ended it.
 */
export function lastHostedRoom(saved: unknown): LobbySession | null {
  const s = parseLobbySession(saved)
  return s && s.role === 'dm' ? { ...s, shortRestSince: null } : null
}

/** How many rooms the DM can go back to (the newest left first). */
export const MAX_RECENT_HOSTED = 5

/**
 * DM: the rooms this device hosted and left, newest first, to open one again with the same code.
 * Reads a saved list, or the single room an older version saved.
 */
export function recentHostedRooms(saved: unknown): LobbySession[] {
  const list = Array.isArray(saved) ? saved : saved == null ? [] : [saved]
  const rooms: LobbySession[] = []
  for (const item of list) {
    const s = lastHostedRoom(item)
    if (s && !rooms.some((r) => r.code === s.code)) rooms.push(s)
  }
  return rooms.slice(0, MAX_RECENT_HOSTED)
}

/** The recent rooms with the room just left put first (replacing an older copy of it), kept to the newest few. */
export function addRecentHosted(rooms: LobbySession[], left: LobbySession): LobbySession[] {
  const room = lastHostedRoom(left)
  if (!room) return rooms
  return [room, ...rooms.filter((r) => r.code !== room.code)].slice(0, MAX_RECENT_HOSTED)
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
 * A player's phone hides a kicked device only while it is offline: the DM may have let it back in
 * (players aren't told), and a kicked device that comes online is kicked again by the DM's device.
 */
export function visibleMembers(members: Member[], kicked: Kicked[], role: 'dm' | 'player' = 'dm'): Member[] {
  const rank = (m: Member) => (m.role === 'dm' ? 0 : m.online ? 1 : 2)
  const byDevice = new Map<string, Member>()
  for (const m of members) if (!byDevice.get(m.deviceId)?.online) byDevice.set(m.deviceId, m)
  return [...byDevice.values()]
    .filter((m) => !isKicked(kicked, m.deviceId) || (role === 'player' && m.online))
    .sort((a, b) => rank(a) - rank(b) || a.name.localeCompare(b.name, 'th'))
}

export const isKicked = (kicked: Kicked[], deviceId: string) => kicked.some((k) => k.deviceId === deviceId)

/** The removed list with one more device (unchanged if it is already there). Kept to the newest 50. */
export function addKicked(kicked: Kicked[], deviceId: string, name: string): Kicked[] {
  return isKicked(kicked, deviceId) ? kicked : [...kicked, { deviceId, name: name.slice(0, 40) }].slice(-50)
}

/**
 * The name shown for a roll, from the member list (never from the message): the DM is "DM",
 * a player is their character's name (or their device name before they pick one).
 */
export function rollerName(members: Member[], deviceId: string, fallback: string): string {
  const m = members.find((x) => x.deviceId === deviceId)
  const name = !m ? fallback : m.role === 'dm' ? 'DM' : m.characterName || m.name
  return name.slice(0, 60)
}
