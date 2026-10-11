/**
 * Initiative bonus = Dex modifier + any other bonuses (e.g. the Alert feat adds your proficiency bonus).
 * The roll itself is d20 + this bonus.
 */
export function initiativeBonus(dexMod: number, otherBonus = 0): number {
  return dexMod + otherBonus
}

/** Weapon/attack roll bonus = ability modifier + proficiency bonus (if proficient with the weapon). */
export function attackBonus(abilityMod: number, profBonus: number, proficient: boolean): number {
  return abilityMod + (proficient ? profBonus : 0)
}
