import { describe, expect, it } from 'vitest'
import { DATA_VERSION, isCompatibleVersion, newerOf, stamp, type SyncMeta } from './sync'

const rec = (rev: number, updatedAt: number, updatedBy: string): SyncMeta & { v: string } => ({ rev, updatedAt, updatedBy, v: `${rev}-${updatedBy}` })

describe('sync bookkeeping', () => {
  it('stamp bumps the revision and records who and when', () => {
    expect(stamp(rec(3, 0, 'a'), 'dm', 99)).toMatchObject({ rev: 4, updatedBy: 'dm', updatedAt: 99 })
  })

  it('newerOf: higher revision, then later time, then device id', () => {
    expect(newerOf(rec(2, 0, 'a'), rec(5, 0, 'b')).v).toBe('5-b')
    expect(newerOf(rec(5, 10, 'a'), rec(5, 20, 'b')).v).toBe('5-b')
    // Same revision and time: both devices pick the same winner either way round.
    expect(newerOf(rec(5, 10, 'a'), rec(5, 10, 'b')).v).toBe(newerOf(rec(5, 10, 'b'), rec(5, 10, 'a')).v)
  })

  it('only the same data version is compatible', () => {
    expect(isCompatibleVersion(DATA_VERSION)).toBe(true)
    expect(isCompatibleVersion(DATA_VERSION + 1)).toBe(false)
    expect(isCompatibleVersion('2')).toBe(false)
  })
})
