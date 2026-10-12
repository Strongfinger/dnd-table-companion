// Apply play actions to a character the same way everywhere on the sheet (play panel, spell list):
// checked by the table's permissions, saved, shared with the DM in a live room, and logged.
import { useLobby } from '../app/useLobby'
import { logCharacterEvent } from '../db/log'
import { playAction } from '../db/play'
import type { Character } from '../model/character'
import type { CharacterAction } from '../model/characterActions'
import type { TurnInfo } from '../model/permissions'

export function useCharacterAct(c: Character) {
  const lobby = useLobby()
  // A player playing this character in a live room: they spend, the DM gives back and starts rests.
  const asPlayer = lobby.session?.role === 'player' && lobby.myCharacterIds.includes(c.id)
  // Where I am in the running fight (from the DM's live view): Action / Bonus Action only on my turn.
  const myCombatant = lobby.fight?.combatants.find((x) => x.pc?.characterId === c.id)
  const turn: TurnInfo = myCombatant ? { inFight: true, myTurn: myCombatant.active } : { inFight: false }
  const waitingForTurn = asPlayer && turn.inFight && !turn.myTurn

  /**
   * One action (see model/characterActions.ts): checked (src/model/permissions.ts), applied to the newest
   * saved copy, logged. In a live lobby a player's action also goes to the DM's device.
   * Returns the log line, or why it was refused.
   */
  async function act(action: CharacterAction): Promise<{ text: string | null; refused: string | null }> {
    const r = asPlayer
      ? await playAction(c.id, action, 'player', { turn, shortRest: !!lobby.shortRestSince })
      : await playAction(c.id, action, 'dm')
    if (r.refused) return r
    lobby.shareAction(c.id, action)
    // Also lands in the fight log if this character is in a running fight on this device.
    // (A player in a room gets the DM's log line instead, so the two logs stay the same.)
    if (r.text && !asPlayer) await logCharacterEvent(c.id, r.text)
    return r
  }

  return { act, asPlayer, turn, waitingForTurn, shortRest: !!lobby.shortRestSince }
}
