// Thai UI text for game terms. Game terms stay in English with a Thai gloss.
import type { Ability, ProficiencyLevel } from '../rules'

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


// Thai condition names live in the model (log lines need them too).
export { CONDITION_TH } from '../model/thai'
