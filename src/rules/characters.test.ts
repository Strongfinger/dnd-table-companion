// Checks deriveSheet() against real paper sheets (see fixtures/characters.ts).
import { describe, expect, it } from 'vitest'
import { abilityModifier } from './abilities'
import { ALL_FIXTURES, type SheetFixture } from './fixtures/characters'
import { CLASS_HIT_DIE, maxHitPoints, maxHitPointsFromRolls } from './hp'
import { deriveSheet } from './sheet'
import type { Skill } from './skills'

describe.each(ALL_FIXTURES.map((c) => [`${c.name} (${c.className} ${c.level})`, c] as const))(
  '%s',
  (_label, c: SheetFixture) => {
    const sheet = deriveSheet(c)

    it('saving throws', () => {
      expect(sheet.saves).toEqual(c.expected.saves)
    })

    it('skills', () => {
      // Every proficient skill must have a printed value to compare against.
      for (const s of Object.keys(c.skills)) expect(c.expected.skills, s).toHaveProperty(s)
      for (const [s, bonus] of Object.entries(c.expected.skills)) expect(sheet.skills[s as Skill], s).toBe(bonus)
    })

    it('passive Perception, Insight, Investigation', () => {
      expect(sheet.passivePerception).toBe(c.expected.passivePerception)
      expect(sheet.passiveInsight).toBe(c.expected.passiveInsight)
      expect(sheet.passiveInvestigation).toBe(c.expected.passiveInvestigation)
    })

    it('initiative', () => {
      expect(sheet.initiative).toBe(c.expected.initiative)
    })

    it('max HP', () => {
      const die = CLASS_HIT_DIE[c.className]
      const con = abilityModifier(c.scores.con)
      const base = c.hpRolls ? maxHitPointsFromRolls(die, con, c.hpRolls) : maxHitPoints(die, c.level, con)
      expect(base + (c.hpBonusPerLevel ?? 0) * c.level).toBe(c.expected.maxHp)
    })

    it('attacks', () => {
      const byName = Object.fromEntries(sheet.attacks.map((a) => [a.name, { hit: a.hit, damage: a.damage }]))
      expect(byName).toEqual(c.expected.attacks)
    })

    it('spell save DC and attack', () => {
      expect(sheet.spellSaveDC).toBe(c.expected.spellSaveDC)
      expect(sheet.spellAttack).toBe(c.expected.spellAttack)
    })
  },
)
