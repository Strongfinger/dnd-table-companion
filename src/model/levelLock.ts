// Level-up permission (owner decision, 2026-10-13): once a character has been played in a live room, only the
// DM decides when it goes up a level, on every device, even offline at home.
// - The DM's device puts a lock on the sheet (`levelLock`) the first time a player's character arrives.
// - The DM allows one level at a time (`granted`: 0 or 1), per player, from the room screen.
// - The player's ⬆️ shows only with a grant; finishing the level up uses it.
// - The DM's device also checks every sheet a player sends: above the allowed level, it is refused.
// The DM's own device may always level characters in the campaigns it runs.
import type { Character } from './character'

type Locked = Pick<Character, 'level' | 'levelLock'>

/** May this device level the character up now? `campaignDm`: this device runs the character's campaign. */
export function mayLevelUp(c: Pick<Character, 'levelLock'>, campaignDm: boolean): boolean {
  return campaignDm || !c.levelLock || c.levelLock.granted > 0
}

/** The DM's device puts the lock on (once; an existing grant is kept). */
export function lockLevel<T extends Locked>(c: T): T {
  return c.levelLock ? c : { ...c, levelLock: { granted: 0 } }
}

/** The DM allows one level up (pressing again doesn't add more). */
export function grantLevelUp<T extends Locked>(c: T): T {
  return { ...c, levelLock: { granted: 1 } }
}

/** The DM takes back a permission not used yet (pressed by mistake). */
export function revokeLevelUp<T extends Locked>(c: T): T {
  return { ...c, levelLock: { granted: 0 } }
}

/** After `before` became `after` on this device: levels gained use up the grant. */
export function spendGrant<T extends Locked>(before: Locked, after: T): T {
  if (!before.levelLock) return after
  const gained = Math.max(0, after.level - before.level)
  return { ...after, levelLock: { granted: Math.max(0, before.levelLock.granted - gained) } }
}

/**
 * DM device: a player's sheet came in. Null = refused (it is above the level the DM allowed). Otherwise the
 * sheet with the DM's lock on it, the grant used up by any levels gained. (A sheet the DM's device has never
 * seen gets locked as it is.)
 */
export function checkIncomingLevel<T extends Locked>(dm: Locked | undefined, incoming: T): T | null {
  if (!dm) return lockLevel({ ...incoming, levelLock: undefined })
  const lock = dm.levelLock ?? { granted: 0 }
  if (incoming.level > dm.level + lock.granted) return null
  return spendGrant({ level: dm.level, levelLock: lock }, incoming)
}
