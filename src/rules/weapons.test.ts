import { describe, expect, it } from 'vitest'
import { classHasWeaponTraining, weaponAbility, weaponAttack, type WeaponContext, type WeaponStats } from './weapons'

const mods = (str: number, dex: number) => ({ str, dex, con: 0, int: 0, wis: 0, cha: 0 })
const ctx = (over: Partial<WeaponContext> = {}): WeaponContext => ({ modifiers: mods(1, 3), proficiencyBonus: 2, trained: true, feats: [], d20Penalty: 0, ...over })

const rapier: WeaponStats = { category: 'Martial', type: 'Melee', dice: '1d8', damageType: 'Piercing', properties: ['Finesse'] }
const longsword: WeaponStats = { category: 'Martial', type: 'Melee', dice: '1d8', damageType: 'Slashing', properties: ['Versatile'], versatile: '1d10' }
const dagger: WeaponStats = { category: 'Simple', type: 'Melee', dice: '1d4', damageType: 'Piercing', properties: ['Finesse', 'Light', 'Thrown'] }
const handaxe: WeaponStats = { category: 'Simple', type: 'Melee', dice: '1d6', damageType: 'Slashing', properties: ['Light', 'Thrown'] }
const longbow: WeaponStats = { category: 'Martial', type: 'Ranged', dice: '1d8', damageType: 'Piercing', properties: ['Ammunition', 'Heavy', 'Two-Handed'] }
const scimitar: WeaponStats = { category: 'Martial', type: 'Melee', dice: '1d6', damageType: 'Slashing', properties: ['Finesse', 'Light'] }
const blowgun: WeaponStats = { category: 'Martial', type: 'Ranged', dice: '1', damageType: 'Piercing', properties: ['Ammunition', 'Loading'] }

describe('weapon training (2024 class tables)', () => {
  it('gives Simple weapons to everyone and Martial ones by class', () => {
    expect(classHasWeaponTraining('Wizard', dagger)).toBe(true)
    expect(classHasWeaponTraining('Wizard', longsword)).toBe(false)
    expect(classHasWeaponTraining('Fighter', longbow)).toBe(true)
    // Rogue: Martial weapons with Finesse or Light; Monk: Martial weapons with Light.
    expect(classHasWeaponTraining('Rogue', rapier)).toBe(true)
    expect(classHasWeaponTraining('Rogue', longsword)).toBe(false)
    expect(classHasWeaponTraining('Monk', scimitar)).toBe(true)
    expect(classHasWeaponTraining('Monk', rapier)).toBe(false)
  })
})

describe('weapon attacks', () => {
  it('uses STR for melee, DEX for ranged, the better one for Finesse', () => {
    expect(weaponAbility(longsword, mods(3, 1))).toBe('str')
    expect(weaponAbility(longbow, mods(3, 1))).toBe('dex')
    expect(weaponAbility(rapier, mods(1, 3))).toBe('dex')
    expect(weaponAbility(rapier, mods(3, 1))).toBe('str')
    // A thrown Handaxe still uses STR.
    expect(weaponAbility(handaxe, mods(1, 3))).toBe('str')
  })

  it('adds the proficiency bonus only when trained', () => {
    // Rogue 1 (DEX +3, PB 2) with a Rapier: +5 to hit, 1d8+3.
    expect(weaponAttack(rapier, ctx())).toMatchObject({ ability: 'dex', hit: 5, damage: '1d8+3' })
    expect(weaponAttack(rapier, ctx({ trained: false })).hit).toBe(3)
  })

  it('shows two-handed damage for Versatile weapons', () => {
    expect(weaponAttack(longsword, ctx({ modifiers: mods(3, 0) }))).toMatchObject({ hit: 5, damage: '1d8+3', twoHanded: '1d10+3' })
  })

  it('off-hand Light attack: no positive modifier unless Two-Weapon Fighting', () => {
    expect(weaponAttack(dagger, ctx()).offHand).toBe('1d4')
    expect(weaponAttack(dagger, ctx({ feats: ['Two Weapon Fighting'] })).offHand).toBe('1d4+3')
    // A negative modifier still applies.
    expect(weaponAttack(handaxe, ctx({ modifiers: mods(-1, 0) })).offHand).toBe('1d6-1')
    expect(weaponAttack(longsword, ctx()).offHand).toBeUndefined()
  })

  it('Archery adds +2 to ranged attack rolls only; Exhaustion lowers the roll', () => {
    expect(weaponAttack(longbow, ctx({ feats: ['Archery'] })).hit).toBe(7)
    expect(weaponAttack(dagger, ctx({ feats: ['Archery'] })).hit).toBe(5)
    expect(weaponAttack(longbow, ctx({ d20Penalty: 4 })).hit).toBe(1)
  })

  it('a flat damage weapon adds the modifier to the number (Blowgun: 1 + DEX)', () => {
    expect(weaponAttack(blowgun, ctx()).damage).toBe('4')
  })
})

describe('weaponAttack: attack buffs', () => {
  it('adds a flat attack bonus from buffs', () => {
    const w = { dice: '1d6', damageType: 'Piercing', type: 'Melee', category: 'Simple', properties: ['Finesse', 'Light'], mastery: 'Nick' } as unknown as Parameters<typeof weaponAttack>[0]
    const base = { modifiers: { str: 0, dex: 3, con: 0, int: 0, wis: 0, cha: 0 }, proficiencyBonus: 2, trained: true, feats: [], d20Penalty: 0 }
    expect(weaponAttack(w, { ...base, attackBuff: 1 }).hit).toBe(weaponAttack(w, base).hit + 1)
  })
})
