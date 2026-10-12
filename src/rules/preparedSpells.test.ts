import { describe, expect, it } from 'vitest'
import { spellLimits } from './preparedSpells'

describe('spellLimits (2024 class tables)', () => {
  it('full casters', () => {
    expect(spellLimits('Wizard', 1)).toEqual({ cantrips: 3, prepared: 4 })
    expect(spellLimits('Wizard', 5)).toEqual({ cantrips: 4, prepared: 9 })
    expect(spellLimits('Wizard', 20)).toEqual({ cantrips: 5, prepared: 25 })
    expect(spellLimits('Cleric', 4)).toEqual({ cantrips: 4, prepared: 7 })
    expect(spellLimits('Bard', 10)).toEqual({ cantrips: 4, prepared: 15 })
    expect(spellLimits('Druid', 3)).toEqual({ cantrips: 2, prepared: 6 })
    expect(spellLimits('Sorcerer', 2)).toEqual({ cantrips: 4, prepared: 4 })
  })

  it('half casters have no cantrips; Warlocks follow their own table', () => {
    expect(spellLimits('Paladin', 1)).toEqual({ cantrips: 0, prepared: 2 })
    expect(spellLimits('Ranger', 17)).toEqual({ cantrips: 0, prepared: 14 })
    expect(spellLimits('Warlock', 1)).toEqual({ cantrips: 2, prepared: 2 })
    expect(spellLimits('Warlock', 20)).toEqual({ cantrips: 4, prepared: 15 })
  })

  it('classes without spellcasting have none; levels are checked', () => {
    expect(spellLimits('Fighter', 5)).toBeNull()
    expect(() => spellLimits('Wizard', 21)).toThrow()
  })

  it('every table has 20 levels and never goes down', () => {
    for (const cls of ['Bard', 'Cleric', 'Druid', 'Paladin', 'Ranger', 'Sorcerer', 'Warlock', 'Wizard'] as const) {
      let last = 0
      for (let lvl = 1; lvl <= 20; lvl++) {
        const p = spellLimits(cls, lvl)!.prepared
        expect(p).toBeGreaterThanOrEqual(last)
        last = p
      }
    }
  })
})

describe('spellLimits: full tables', () => {
  const prepared = (cls: Parameters<typeof spellLimits>[0]) => Array.from({ length: 20 }, (_, i) => spellLimits(cls, i + 1)!.prepared)
  it('prepared spells by level 1–20', () => {
    expect(prepared('Wizard')).toEqual([4, 5, 6, 7, 9, 10, 11, 12, 14, 15, 16, 16, 17, 18, 19, 21, 22, 23, 24, 25])
    expect(prepared('Sorcerer')).toEqual([2, 4, 6, 7, 9, 10, 11, 12, 14, 15, 16, 16, 17, 17, 18, 18, 19, 20, 21, 22])
    expect(prepared('Warlock')).toEqual([2, 3, 4, 5, 6, 7, 8, 9, 10, 10, 11, 11, 12, 12, 13, 13, 14, 14, 15, 15])
    expect(prepared('Paladin')).toEqual([2, 3, 4, 5, 6, 6, 7, 7, 9, 9, 10, 10, 11, 11, 12, 12, 14, 14, 15, 15])
    expect(prepared('Cleric')).toEqual([4, 5, 6, 7, 9, 10, 11, 12, 14, 15, 16, 16, 17, 17, 18, 18, 19, 20, 21, 22])
  })

  it('cantrips step up at levels 4 and 10', () => {
    for (const [cls, steps] of [['Bard', [2, 3, 4]], ['Cleric', [3, 4, 5]], ['Druid', [2, 3, 4]], ['Sorcerer', [4, 5, 6]], ['Warlock', [2, 3, 4]], ['Wizard', [3, 4, 5]]] as const) {
      expect([3, 4, 9, 10].map((l) => spellLimits(cls, l)!.cantrips)).toEqual([steps[0], steps[1], steps[1], steps[2]])
    }
  })
})
