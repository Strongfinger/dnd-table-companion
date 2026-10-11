import { describe, expect, it } from 'vitest'
import { createCharacter } from './character'
import { damageCharacter, deathSaveCharacter, healCharacter, isDead, reviveCharacter, tempHpCharacter } from './actions'

const boom = createCharacter({ name: 'Boom', hp: { max: 19, current: 19, temp: 0 }, concentration: 'Bless' })

describe('character HP actions', () => {
  it('damage reminds about Concentration', () => {
    const r = damageCharacter(boom, 7)
    expect(r.character.hp.current).toBe(12)
    expect(r.text).toContain('DC 10')
  })

  it('dropping to 0 adds Unconscious and ends Concentration', () => {
    const r = damageCharacter(boom, 25)
    expect(r.character.conditions).toContain('Unconscious')
    expect(r.character.concentration).toBe('')
    expect(r.text).toContain('หลุด')
  })

  it('healing from 0 removes Unconscious', () => {
    const down = damageCharacter(boom, 25).character
    const r = healCharacter(down, 5)
    expect(r.character.hp.current).toBe(5)
    expect(r.character.conditions).not.toContain('Unconscious')
  })

  it('temp HP does not stack', () => {
    const withTemp = tempHpCharacter(boom, 8).character
    expect(tempHpCharacter(withTemp, 5).text).toContain('ไม่ซ้อนกัน')
  })
})

describe('dying and death', () => {
  const down = { ...boom, concentration: '', hp: { max: 19, current: 0, temp: 0 }, deathSaves: { successes: 0, failures: 1 } }

  it('temp HP absorbing all damage at 0 HP adds no failure and says none', () => {
    const r = damageCharacter({ ...down, hp: { ...down.hp, temp: 5 } }, 3)
    expect(r.character.deathSaves.failures).toBe(1)
    expect(r.text).not.toContain('Death Save ล้มเหลว')
  })

  it('death saves are recorded with how they were rolled', () => {
    expect(deathSaveCharacter(down, 7, true).text).toContain('ทอยเอง 7')
    expect(deathSaveCharacter(down, 20, false).character.hp.current).toBe(1)
  })

  it('a dead character cannot be healed, but can be revived with 1 HP', () => {
    const dead = { ...down, deathSaves: { successes: 0, failures: 3 }, conditions: ['Unconscious' as const] }
    expect(isDead(dead)).toBe(true)
    expect(healCharacter(dead, 10).character.hp.current).toBe(0)
    const back = reviveCharacter(dead).character
    expect(back.hp.current).toBe(1)
    expect(back.deathSaves).toEqual({ successes: 0, failures: 0 })
    expect(back.conditions).toEqual([])
  })
})
