import { describe, expect, it } from 'vitest'
import { findLimitedFeature } from '../rules'
import { createCharacter } from './character'
import { applyCharacterAction } from './characterActions'
import { addCatalogFeature, addNewlyAvailable, featuresToAdd, planFeatureUse, refreshCatalogFeatures, withAllCatalogFeatures } from './featureCatalog'
import { playerMay } from './permissions'

const fighter = (level = 2) => createCharacter({ name: 'Bram', className: 'Fighter', level, species: 'Human', scores: { str: 16, dex: 12, con: 14, int: 10, wis: 10, cha: 8 } })
const withAll = (level = 2) => featuresToAdd(fighter(level)).reduce((c, f) => addCatalogFeature(c, f), fighter(level))

describe('feature catalog on the sheet', () => {
  it('adds the features a Fighter 2 has, once', () => {
    const c = withAll()
    expect(c.features.map((f) => [f.name, f.max, f.recharge])).toEqual([['Second Wind', 2, 'shortOne'], ['Action Surge', 1, 'short']])
    expect(featuresToAdd(c)).toEqual([])
    expect(addCatalogFeature(c, findLimitedFeature('fighter-second-wind')!)).toBe(c)
  })

  it('keeps uses in step with level, without giving back spent uses beyond the new max', () => {
    const c = { ...withAll(), level: 4 }
    expect(refreshCatalogFeatures(c).features[0].max).toBe(3)
    const spent = { ...withAll(), features: withAll().features.map((f) => ({ ...f, used: f.max })) }
    expect(refreshCatalogFeatures({ ...spent, level: 1 }).features[0]).toMatchObject({ max: 2, used: 2 })
  })

  it('Second Wind spends a use and the Bonus Action', () => {
    const c = withAll()
    const plan = planFeatureUse(c, c.features[0].id)
    expect(plan.actions).toEqual([
      { type: 'setActionUsed', kind: 'bonusAction', used: true, detail: 'Second Wind' },
      { type: 'setFeatureUsed', featureId: c.features[0].id, used: 1 },
    ])
    // Bonus Action already used: warn, still spend the use.
    const busy = { ...c, turn: { ...c.turn, bonusAction: true } }
    expect(planFeatureUse(busy, c.features[0].id)).toMatchObject({ warnings: ['Bonus Action ของเทิร์นนี้ใช้ไปแล้ว'] })
  })

  it('Action Surge gives the Action back, also for a player in a room (on their turn)', () => {
    const c = withAll()
    const used = { ...c, turn: { ...c.turn, action: true } }
    const surge = c.features[1].id
    const [a] = planFeatureUse(used, surge).actions
    expect(a).toEqual({ type: 'actionSurge', featureId: surge })
    const r = applyCharacterAction(used, a)!
    expect(r.character.turn.action).toBe(false)
    expect(r.character.features[1].used).toBe(1)
    expect(playerMay(used, a, { turn: { inFight: true, myTurn: true }, shortRest: false }).ok).toBe(true)
    expect(playerMay(used, a, { turn: { inFight: true, myTurn: false }, shortRest: false }).ok).toBe(false)
    // None left.
    expect(applyCharacterAction(r.character, a)).toBeNull()
    expect(planFeatureUse(r.character, surge).error).toBe('เหลือ 0/1 ไม่พอ')
  })

  it('pools spend any amount', () => {
    const pally = addCatalogFeature(createCharacter({ name: 'Ser', className: 'Paladin', level: 3 }), findLimitedFeature('paladin-lay-on-hands')!)
    const id = pally.features[0].id
    expect(planFeatureUse(pally, id, 7).actions.at(-1)).toEqual({ type: 'setFeatureUsed', featureId: id, used: 7 })
    expect(planFeatureUse(pally, id, 16).error).toBe('เหลือ 15/15 ไม่พอ')
  })

  it('a level-up adds the features that just became available, not ones removed on purpose', () => {
    const lvl1 = withAllCatalogFeatures(fighter(1))
    expect(lvl1.features.map((f) => f.name)).toEqual(['Second Wind'])
    const removed = { ...lvl1, features: [] }
    const lvl2 = addNewlyAvailable(removed, { ...removed, level: 2 })
    expect(lvl2.features.map((f) => f.name)).toEqual(['Action Surge'])
  })
})
