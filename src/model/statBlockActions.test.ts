import { describe, expect, it } from 'vitest'
import details from '../data/srd-monster-details.json'
import type { MonsterDetail } from './monsterDetails'
import { abilityShort, firstSentence, legendaryCost, legendaryUsesMax, parseAction, rechargeMin, rechargeReady } from './statBlockActions'

describe('parseAction: attacks', () => {
  it('reads to-hit, reach, damage and the extra damage rider (Goblin Boss Scimitar)', () => {
    const a = parseAction({ name: 'Scimitar', text: 'Melee Attack Roll: +4, reach 5 ft. Hit: 5 (1d6 + 2) Slashing damage, plus 2 (1d4) Slashing damage if the attack roll had Advantage.' })
    expect(a).toEqual({
      kind: 'attack', name: 'Scimitar', range: 'Melee', toHit: 4, reach: 'reach 5 ft.',
      damage: { dice: '1d6+2', average: 5, type: 'Slashing' },
      extra: 'plus 2 (1d4) Slashing damage if the attack roll had Advantage.',
    })
  })

  it('reads a ranged attack with a range like 80/320 ft.', () => {
    const a = parseAction({ name: 'Shortbow', text: 'Ranged Attack Roll: +4, range 80/320 ft. Hit: 5 (1d6 + 2) Piercing damage.' })
    expect(a).toMatchObject({ kind: 'attack', range: 'Ranged', toHit: 4, reach: 'range 80/320 ft.', damage: { dice: '1d6+2', type: 'Piercing' }, extra: '' })
  })

  it('handles "Melee or Ranged" with a reach and a range that both contain periods (Ogre Javelin)', () => {
    const a = parseAction({ name: 'Javelin', text: 'Melee or Ranged Attack Roll: +6, reach 5 ft. or range 30/120 ft. Hit: 11 (2d6 + 4) Piercing damage.' })
    expect(a).toMatchObject({ kind: 'attack', range: 'Melee or Ranged', toHit: 6, reach: 'reach 5 ft. or range 30/120 ft.', damage: { dice: '2d6+4', average: 11 } })
  })

  it('keeps a second damage type in the extra text (Adult Red Dragon Rend)', () => {
    const a = parseAction({ name: 'Rend', text: 'Melee Attack Roll: +14, reach 10 ft. Hit: 13 (1d10 + 8) Slashing damage plus 5 (2d4) Fire damage.' })
    expect(a).toMatchObject({ kind: 'attack', toHit: 14, damage: { dice: '1d10+8', type: 'Slashing' }, extra: 'plus 5 (2d4) Fire damage.' })
  })

  it('reads a negative to-hit and dice without a modifier', () => {
    const a = parseAction({ name: 'Nip', text: 'Melee Attack Roll: -1, reach 5 ft. Hit: 3 (1d6) Piercing damage.' })
    expect(a).toMatchObject({ kind: 'attack', toHit: -1, damage: { dice: '1d6', average: 3 } })
  })

  it('keeps the attack but no damage button when the hit has no dice (flat 1 damage)', () => {
    const a = parseAction({ name: 'Bite', text: 'Melee Attack Roll: +1, reach 5 ft. Hit: 1 Piercing damage.' })
    expect(a).toMatchObject({ kind: 'attack', toHit: 1, damage: null, extra: '1 Piercing damage.' })
  })
})

describe('parseAction: saves', () => {
  it('reads DC, ability, damage and what success does (Fire Breath)', () => {
    const a = parseAction({ name: 'Fire Breath', text: 'Dexterity Saving Throw: DC 21, each creature in a 60-foot Cone. Failure: 59 (17d6) Fire damage. Success: Half damage.' })
    expect(a).toEqual({
      kind: 'save', name: 'Fire Breath', ability: 'Dexterity', dc: 21, target: 'each creature in a 60-foot Cone',
      damage: { dice: '17d6', average: 59, type: 'Fire' }, onSuccess: 'Half damage',
    })
  })

  it('a save without damage still gives DC and ability (Dominate Mind)', () => {
    const a = parseAction({ name: 'Dominate Mind', text: 'Wisdom Saving Throw: DC 16, one creature the aboleth can see within 30 feet. Failure: The target has the Charmed condition until the aboleth dies.' })
    expect(a).toMatchObject({ kind: 'save', ability: 'Wisdom', dc: 16, damage: null, onSuccess: '' })
  })
})

describe('parseAction: falls back to plain text', () => {
  it('Multiattack stays text', () => {
    const t = 'The goblin makes two attacks, using Scimitar or Shortbow in any combination.'
    expect(parseAction({ name: 'Multiattack', text: t })).toEqual({ kind: 'text', name: 'Multiattack', text: t })
  })
  it('empty and odd text never throws', () => {
    expect(parseAction({ name: 'X', text: '' })).toEqual({ kind: 'text', name: 'X', text: '' })
    expect(parseAction({ name: 'X', text: 'Melee Attack Roll: lots' })).toMatchObject({ kind: 'text' })
  })

  it('parses every action in the SRD data without throwing, and every attack has a to-hit', () => {
    let attacks = 0
    let withDamage = 0
    for (const m of details as MonsterDetail[]) {
      for (const e of [...m.actions, ...m.bonusActions, ...m.reactions, ...m.legendaryActions]) {
        const a = parseAction(e)
        if (/^(Melee|Ranged|Melee or Ranged) Attack Roll: [+-]\d+, /.test(e.text)) {
          expect(a.kind, `${m.id} / ${e.name}`).toBe('attack')
          attacks++
          if (a.kind === 'attack' && a.damage) withDamage++
        }
      }
    }
    expect(attacks).toBeGreaterThan(300)
    // Nearly every attack has dice damage; a few are flat damage or conditions only.
    expect(withDamage / attacks).toBeGreaterThan(0.9)
  })
})

describe('Recharge, Legendary and text helpers', () => {
  it('rechargeMin reads Recharge 5–6 and Recharge 6, nothing else', () => {
    expect(rechargeMin('Recharge 5–6')).toBe(5)
    expect(rechargeMin('Recharge 5-6')).toBe(5)
    expect(rechargeMin('Recharge 6')).toBe(6)
    expect(rechargeMin('2/Day')).toBeNull()
    expect(rechargeMin(undefined)).toBeNull()
  })
  it('rechargeReady: the roll must reach the minimum', () => {
    expect(rechargeReady(4, 5)).toBe(false)
    expect(rechargeReady(5, 5)).toBe(true)
    expect(rechargeReady(6, 5)).toBe(true)
  })
  it('legendaryUsesMax reads the number before "(in Lair)"', () => {
    expect(legendaryUsesMax('3 (4 in Lair)')).toBe(3)
    expect(legendaryUsesMax('3')).toBe(3)
    expect(legendaryUsesMax(null)).toBe(0)
    expect(legendaryUsesMax(undefined)).toBe(0)
    expect(legendaryUsesMax('lots')).toBe(0)
  })
  it('legendaryCost defaults to 1 and reads "Costs 2 Actions"', () => {
    expect(legendaryCost('The dragon moves.')).toBe(1)
    expect(legendaryCost('Costs 2 Actions. The dragon breathes.')).toBe(2)
  })
  it('firstSentence cuts at the first full stop', () => {
    expect(firstSentence('The goblin takes the Disengage or Hide action. Extra.')).toBe('The goblin takes the Disengage or Hide action.')
    expect(firstSentence('No full stop')).toBe('No full stop')
  })
  it('abilityShort', () => {
    expect(abilityShort('Dexterity')).toBe('DEX')
    expect(abilityShort('Luck')).toBe('Luck')
  })
})
