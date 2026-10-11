// SRD 5.2.1 species (2024 rules). Only traits that change sheet numbers are modeled;
// the rest is a short Thai summary in our own words.
import type { Skill } from '../skills'

export const SPECIES = ['Dragonborn', 'Dwarf', 'Elf', 'Gnome', 'Goliath', 'Halfling', 'Human', 'Orc', 'Tiefling'] as const
export type SpeciesName = (typeof SPECIES)[number]

export interface SpeciesInfo {
  speed: number
  size: 'Medium' | 'Small' | 'Medium or Small'
  /** Darkvision range in feet, 0 = none. */
  darkvision: number
  /** Extra max HP per character level (Dwarven Toughness). */
  hpPerLevel: number
  /** A skill proficiency to choose from this list (Elf Keen Senses), or 'any' (Human Skillful). */
  skillChoice: readonly Skill[] | 'any' | null
  /** Human Versatile: gains an extra Origin feat. */
  extraOriginFeat: boolean
  traits: string[]
  descriptionTh: string
}

export const SPECIES_INFO: Record<SpeciesName, SpeciesInfo> = {
  Dragonborn: {
    speed: 30, size: 'Medium', darkvision: 60, hpPerLevel: 0, skillChoice: null, extraOriginFeat: false,
    traits: ['Draconic Ancestry', 'Breath Weapon', 'Damage Resistance', 'Draconic Flight (level 5)'],
    descriptionTh: 'ลูกหลานมังกร พ่นลมหายใจธาตุได้ ต้านทานธาตุเดียวกับบรรพบุรุษ',
  },
  Dwarf: {
    speed: 30, size: 'Medium', darkvision: 120, hpPerLevel: 1, skillChoice: null, extraOriginFeat: false,
    traits: ['Dwarven Resilience', 'Dwarven Toughness', 'Stonecunning'],
    descriptionTh: 'คนแคระทนทาน ได้ HP เพิ่ม 1 ทุก Level ต้านทานพิษ',
  },
  Elf: {
    speed: 30, size: 'Medium', darkvision: 60, hpPerLevel: 0, skillChoice: ['Insight', 'Perception', 'Survival'], extraOriginFeat: false,
    traits: ['Elven Lineage', 'Fey Ancestry', 'Keen Senses', 'Trance'],
    descriptionTh: 'เอลฟ์ประสาทสัมผัสไว พักผ่อนด้วยสมาธิ 4 ชม. แทนการนอน (Trance) เลือกสายเลือด Drow / High Elf / Wood Elf',
  },
  Gnome: {
    speed: 30, size: 'Small', darkvision: 60, hpPerLevel: 0, skillChoice: null, extraOriginFeat: false,
    traits: ['Gnomish Cunning', 'Gnomish Lineage'],
    descriptionTh: 'โนมตัวเล็กหัวไว มี Advantage ใน Saving Throw ทางจิตใจ (INT/WIS/CHA)',
  },
  Goliath: {
    speed: 35, size: 'Medium', darkvision: 0, hpPerLevel: 0, skillChoice: null, extraOriginFeat: false,
    traits: ['Giant Ancestry', 'Large Form (level 5)', 'Powerful Build'],
    descriptionTh: 'ลูกหลานยักษ์ ตัวใหญ่แข็งแรง เดินเร็ว มีพลังพิเศษจากบรรพบุรุษยักษ์',
  },
  Halfling: {
    speed: 30, size: 'Small', darkvision: 0, hpPerLevel: 0, skillChoice: null, extraOriginFeat: false,
    traits: ['Brave', 'Halfling Nimbleness', 'Luck', 'Naturally Stealthy'],
    descriptionTh: 'ฮาล์ฟลิงตัวเล็กโชคดี ทอย d20 ได้ 1 ให้ทอยใหม่ได้ (Luck) ซ่อนตัวเก่ง',
  },
  Human: {
    speed: 30, size: 'Medium or Small', darkvision: 0, hpPerLevel: 0, skillChoice: 'any', extraOriginFeat: true,
    traits: ['Resourceful', 'Skillful', 'Versatile'],
    descriptionTh: 'มนุษย์ปรับตัวเก่ง ได้ Skill เพิ่ม 1 อย่างและ Origin Feat เพิ่ม 1 อัน',
  },
  Orc: {
    speed: 30, size: 'Medium', darkvision: 120, hpPerLevel: 0, skillChoice: null, extraOriginFeat: false,
    traits: ['Adrenaline Rush', 'Relentless Endurance'],
    descriptionTh: 'ออร์คอึดถึก เมื่อ HP ลดเหลือ 0 (แต่ไม่ตายทันที) จะเหลือ 1 HP แทน 1 ครั้งต่อ Long Rest (Relentless Endurance)',
  },
  Tiefling: {
    speed: 30, size: 'Medium or Small', darkvision: 60, hpPerLevel: 0, skillChoice: null, extraOriginFeat: false,
    traits: ['Fiendish Legacy', 'Otherworldly Presence'],
    descriptionTh: 'ทีฟลิงมีสายเลือดปีศาจ ได้คาถาติดตัวจากมรดกปีศาจ (Fiendish Legacy)',
  },
}

/** Wood Elves are faster; the lineage is the only species sub-choice that changes a sheet number. */
export const ELF_LINEAGES = { Drow: { speed: 30, darkvision: 120 }, 'High Elf': { speed: 30, darkvision: 60 }, 'Wood Elf': { speed: 35, darkvision: 60 } } as const
export type ElfLineage = keyof typeof ELF_LINEAGES

export function isSrdSpecies(name: string): name is SpeciesName {
  return (SPECIES as readonly string[]).includes(name)
}
