// Checks the rules engine against real paper sheets (see fixtures/characters.ts).
import { describe, expect, it } from 'vitest'
import { abilityModifier } from './abilities'
import { attackBonus, initiativeBonus } from './combat'
import { ALL_FIXTURES, type SheetFixture } from './fixtures/characters'
import { CLASS_HIT_DIE, maxHitPoints, maxHitPointsFromRolls } from './hp'
import { proficiencyBonus } from './proficiency'
import { checkBonus, passiveScore, SKILL_ABILITY, type Skill } from './skills'
import { spellAttackBonus, spellSaveDC } from './spellcasting'
import { ABILITIES, type Ability } from './types'

describe.each(ALL_FIXTURES.map((c) => [`${c.name} (${c.className} ${c.level})`, c] as const))(
  '%s',
  (_label, c: SheetFixture) => {
    const mod = (a: Ability) => abilityModifier(c.scores[a])
    const prof = proficiencyBonus(c.level)
    const save = (a: Ability) => checkBonus(mod(a), c.saveProficiencies.includes(a) ? 'proficient' : 'none', prof)
    const skill = (s: Skill) => checkBonus(mod(SKILL_ABILITY[s]), c.skills[s] ?? 'none', prof)

    it('saving throws', () => {
      for (const a of ABILITIES) expect(save(a), a).toBe(c.expected.saves[a])
    })

    it('skills', () => {
      // Every proficient skill must have a printed value to compare against.
      for (const s of Object.keys(c.skills)) expect(c.expected.skills, s).toHaveProperty(s)
      for (const [s, bonus] of Object.entries(c.expected.skills)) expect(skill(s as Skill), s).toBe(bonus)
    })

    it('passive Perception, Insight, Investigation', () => {
      expect(passiveScore(skill('Perception'))).toBe(c.expected.passivePerception)
      expect(passiveScore(skill('Insight'))).toBe(c.expected.passiveInsight)
      expect(passiveScore(skill('Investigation'))).toBe(c.expected.passiveInvestigation)
    })

    it('initiative', () => {
      expect(initiativeBonus(mod('dex'), c.initiativeExtra)).toBe(c.expected.initiative)
    })

    it('max HP', () => {
      const die = CLASS_HIT_DIE[c.className]
      const base = c.hpRolls
        ? maxHitPointsFromRolls(die, mod('con'), c.hpRolls)
        : maxHitPoints(die, c.level, mod('con'))
      expect(base + (c.hpBonusPerLevel ?? 0) * c.level).toBe(c.expected.maxHp)
    })

    it('weapon attack bonuses', () => {
      for (const atk of c.attacks) {
        expect(attackBonus(mod(atk.ability), prof, true), atk.name).toBe(c.expected.attackHit[atk.name])
      }
    })

    if (c.spellcastingAbility) {
      it('spell save DC and attack', () => {
        const castMod = mod(c.spellcastingAbility!)
        expect(spellSaveDC(prof, castMod)).toBe(c.expected.spellSaveDC)
        expect(spellAttackBonus(prof, castMod)).toBe(c.expected.spellAttack)
      })
    }
  },
)
