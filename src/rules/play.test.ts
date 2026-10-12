import { describe, expect, it } from 'vitest'
import { rollDie } from './dice'
import {
  applyDamage, concentrationDC, exhaustionPenalty, gainTempHp, heal, hitDieHealing, hitDieSize, longRest, rollDeathSave,
  shortRest, spendHitDie, type HpState, type RestState,
} from './play'

const healthy: HpState = { hp: { max: 20, current: 20, temp: 0 }, deathSaves: { successes: 0, failures: 0 } }
const down: HpState = { hp: { max: 20, current: 0, temp: 0 }, deathSaves: { successes: 1, failures: 1 } }

describe('rollDie', () => {
  it('maps the random number to 1..sides', () => {
    expect(rollDie(20, () => 0)).toBe(1)
    expect(rollDie(20, () => 0.999)).toBe(20)
    expect(rollDie(6, () => 0.5)).toBe(4)
  })
})

describe('applyDamage', () => {
  it('takes temp HP first', () => {
    const r = applyDamage({ ...healthy, hp: { ...healthy.hp, temp: 5 } }, 8)
    expect(r.hp).toEqual({ max: 20, current: 17, temp: 0 })
  })

  it('never goes below 0 and reports dropping to 0', () => {
    const r = applyDamage(healthy, 25)
    expect(r.hp.current).toBe(0)
    expect(r.droppedToZero).toBe(true)
    expect(r.dead).toBe(false)
  })

  it('massive damage: leftover ≥ max HP kills outright', () => {
    expect(applyDamage(healthy, 40).dead).toBe(true) // 20 to reach 0, 20 left over
    expect(applyDamage(healthy, 39).dead).toBe(false)
  })

  it('damage at 0 HP is a death save failure, a Critical Hit two', () => {
    expect(applyDamage(down, 3).deathSaves).toEqual({ successes: 1, failures: 2 })
    expect(applyDamage(down, 3, true).deathSaves).toEqual({ successes: 1, failures: 3 })
    expect(applyDamage(down, 3, true).dead).toBe(true)
  })

  it('damage at 0 HP of at least max HP kills', () => {
    expect(applyDamage(down, 20).dead).toBe(true)
  })

  it('damage fully absorbed by temp HP at 0 HP causes no failure', () => {
    const r = applyDamage({ ...down, hp: { ...down.hp, temp: 5 } }, 3)
    expect(r.deathSaves.failures).toBe(1)
  })
})

describe('heal and temp HP', () => {
  it('heals up to max', () => {
    expect(heal({ ...healthy, hp: { ...healthy.hp, current: 15 } }, 10).hp.current).toBe(20)
  })

  it('healing at 0 HP resets death saves', () => {
    expect(heal(down, 1)).toEqual({ hp: { max: 20, current: 1, temp: 0 }, deathSaves: { successes: 0, failures: 0 } })
  })

  it('temp HP keeps the higher value', () => {
    const withTemp = gainTempHp(healthy, 8)
    expect(gainTempHp(withTemp, 5).hp.temp).toBe(8)
    expect(gainTempHp(withTemp, 10).hp.temp).toBe(10)
  })
})

describe('rollDeathSave', () => {
  it('10+ succeeds, 9- fails, 1 fails twice', () => {
    expect(rollDeathSave(down, 10).deathSaves).toEqual({ successes: 2, failures: 1 })
    expect(rollDeathSave(down, 9).deathSaves).toEqual({ successes: 1, failures: 2 })
    expect(rollDeathSave(down, 1).deathSaves).toEqual({ successes: 1, failures: 3 })
  })

  it('3 successes = stable, 3 failures = dead', () => {
    expect(rollDeathSave({ ...down, deathSaves: { successes: 2, failures: 0 } }, 15).outcome).toBe('stable')
    expect(rollDeathSave({ ...down, deathSaves: { successes: 0, failures: 2 } }, 5).outcome).toBe('dead')
  })

  it('a natural 20 regains 1 HP', () => {
    const r = rollDeathSave(down, 20)
    expect(r.outcome).toBe('revived')
    expect(r.hp.current).toBe(1)
    expect(r.deathSaves).toEqual({ successes: 0, failures: 0 })
  })
})

describe('concentrationDC', () => {
  it('is half the damage, min 10, max 30', () => {
    expect(concentrationDC(7)).toBe(10)
    expect(concentrationDC(25)).toBe(12)
    expect(concentrationDC(100)).toBe(30)
  })
})

