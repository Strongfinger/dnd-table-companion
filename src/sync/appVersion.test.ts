import { describe, expect, it } from 'vitest'
import { dmBuild, isOlderBuild, memberIsOutdated, parseBuild, playerNeedsUpdate } from './appVersion'
import type { Member } from './transport'

const OLD = '2026-10-22T10:00:00.000Z'
const NEW = '2026-11-03T12:00:00.000Z'
const member = (deviceId: string, role: 'dm' | 'player', build?: string | null, online = true): Member =>
  ({ deviceId, name: deviceId, role, characterId: null, characterName: null, online, build })

describe('parseBuild', () => {
  it('keeps an ISO date', () => expect(parseBuild(NEW)).toBe(NEW))
  it('drops missing, non-string, non-date or too-long values', () => {
    expect(parseBuild(undefined)).toBeNull()
    expect(parseBuild(123)).toBeNull()
    expect(parseBuild('not a date')).toBeNull()
    expect(parseBuild(NEW + 'x'.repeat(40))).toBeNull()
  })
})

describe('isOlderBuild', () => {
  it('older build is older', () => expect(isOlderBuild(OLD, NEW)).toBe(true))
  it('same or newer build is fine', () => {
    expect(isOlderBuild(NEW, NEW)).toBe(false)
    expect(isOlderBuild(NEW, OLD)).toBe(false)
  })
  it('a missing build counts as old (app from before this check)', () => {
    expect(isOlderBuild(undefined, NEW)).toBe(true)
    expect(isOlderBuild(null, NEW)).toBe(true)
  })
  it('nothing to compare with: not old', () => {
    expect(isOlderBuild(OLD, null)).toBe(false)
    expect(isOlderBuild(undefined, undefined)).toBe(false)
  })
})

describe('room checks', () => {
  it('dmBuild: only an online DM counts', () => {
    expect(dmBuild([member('p1', 'player', NEW), member('dm', 'dm', OLD)])).toBe(OLD)
    expect(dmBuild([member('dm', 'dm', NEW, false)])).toBeNull()
    expect(dmBuild([member('dm', 'dm')])).toBeNull()
  })
  it('player needs an update only when the DM is newer', () => {
    expect(playerNeedsUpdate([member('dm', 'dm', NEW)], OLD)).toBe(true)
    expect(playerNeedsUpdate([member('dm', 'dm', OLD)], NEW)).toBe(false)
    expect(playerNeedsUpdate([member('dm', 'dm', NEW)], NEW)).toBe(false)
    // DM on an app from before this check: no build to compare, so no banner.
    expect(playerNeedsUpdate([member('dm', 'dm')], OLD)).toBe(false)
    expect(playerNeedsUpdate([], OLD)).toBe(false)
  })
  it('DM list marks old or unknown player apps, never the DM row', () => {
    expect(memberIsOutdated(member('p1', 'player', OLD), NEW)).toBe(true)
    expect(memberIsOutdated(member('p2', 'player'), NEW)).toBe(true)
    expect(memberIsOutdated(member('p3', 'player', NEW), NEW)).toBe(false)
    expect(memberIsOutdated(member('dm', 'dm', OLD), NEW)).toBe(false)
  })
})
