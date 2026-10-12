// Weapon attacks (2024 rules, SRD 5.2.1): which ability, attack bonus and damage a weapon gives a character.
import { attackBonus } from './combat'
import { formatDamage } from './sheet'
import type { Ability, ClassName } from './types'

/** The weapon table fields the rules need (the SRD data file has more). */
export interface WeaponStats {
  category: 'Simple' | 'Martial'
  type: 'Melee' | 'Ranged'
  /** "1d8", or "1" (Blowgun) */
  dice: string
  damageType: string
  properties: string[]
  /** Two-handed damage dice of a Versatile weapon. */
  versatile?: string
}

/** Weapon training of each class at level 1 (the class tables' "Weapon Proficiencies" line). */
const CLASS_WEAPONS: Record<ClassName, 'simple' | 'all' | 'light' | 'finesseOrLight'> = {
  Barbarian: 'all',
  Bard: 'simple',
  Cleric: 'simple',
  Druid: 'simple',
  Fighter: 'all',
  Monk: 'light',
  Paladin: 'all',
  Ranger: 'all',
  Rogue: 'finesseOrLight',
  Sorcerer: 'simple',
  Warlock: 'simple',
  Wizard: 'simple',
}

/** Is a class trained with this weapon? Simple weapons: every class; Martial: depends on the class. */
export function classHasWeaponTraining(className: ClassName, w: Pick<WeaponStats, 'category' | 'properties'>): boolean {
  if (w.category === 'Simple') return true
  const training = CLASS_WEAPONS[className]
  if (training === 'all') return true
  if (training === 'light') return w.properties.includes('Light')
  if (training === 'finesseOrLight') return w.properties.includes('Finesse') || w.properties.includes('Light')
  return false
}

/** Classes whose level 1 Weapon Mastery feature lets them use the mastery properties of their weapons. */
export const WEAPON_MASTERY_CLASSES: readonly ClassName[] = ['Barbarian', 'Fighter', 'Paladin', 'Ranger', 'Rogue']

/**
 * The ability for attack and damage rolls: melee uses STR, ranged uses DEX, a Finesse weapon uses the
 * better of the two (the player may choose; the higher one is what anyone would pick).
 * A thrown melee weapon (Dagger, Handaxe) uses the same ability as in melee.
 */
export function weaponAbility(w: Pick<WeaponStats, 'type' | 'properties'>, mods: Record<Ability, number>): Ability {
  if (w.properties.includes('Finesse')) return mods.dex > mods.str ? 'dex' : 'str'
  return w.type === 'Ranged' ? 'dex' : 'str'
}

export interface WeaponAttack {
  ability: Ability
  /** Attack roll bonus (after Exhaustion). */
  hit: number
  /** One-handed damage, e.g. "1d8+3". */
  damage: string
  /** Versatile weapons: damage when held in two hands. */
  twoHanded?: string
  /**
   * Light weapons: damage of the extra (off-hand) attack: no positive ability modifier unless the
   * character has the Two-Weapon Fighting feat; a negative one still applies.
   */
  offHand?: string
}

export interface WeaponContext {
  modifiers: Record<Ability, number>
  proficiencyBonus: number
  trained: boolean
  feats: string[]
  /** Amount subtracted from D20 Tests (Exhaustion). */
  d20Penalty: number
}

const hasFeat = (feats: string[], name: RegExp) => feats.some((f) => name.test(f))

/** Attack bonus and damage of one weapon. Archery (Fighting Style feat): +2 to attack rolls with Ranged weapons. */
export function weaponAttack(w: WeaponStats, ctx: WeaponContext): WeaponAttack {
  const ability = weaponAbility(w, ctx.modifiers)
  const mod = ctx.modifiers[ability]
  const archery = w.type === 'Ranged' && hasFeat(ctx.feats, /^archery$/i) ? 2 : 0
  const out: WeaponAttack = {
    ability,
    hit: attackBonus(mod, ctx.proficiencyBonus, ctx.trained) + archery - ctx.d20Penalty,
    damage: formatDamage(w.dice, mod),
  }
  if (w.versatile) out.twoHanded = formatDamage(w.versatile, mod)
  if (w.properties.includes('Light')) {
    out.offHand = formatDamage(w.dice, hasFeat(ctx.feats, /^two[- ]weapon fighting$/i) ? mod : Math.min(0, mod))
  }
  return out
}
