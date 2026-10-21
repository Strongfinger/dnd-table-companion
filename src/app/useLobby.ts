// The live lobby's shared context (the provider is in lobby.tsx). Separate file so React's
// fast refresh keeps working while editing the provider.
import { createContext, useContext } from 'react'
import type { CharacterAction } from '../model/characterActions'
import type { PlayerEncounterView } from '../model/playerView'
import type { RollEvent } from '../model/rollEvent'
import type { Envelope, MessageKind } from '../sync/envelope'
import type { FightSummary, PlayerLogEntry } from '../sync/fights'
import type { LobbySession } from '../sync/lobby'
import type { PartyCard } from '../sync/party'
import type { CoinRequest, PoolItem } from '../model/rewards'
import type { GiveRequest } from '../model/give'
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
  /** Player: the DM's started fights (read-only) and their player-safe log lines. */
  fightList: FightSummary[]
  fightLogs: Record<string, PlayerLogEntry[]>
  /** Player: read-only cards of every character played in the room (from the DM's device). */
  party: PartyCard[]
  /** Dice rolls shared in the room this session, newest first (mine included). */
  rolls: RoomRoll[]
  /** Set when the DM removed this device from the room. */
  kickedNotice: string | null
  create: (campaignId: string, local: boolean) => void
  /** DM: the room this device hosted last (after leaving it), or null. */
  lastHosted: LobbySession | null
  /** DM: every character played in the room right now (players' picks and handed-over characters). */
  playedIds: string[]
  /** DM: open the last hosted room again with the same code, campaign and players. */
  rejoinLast: () => void
  /** Player: the DM's reward pool right now (null until the DM's device has sent it). */
  pool: PoolItem[] | null
  /** Player: the DM's coin requests list (open and recently decided; the screen shows my characters'). */
  coinRequests: CoinRequest[]
  /** Player: take items from the pool for my character (the DM's device gives what is still there). */
  takeFromPool: (characterId: string, itemId: string, qty: number) => void
  /** Player: ask the DM to add or take coins from my character. */
  requestCoins: (characterId: string, request: Pick<CoinRequest, 'kind' | 'coin' | 'amount' | 'note'>) => void
  /** Player: hand an item or coins from my character to another one in the room (the DM's device moves it). */
  give: (request: GiveRequest) => void
  /** Player: every character this device plays in the room (the picked one + any the DM handed over). */
  myCharacterIds: string[]
  /** DM: hand a character to a player's device (null = take it back). */
  grant: (characterId: string, deviceId: string | null) => void
  /** The room's campaign: the DM's choice (players get it from the DM), or null. */
  campaignId: string | null
  /** DM: switch the room to another campaign (players' phones follow it). */
  setCampaign: (campaignId: string) => Promise<void>
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
  /** When the party's short rest started (players may spend Hit Dice until the DM ends it), or null. */
  shortRestSince: number | null
  /** DM: start the party's short rest. */
  startShortRest: () => Promise<void>
  /** DM: end it: short-rest abilities come back. Returns who rested and who couldn't. */
  endShortRest: () => Promise<{ rested: string[]; skipped: string[] }>
  /** Player: end my character's turn in the running fight (the DM's device checks it's really my turn). */
  endTurn: () => void
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
