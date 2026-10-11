// Thai UI text for game terms. Game terms stay in English with a Thai gloss.
import type { Ability, Condition, ProficiencyLevel } from '../rules'

export const ABILITY_LABEL: Record<Ability, { short: string; name: string; th: string }> = {
  str: { short: 'STR', name: 'Strength', th: 'พลังกาย' },
  dex: { short: 'DEX', name: 'Dexterity', th: 'ความคล่องแคล่ว' },
  con: { short: 'CON', name: 'Constitution', th: 'ความอึด' },
  int: { short: 'INT', name: 'Intelligence', th: 'สติปัญญา' },
  wis: { short: 'WIS', name: 'Wisdom', th: 'วิจารณญาณ' },
  cha: { short: 'CHA', name: 'Charisma', th: 'เสน่ห์' },
}

export const PROFICIENCY_LABEL: Record<ProficiencyLevel, string> = {
  none: 'ไม่ชำนาญ',
  proficient: 'Proficient',
  expertise: 'Expertise',
}


export const CONDITION_TH: Record<Condition, string> = {
  Blinded: 'ตาบอด',
  Charmed: 'ถูกสะกดใจ',
  Deafened: 'หูหนวก',
  Frightened: 'หวาดกลัว',
  Grappled: 'ถูกจับล็อก',
  Incapacitated: 'ทำอะไรไม่ได้',
  Invisible: 'ล่องหน',
  Paralyzed: 'อัมพาต',
  Petrified: 'กลายเป็นหิน',
  Poisoned: 'ติดพิษ',
  Prone: 'ล้มลง',
  Restrained: 'ถูกพันธนาการ',
  Stunned: 'มึนงง',
  Unconscious: 'หมดสติ',
}