describe('exhaustionPenalty', () => {
  it('is −2 per level to D20 Tests and −5 ft. per level', () => {
    expect(exhaustionPenalty(0)).toEqual({ d20: 0, speed: 0 })
    expect(exhaustionPenalty(3)).toEqual({ d20: 6, speed: 15 })
  })
})

const fighter: RestState = {
  className: 'Fighter',
  level: 3,
  hp: { max: 28, current: 10, temp: 4 },
  deathSaves: { successes: 0, failures: 0 },
  hitDiceSpent: 1,
  exhaustion: 2,
  spellSlots: [{ max: 0, used: 0 }],
  features: [
    { id: 'sw', name: 'Second Wind', max: 2, used: 2, recharge: 'long' },
    { id: 'as', name: 'Action Surge', max: 1, used: 1, recharge: 'short' },
    { id: 'cd', name: 'Rage', max: 3, used: 3, recharge: 'shortOne' },
  ],
}

describe('rests', () => {
  it('Short Rest restores "short" features, gives one use of "shortOne" features back (2024)', () => {
    const r = shortRest(fighter)
    expect(r.features.map((f) => f.used)).toEqual([2, 0, 2])
    expect(shortRest(r).features[2].used).toBe(1)
    // Never below zero.
    expect(shortRest({ ...fighter, features: [{ ...fighter.features[2], used: 0 }] }).features[0].used).toBe(0)
    expect(r.hp).toEqual(fighter.hp)
  })

  it('Warlock Pact slots come back on a Short Rest; a Wizard\'s don\'t', () => {
    const slots = [{ max: 2, used: 2 }]
    expect(shortRest({ ...fighter, className: 'Warlock', spellSlots: slots }).spellSlots[0].used).toBe(0)
    expect(shortRest({ ...fighter, className: 'Wizard', spellSlots: slots }).spellSlots[0].used).toBe(2)
  })

  it('spending a Hit Die heals roll + Con and uses one die', () => {
    const r = spendHitDie(fighter, 6, 14)!
    expect(r.hp.current).toBe(18)
    expect(r.hitDiceSpent).toBe(2)
    expect(spendHitDie({ ...fighter, hitDiceSpent: 3 }, 6, 14)).toBeNull()
  })

  it('a Hit Die never heals a negative amount', () => {
    expect(hitDieHealing(1, 6)).toBe(0) // 1 + (−2)
  })

  it('Long Rest: full HP, all Hit Dice, slots and features, Exhaustion −1, temp HP gone', () => {
    const r = longRest({ ...fighter, spellSlots: [{ max: 2, used: 1 }] })!
    expect(r.hp).toEqual({ max: 28, current: 28, temp: 0 })
    expect(r.hitDiceSpent).toBe(0)
    expect(r.exhaustion).toBe(1)
    expect(r.spellSlots[0].used).toBe(0)
    expect(r.features.every((f) => f.used === 0)).toBe(true)
  })

  it('no Long Rest benefit at 0 HP', () => {
    expect(longRest({ ...fighter, hp: { ...fighter.hp, current: 0 } })).toBeNull()
  })
})

describe('death save resets', () => {
  it('dropping to 0 HP starts fresh death saves', () => {
    const old = { ...healthy, deathSaves: { successes: 2, failures: 2 } }
    expect(applyDamage(old, 30).deathSaves).toEqual({ successes: 0, failures: 0 })
  })

  it('a Stable creature that takes damage starts dying again', () => {
    const stable = { ...down, deathSaves: { successes: 3, failures: 1 } }
    expect(applyDamage(stable, 2).deathSaves).toEqual({ successes: 0, failures: 1 })
  })

  it('a Critical Hit from 2 failures kills', () => {
    const r = applyDamage({ ...down, deathSaves: { successes: 0, failures: 2 } }, 1, true)
    expect(r.deathSaves.failures).toBe(3)
    expect(r.dead).toBe(true)
  })

  it('no Hit Dice at 0 HP', () => {
    expect(spendHitDie({ ...fighter, hp: { ...fighter.hp, current: 0 } }, 6, 14)).toBeNull()
  })
})

describe('hitDieSize', () => {
  it('from the class, or the stat block for a monster', () => {
    expect(hitDieSize({ className: 'Wizard' })).toBe(6)
    expect(hitDieSize({ className: 'Fighter', monster: { hitDie: 12 } })).toBe(12)
  })
})
