// What the lobby needs from a realtime connection. Two implementations:
// - localTransport: browser tabs on this computer (for testing, no internet)
// - Firebase (Realtime Database): the real one, used between phones and the DM's device
import type { Envelope } from './envelope'

export type ConnectionStatus = 'connecting' | 'connected' | 'reconnecting' | 'offline'

export interface Member {
  deviceId: string
  name: string
  role: 'dm' | 'player'
  /** For players: the character they play (once picked). */
  characterId: string | null
  online: boolean
}

export interface Me {
  id: string
  name: string
  role: 'dm' | 'player'
  characterId: string | null
}

export interface RoomHandlers {
  /** A checked, de-duplicated message from another device. */
  onMessage: (e: Envelope) => void
  onMembers: (members: Member[]) => void
  onStatus: (status: ConnectionStatus) => void
}

export interface RoomConnection {
  readonly code: string
  send: (e: Envelope) => void
  /** Update what others see about me (e.g. the character I picked). */
  updateMe: (patch: Partial<Pick<Me, 'name' | 'characterId'>>) => void
  leave: () => void
}

export interface RoomTransport {
  readonly label: string
  join: (code: string, me: Me, handlers: RoomHandlers) => RoomConnection
}
