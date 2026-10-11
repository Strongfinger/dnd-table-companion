import { describe, expect, it } from 'vitest'
import { createCharacter } from './character'
import { damageCharacter, healCharacter, tempHpCharacter } from './actions'

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
