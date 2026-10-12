// The live lobby's shared context (the provider is in lobby.tsx). Separate file so React's
// fast refresh keeps working while editing the provider.
import { createContext, useContext } from 'react'
import type { CharacterAction } from '../model/characterActions'
import type { PlayerEncounterView } from '../model/playerView'
import type { RollEvent } from '../model/rollEvent'
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
  /** Players: the running fight as the DM's device shows it to players (null = no fight running). */
  fight: PlayerEncounterView | null
  /** Player: changes made here that the DM's device hasn't confirmed yet (re-sent until it does). */
  pending: number
  /** Dice rolls shared in the room this session, newest first (mine included). */
  rolls: RoomRoll[]
  /** Set when the DM removed this device from the room. */
  kickedNotice: string | null
  create: (campaignId: string, local: boolean) => void
  join: (code: string, character: CharacterPick | null, local: boolean) => void
  leave: () => void
  kick: (deviceId: string) => void
  readmit: (deviceId: string) => void
  pickCharacter: (character: CharacterPick | null) => void
  /** A play change this device just made to a character (players: sent to the DM if it's mine here). */
  shareAction: (characterId: string, action: CharacterAction) => void
  /** This device saved an edit to a character (players: the full sheet goes to the DM if it's mine here). */
  shareSheet: (characterId: string) => void
  /** Share a roll from the dice roller with the room (named by the room, e.g. my character). */
  shareRoll: (roll: Omit<RollEvent, 'type' | 'by'>) => void
  send: (kind: MessageKind, body: unknown) => void
  /** Hear messages from other devices; returns a function that stops listening. */
  subscribe: (listener: (e: Envelope) => void) => () => void
}

export interface RoomRoll {
  id: string
  at: number
  roll: RollEvent
  mine: boolean
}

export const LobbyContext = createContext<LobbyApi | null>(null)

export function useLobby(): LobbyApi {
  const api = useContext(LobbyContext)
  if (!api) throw new Error('useLobby needs <LobbyProvider>')
  return api
}
