import { describe, expect, it } from 'vitest'
import { checkIncomingLevel, grantLevelUp, lockLevel, mayLevelUp, revokeLevelUp, spendGrant } from './levelLock'

const pc = (level: number, granted?: number) => ({ level, ...(granted === undefined ? {} : { levelLock: { granted } }) })

describe('mayLevelUp', () => {
  it('free until locked; locked needs a grant, except on the device that runs the campaign', () => {
    expect(mayLevelUp(pc(3), false)).toBe(true)
    expect(mayLevelUp(pc(3, 0), false)).toBe(false)
    expect(mayLevelUp(pc(3, 1), false)).toBe(true)
    expect(mayLevelUp(pc(3, 0), true)).toBe(true)
  })
})

describe('grant, spend, revoke', () => {
  it('a grant is one level; pressing twice doesn\'t add more; levelling up uses it', () => {
    expect(grantLevelUp(grantLevelUp(lockLevel(pc(3))))).toEqual(pc(3, 1))
    expect(spendGrant(pc(3, 1), pc(4, 1))).toEqual(pc(4, 0))
    expect(spendGrant(pc(3), pc(4))).toEqual(pc(4)) // never locked: nothing to spend
    expect(revokeLevelUp(pc(3, 1))).toEqual(pc(3, 0))
    expect(lockLevel(pc(3, 1))).toEqual(pc(3, 1)) // locking again keeps the grant
  })
})

describe('checkIncomingLevel (DM device)', () => {
  it('locks a sheet it has never seen, as it is (whatever lock it claims)', () => {
    expect(checkIncomingLevel(undefined, pc(5, 1))).toEqual(pc(5, 0))
  })

  it('refuses a level the DM didn\'t allow; a granted level uses the grant', () => {
    expect(checkIncomingLevel(pc(3, 0), pc(4, 0))).toBeNull()
    expect(checkIncomingLevel(pc(3, 1), pc(5, 0))).toBeNull()
    expect(checkIncomingLevel(pc(3, 1), pc(4, 1))).toEqual(pc(4, 0)) // the phone can't keep the grant
    expect(checkIncomingLevel(pc(3, 1), pc(3, 0))).toEqual(pc(3, 1)) // not used yet: the DM's grant stays
  })

  it('a DM copy from before the lock counts as locked', () => {
    expect(checkIncomingLevel(pc(3), pc(4))).toBeNull()
    expect(checkIncomingLevel(pc(3), pc(3))).toEqual(pc(3, 0))
  })
})
