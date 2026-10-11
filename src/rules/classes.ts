// Per-class defaults (2024 rules), used to pre-fill a new character when a class is picked.
import type { Skill } from './skills'
import type { Ability, ClassName } from './types'

/** The two saving throws each class is proficient in. */
export const CLASS_SAVES: Record<ClassName, [Ability, Ability]> = {
  Barbarian: ['str', 'con'],
  Bard: ['dex', 'cha'],
  Cleric: ['wis', 'cha'],
  Druid: ['int', 'wis'],
  Fighter: ['str', 'con'],
  Monk: ['str', 'dex'],
  Paladin: ['wis', 'cha'],
  Ranger: ['str', 'dex'],
  Rogue: ['dex', 'int'],
  Sorcerer: ['con', 'cha'],
  Warlock: ['wis', 'cha'],
  Wizard: ['int', 'wis'],
}

/** Spellcasting ability per class, or null for classes without Spellcasting. */
export const CLASS_SPELLCASTING: Record<ClassName, Ability | null> = {
  Barbarian: null,
  Bard: 'cha',
  Cleric: 'wis',
  Druid: 'wis',
  Fighter: null,
  Monk: null,
  Paladin: 'cha',
  Ranger: 'wis',
  Rogue: null,
  Sorcerer: 'cha',
  Warlock: 'cha',
  Wizard: 'int',
}

/** Level at which every 2024 class picks its subclass. */
export const SUBCLASS_LEVEL = 3

export interface ClassInfo {
  /** The one SRD 5.2.1 subclass for this class. */
  subclass: string
  /** Number of skills chosen at level 1, and the list to choose from ('any' = all 18). */
  skillCount: number
  skillChoices: readonly Skill[] | 'any'
  /** Suggested abilities for the highest scores (beginner advice, not a rule). */
  recommended: readonly Ability[]
  /** Short Thai description for beginners (our own words, not SRD text). */
  descriptionTh: string
}

export const CLASS_INFO: Record<ClassName, ClassInfo> = {
  Barbarian: {
    subclass: 'Path of the Berserker',
    skillCount: 2,
    skillChoices: ['Animal Handling', 'Athletics', 'Intimidation', 'Nature', 'Perception', 'Survival'],
    recommended: ['str', 'con'],
    descriptionTh: 'นักรบดุดันที่ใช้ความโกรธ (Rage) เพิ่มพลัง ทนทานมาก HP สูงที่สุด',
  },
  Bard: {
    subclass: 'College of Lore',
    skillCount: 3,
    skillChoices: 'any',
    recommended: ['cha', 'dex'],
    descriptionTh: 'นักดนตรีผู้ใช้เวทมนตร์ ช่วยเพื่อนด้วย Bardic Inspiration เก่งรอบด้าน',
  },
  Cleric: {
    subclass: 'Life Domain',
    skillCount: 2,
    skillChoices: ['History', 'Insight', 'Medicine', 'Persuasion', 'Religion'],
    recommended: ['wis', 'con'],
    descriptionTh: 'นักบวชผู้ได้พลังจากเทพเจ้า เก่งด้านรักษาและสนับสนุนทีม',
  },
  Druid: {
    subclass: 'Circle of the Land',
    skillCount: 2,
    skillChoices: ['Arcana', 'Animal Handling', 'Insight', 'Medicine', 'Nature', 'Perception', 'Religion', 'Survival'],
    recommended: ['wis', 'con'],
    descriptionTh: 'ผู้ใช้เวทแห่งธรรมชาติ แปลงร่างเป็นสัตว์ได้ (Wild Shape)',
  },
  Fighter: {
    subclass: 'Champion',
    skillCount: 2,
    skillChoices: ['Acrobatics', 'Animal Handling', 'Athletics', 'History', 'Insight', 'Intimidation', 'Persuasion', 'Perception', 'Survival'],
    recommended: ['str', 'con'], // or DEX for a ranged/finesse Fighter
    descriptionTh: 'นักรบผู้เชี่ยวชาญอาวุธและเกราะทุกชนิด เล่นง่าย เหมาะกับมือใหม่',
  },
  Monk: {
    subclass: 'Warrior of the Open Hand',
    skillCount: 2,
    skillChoices: ['Acrobatics', 'Athletics', 'History', 'Insight', 'Religion', 'Stealth'],
    recommended: ['dex', 'wis'],
    descriptionTh: 'นักสู้มือเปล่าที่ว่องไว ใช้พลังภายใน (Focus) โจมตีหลายครั้ง',
  },
  Paladin: {
    subclass: 'Oath of Devotion',
    skillCount: 2,
    skillChoices: ['Athletics', 'Insight', 'Intimidation', 'Medicine', 'Persuasion', 'Religion'],
    recommended: ['str', 'cha'],
    descriptionTh: 'อัศวินศักดิ์สิทธิ์ผู้สาบานตน ใส่เกราะหนัก ใช้เวทและ Lay on Hands รักษาได้',
  },
  Ranger: {
    subclass: 'Hunter',
    skillCount: 3,
    skillChoices: ['Animal Handling', 'Athletics', 'Insight', 'Investigation', 'Nature', 'Perception', 'Stealth', 'Survival'],
    recommended: ['dex', 'wis'],
    descriptionTh: 'นักล่าแห่งป่า เก่งธนูและการเอาตัวรอด ใช้เวทธรรมชาติได้เล็กน้อย',
  },
  Rogue: {
    subclass: 'Thief',
    skillCount: 4,
    skillChoices: ['Acrobatics', 'Athletics', 'Deception', 'Insight', 'Intimidation', 'Investigation', 'Perception', 'Persuasion', 'Sleight of Hand', 'Stealth'],
    recommended: ['dex', 'int'],
    descriptionTh: 'นักย่องเบาผู้เชี่ยวชาญทักษะ ลอบโจมตีแรงด้วย Sneak Attack',
  },
  Sorcerer: {
    subclass: 'Draconic Sorcery',
    skillCount: 2,
    skillChoices: ['Arcana', 'Deception', 'Insight', 'Intimidation', 'Persuasion', 'Religion'],
    recommended: ['cha', 'con'],
    descriptionTh: 'ผู้มีเวทมนตร์ในสายเลือด ดัดแปลงคาถาได้ด้วย Metamagic',
  },
  Warlock: {
    subclass: 'Fiend Patron',
    skillCount: 2,
    skillChoices: ['Arcana', 'Deception', 'History', 'Intimidation', 'Investigation', 'Nature', 'Religion'],
    recommended: ['cha', 'con'],
    descriptionTh: 'ผู้ทำสัญญากับผู้อุปถัมภ์ทรงพลัง ได้ตัวเลือกเสริมพลัง (Eldritch Invocations)',
  },
  Wizard: {
    subclass: 'Evoker',
    skillCount: 2,
    skillChoices: ['Arcana', 'History', 'Insight', 'Investigation', 'Medicine', 'Nature', 'Religion'],
    recommended: ['int', 'con'],
    descriptionTh: 'นักเวทผู้ร่ำเรียนจากตำรา มีคาถาให้เลือกมากที่สุด แต่ร่างกายบอบบาง',
  },
}

