// Room app-version check: each device puts its build time (__BUILD_TIME__, an ISO date set when
// the app was built) in its member record. A device whose build is older than the DM's is out of date.
import type { Member } from './transport'

/** Read a build value from a member record: an ISO date string, or null if missing or not a date. */
export function parseBuild(value: unknown): string | null {
  if (typeof value !== 'string' || value.length > 40) return null
  return Number.isNaN(Date.parse(value)) ? null : value
}

/**
 * True if `build` is older than `reference` (the DM's build), or unknown (an app from before this check).
 * False when the reference itself is unknown: then there is nothing to compare with.
 */
export function isOlderBuild(build: string | null | undefined, reference: string | null | undefined): boolean {
  const ref = parseBuild(reference)
  if (!ref) return false
  const own = parseBuild(build)
  return !own || Date.parse(own) < Date.parse(ref)
}

/** The online DM's build in the room, or null if no DM is online (or the DM's app is too old to say). */
export function dmBuild(members: Member[]): string | null {
  return parseBuild(members.find((m) => m.role === 'dm' && m.online)?.build)
}

/** For a player's device: true if the online DM runs a newer app than mine. */
export function playerNeedsUpdate(members: Member[], myBuild: string): boolean {
  return isOlderBuild(myBuild, dmBuild(members))
}

/** For the DM's list: true if this player's app is older than the DM's (or too old to say). */
export function memberIsOutdated(member: Member, myBuild: string): boolean {
  return member.role === 'player' && isOlderBuild(member.build, myBuild)
}
