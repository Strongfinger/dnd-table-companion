// The live lobby's shared context (the provider is in lobby.tsx). Separate file so React's
// fast refresh keeps working while editing the provider.
import { createContext, useContext } from 'react'
import type { Envelope, MessageKind } from '../sync/envelope'
import type { LobbySession } from '../sync/lobby'
import type { ConnectionStatus, Member } from '../sync/transport'

export interface CharacterPick {
  id: string
  name: string
}

export interface LobbyApi {
  session: LobbySession | null
  status: ConnectionStatus
  members: Member[]
  /** Who this device is in the room (in test mode each browser tab is its own device). */
  me: { id: string; name: string }
  /** False when Firebase isn't set up (then only the local test mode works). */
  onlineAvailable: boolean
  /** Set when the DM removed this device from the room. */
  kickedNotice: string | null
  create: (campaignId: string, local: boolean) => void
  join: (code: string, character: CharacterPick | null, local: boolean) => void
  leave: () => void
  kick: (deviceId: string) => void
  readmit: (deviceId: string) => void
  pickCharacter: (character: CharacterPick | null) => void
  send: (kind: MessageKind, body: unknown) => void
  /** Hear messages from other devices; returns a function that stops listening. */
  subscribe: (listener: (e: Envelope) => void) => () => void
}

export const LobbyContext = createContext<LobbyApi | null>(null)

export function useLobby(): LobbyApi {
  const api = useContext(LobbyContext)
  if (!api) throw new Error('useLobby needs <LobbyProvider>')
  return api
}