/** How many skills a class may have Expertise in at a given level (2024 class features). */
export function maxExpertise(className: ClassName, level: number): number {
  switch (className) {
    case 'Rogue':
      return (level >= 1 ? 2 : 0) + (level >= 6 ? 2 : 0)
    case 'Bard':
      return (level >= 2 ? 2 : 0) + (level >= 9 ? 2 : 0)
    case 'Ranger':
      return (level >= 2 ? 1 : 0) + (level >= 9 ? 2 : 0)
    case 'Wizard':
      return level >= 2 ? 1 : 0 // Scholar
    default:
      return 0
  }
}

/** Unarmored AC: 10 + Dex, or the Barbarian/Monk Unarmored Defense versions. */
export function unarmoredAC(className: ClassName, mods: Record<Ability, number>): number {
  if (className === 'Barbarian') return 10 + mods.dex + mods.con
  if (className === 'Monk') return 10 + mods.dex + mods.wis
  return 10 + mods.dex
}

/** Saving throw proficiencies at a given level: Monk 14 gets all, Rogue 15 adds WIS and CHA. */
export function classSavesAtLevel(className: ClassName, level: number): Ability[] {
  if (className === 'Monk' && level >= 14) return ['str', 'dex', 'con', 'int', 'wis', 'cha']
  if (className === 'Rogue' && level >= 15) return ['dex', 'int', 'wis', 'cha']
  return [...CLASS_SAVES[className]]
}

/**
 * Extra skill proficiencies from class/subclass features after level 1:
 * College of Lore (level 3) gets 3 of any skill, Barbarian Primal Knowledge (level 3) 1 from its list.
 */
export function laterClassSkills(className: ClassName, subclass: string, level: number): { any: number; fromClassList: number } {
  const isSubclass = (name: string) => subclass.trim().toLowerCase() === name.toLowerCase()
  if (className === 'Bard' && level >= 3 && isSubclass(CLASS_INFO.Bard.subclass)) return { any: 3, fromClassList: 0 }
  if (className === 'Barbarian' && level >= 3) return { any: 0, fromClassList: 1 }
  return { any: 0, fromClassList: 0 }
}

/** True when the subclass name is this class's SRD subclass (ignoring case and spaces). */
export function isSrdSubclass(className: ClassName, subclass: string): boolean {
  return subclass.trim().toLowerCase() === CLASS_INFO[className].subclass.toLowerCase()
}
