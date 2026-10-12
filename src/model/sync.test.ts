import { describe, expect, it } from 'vitest'
import { DATA_VERSION, isCompatibleVersion, isValidSyncMeta, mergeDraft, newerOf, stamp, type SyncMeta } from './sync'

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

describe('bad bookkeeping from old records or other devices', () => {
  it('stamp treats a missing or broken revision as 0', () => {
    expect(stamp({ ...rec(0, 0, 'a'), rev: Number.NaN }, 'dm', 1).rev).toBe(1)
  })

  it('isValidSyncMeta rejects nonsense', () => {
    expect(isValidSyncMeta({ rev: 3, updatedAt: 1, updatedBy: 'x' })).toBe(true)
    for (const v of [{ rev: -1, updatedAt: 1, updatedBy: 'x' }, { rev: 1e12, updatedAt: 1, updatedBy: 'x' }, { rev: 1, updatedAt: Infinity, updatedBy: 'x' }, { rev: 1, updatedAt: 1 }]) {
      expect(isValidSyncMeta(v), JSON.stringify(v)).toBe(false)
    }
  })
})

describe('mergeDraft', () => {
  const original = { name: 'Nyx', notes: '', hp: { max: 10, current: 10, temp: 0 }, conditions: [] as string[] }
  it('keeps changes made elsewhere in fields the form did not touch', () => {
    const draft = { ...original, notes: 'new notes', hp: { ...original.hp, max: 12 } }
    const latest = { ...original, hp: { max: 10, current: 4, temp: 2 }, conditions: ['Prone'] }
    expect(mergeDraft(original, draft, latest)).toEqual({ name: 'Nyx', notes: 'new notes', hp: { max: 12, current: 4, temp: 2 }, conditions: ['Prone'] })
  })

  it('a field changed in the form wins', () => {
    const draft = { ...original, conditions: ['Poisoned'] }
    const latest = { ...original, conditions: ['Prone'] }
    expect(mergeDraft(original, draft, latest).conditions).toEqual(['Poisoned'])
  })
})
