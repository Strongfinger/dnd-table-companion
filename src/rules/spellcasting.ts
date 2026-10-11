/** Spell save DC = 8 + proficiency bonus + spellcasting ability modifier. */
export function spellSaveDC(profBonus: number, castingMod: number): number {
  return 8 + profBonus + castingMod
}

/** Spell attack bonus = proficiency bonus + spellcasting ability modifier. */
export function spellAttackBonus(profBonus: number, castingMod: number): number {
  return profBonus + castingMod
}
