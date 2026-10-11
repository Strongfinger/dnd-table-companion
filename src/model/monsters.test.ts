import { describe, expect, it } from 'vitest'
import { xpMatchesCR } from '../rules'
import { formatCR, loadSrdMonsters, monsterInput, rollMonsterHp, searchMonsters } from './monsters'

describe('SRD monster data', async () => {
  const all = await loadSrdMonsters()
  const byName = (name: string) => all.find((m) => m.name === name)!

  it('has 341 monsters with sane values and unique ids', () => {
    expect(all).toHaveLength(341)
    expect(new Set(all.map((m) => m.id)).size).toBe(341)
    for (const m of all) {
      expect(m.ac, m.name).toBeGreaterThan(0)
      expect(m.hp, m.name).toBeGreaterThan(0)
      expect(m.scores, m.name).toHaveLength(6)
    }
  })

  it('every monster\'s XP matches its CR (Archmage corrected to 8,400)', () => {
    for (const m of all) expect(xpMatchesCR(m.cr, m.xp), `${m.name} CR ${m.cr} XP ${m.xp}`).toBe(true)
    expect(byName('Archmage')).toMatchObject({ cr: 12, xp: 8400 })
  })

  it('spot-checks against the SRD stat blocks', () => {
    expect(byName('Wolf')).toMatchObject({ ac: 12, hp: 11, cr: 0.25 })
    expect(byName('Ogre')).toMatchObject({ ac: 11, hp: 68, cr: 2, xp: 450 })
    expect(byName('Young Red Dragon')).toMatchObject({ ac: 18, hp: 178, cr: 10 })
    expect(byName('Lich')).toMatchObject({ ac: 20, hp: 315, cr: 21, xp: 33000 })
  })

  it('a tiny monster with a negative HP modifier never rolls below 1 HP', () => {
    const tiny = all.find((m) => /-\s*\d+$/.test(m.hpRoll))!
    expect(rollMonsterHp(tiny, () => 0)).toBe(1)
  })

  it('Goblin Warrior matches the stat block', () => {
    expect(byName('Goblin Warrior')).toMatchObject({ ac: 15, hp: 10, hpRoll: '3d6', cr: 0.25, xp: 50 })
    expect(monsterInput(byName('Goblin Warrior'))).toEqual({ name: 'Goblin Warrior', ac: 15, hpMax: 10, initBonus: 2, dexMod: 2 })
  })

  it('search by name or type, lower CR first, with a CR limit', () => {
    const goblins = searchMonsters(all, 'goblin')
    expect(goblins[0].name).toBe('Goblin Minion')
    expect(goblins.map((m) => m.name)).toContain('Goblin Boss')
    expect(searchMonsters(all, 'dragon', 2).every((m) => m.cr <= 2)).toBe(true)
    expect(searchMonsters(all, 'GOBLIN')).toEqual(goblins)
  })

  it('rolls HP from the dice, average when the dice are missing', () => {
    const boss = byName('Goblin Boss') // 6d6
    expect(rollMonsterHp(boss, () => 0)).toBe(6) // all 1s
    expect(rollMonsterHp(boss, () => 0.999)).toBe(36) // all 6s
    expect(rollMonsterHp({ ...boss, hpRoll: '' })).toBe(21)
  })
})

describe('formatCR', () => {
  it('shows fractions', () => {
    expect([0, 0.125, 0.25, 0.5, 1, 17].map(formatCR)).toEqual(['0', '1/8', '1/4', '1/2', '1', '17'])
  })
})
