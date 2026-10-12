// Apply a play change to a saved character with the table's permissions (src/model/permissions.ts).
// Every play change goes through here: the sheet, the tracker, and players' changes arriving at the DM's device.
import { applyCharacterAction, type CharacterAction } from '../model/characterActions'
import { playerMay, recordUses, refundAllowed, refundKeys, useKeys, type FightRound, type TurnInfo, type UseRounds } from '../model/permissions'
import { updateCharacter } from './characters'
import { db } from './db'
import { runningFightOf } from './encounters'

/** Settings key: when each use was spent (fight and round), so the DM can only give it back that round. */
const USES = 'useRounds'

/**
 * Who is asking:
 * - 'player': a player in a live room, for their own character (spend only; no give-backs, rests, new turn)
 * - 'dm': the DM's device, or any device outside a room (give-backs only in the round of the use)
 * - 'system': the app itself, e.g. the tracker starting someone's turn or ending a fight (no checks)
 */
export type Actor = 'player' | 'dm' | 'system'

/**
 * Returns the log line ('' = nothing to log) or why it was refused. Null text = character not found.
 * `turn`: where the character is in a fight, for a player's phone (which has no copy of the fight);
 * otherwise it's read from the fights on this device.
 */
export async function playAction(characterId: string, action: CharacterAction, actor: Actor, turn?: TurnInfo): Promise<{ text: string | null; refused: string | null }> {
  const running = await runningFightOf(characterId)
  const fight: FightRound = running && { id: running.id, round: running.round }
  const myTurn = !!running && running.combatants.some((c) => c.id === running.activeId && c.characterId === characterId)
  const turnInfo: TurnInfo = turn ?? (running ? { inFight: true, myTurn } : { inFight: false })
  let refused: string | null = null
  let spent: string[] = []
  const text = await db.transaction('rw', db.characters, db.settings, async () => {
    const uses = ((await db.settings.get(USES))?.value as UseRounds | undefined) ?? {}
    const r = await updateCharacter(characterId, (c) => {
      if (actor !== 'system') {
        const check = actor === 'player' ? playerMay(c, action, turnInfo) : refundAllowed(characterId, refundKeys(c, action), uses, fight)
        if (!check.ok) {
          refused = check.reason
          return { character: c, text: '' }
        }
      }
      spent = useKeys(c, action)
      return applyCharacterAction(c, action) ?? { character: c, text: '' }
    })
    if (spent.length && fight) await db.settings.put({ key: USES, value: recordUses(uses, characterId, spent, fight) })
    return r
  })
  return { text: refused ? '' : text, refused }
}
