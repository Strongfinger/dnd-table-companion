// Character sheet sync in a live lobby (Phase 4.2). The DM device is the source of truth:
//   player → DM  'hello'  { character }            the full sheet: on join, reconnect and after edits
//   player → DM  'action' { characterId, action }  one play change (damage, slot, condition...)
//   DM → all     'state'  { character }            the DM's copy after any change to a played character
// The helpers here are pure; the lobby provider (src/app/lobby.tsx) does the sending and saving.
import type { Character } from '../model/character'
import { parseCharacterAction, type CharacterAction } from '../model/characterActions'
import { parseCharacterImport } from '../model/io'
import type { Member } from './transport'

/** A full sheet from another device, checked like an imported file (network data is untrusted). */
export function parseSheetBody(body: unknown): Character | null {
  if (typeof body !== 'object' || body === null) return null
  const character = (body as Record<string, unknown>).character
  if (typeof character !== 'object' || character === null) return null
  const r = parseCharacterImport(JSON.stringify(character))
  // The id must survive: a sheet with a bad id would become a new character.
  return r.ok && r.character.id === (character as Record<string, unknown>).id ? r.character : null
}

export function parseActionBody(body: unknown): { characterId: string; action: CharacterAction } | null {
  if (typeof body !== 'object' || body === null) return null
  const b = body as Record<string, unknown>
  const action = parseCharacterAction(b.action)
  return typeof b.characterId === 'string' && b.characterId.length <= 64 && action ? { characterId: b.characterId, action } : null
}

/**
 * Players may only change their own character: the one they picked in the room.
 * (The member list comes from the connection, so a message can't claim to be someone else.)
 */
export function mayChange(members: Member[], senderId: string, characterId: string): boolean {
  return members.some((m) => m.deviceId === senderId && m.role === 'player' && m.characterId === characterId)
}

/**
 * The DM got a player's full sheet: take it, or keep the DM's copy?
 * Every change raises the revision on both devices (the player stores the DM's copy as it is),
 * so a higher revision means changes the DM hasn't seen (an edit, or play while offline).
 * A tie keeps the DM's copy: it already holds the same actions.
 */
export function takeIncomingSheet(stored: Pick<Character, 'rev'> | undefined, incoming: Pick<Character, 'rev'>): boolean {
  return !stored || incoming.rev > stored.rev
}

/**
 * A player got the DM's copy of their character: use it unless it's older than what this device has
 * (an earlier message still on its way). The DM's copy is never older than a sheet the DM accepted.
 */
export function takeDmState(stored: Pick<Character, 'rev'> | undefined, incoming: Pick<Character, 'rev'>): boolean {
  return !stored || incoming.rev >= stored.rev
}

/** Characters played in the room right now (DM side): picked by a player who wasn't removed. */
export function playedCharacterIds(members: Member[], isRemoved: (deviceId: string) => boolean): string[] {
  const ids = members.filter((m) => m.role === 'player' && m.characterId && !isRemoved(m.deviceId)).map((m) => m.characterId!)
  return [...new Set(ids)].sort()
}
