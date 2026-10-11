// SRD 5.2.1 backgrounds (2024 rules): ability increases, 2 skills, a tool and an Origin feat.
import type { Skill } from '../skills'
import type { Ability } from '../types'
import type { OriginFeat } from './feats'

export const BACKGROUNDS = ['Acolyte', 'Criminal', 'Sage', 'Soldier'] as const
export type BackgroundName = (typeof BACKGROUNDS)[number]

export interface BackgroundInfo {
  /** The three abilities the background's +2/+1 or +1/+1/+1 can go into. */
  abilities: readonly [Ability, Ability, Ability]
  skills: readonly [Skill, Skill]
  tool: string
  feat: OriginFeat
  /** Magic Initiate spell list from this background. */
  featNote?: string
  descriptionTh: string
}

export const BACKGROUND_INFO: Record<BackgroundName, BackgroundInfo> = {
  Acolyte: {
    abilities: ['int', 'wis', 'cha'],
    skills: ['Insight', 'Religion'],
    tool: "Calligrapher's Supplies",
    feat: 'Magic Initiate',
    featNote: 'Cleric',
    descriptionTh: 'เคยรับใช้ในวิหาร คุ้นเคยกับพิธีกรรมและศาสนา',
  },
  Criminal: {
    abilities: ['dex', 'con', 'int'],
    skills: ['Sleight of Hand', 'Stealth'],
    tool: "Thieves' Tools",
    feat: 'Alert',
    descriptionTh: 'เคยใช้ชีวิตนอกกฎหมาย เก่งเรื่องลักขโมยและหลบซ่อน',
  },
  Sage: {
    abilities: ['con', 'int', 'wis'],
    skills: ['Arcana', 'History'],
    tool: "Calligrapher's Supplies",
    feat: 'Magic Initiate',
    featNote: 'Wizard',
    descriptionTh: 'นักวิชาการผู้ใช้ชีวิตกับตำราและห้องสมุด',
  },
  Soldier: {
    abilities: ['str', 'dex', 'con'],
    skills: ['Athletics', 'Intimidation'],
    tool: 'Gaming Set',
    feat: 'Savage Attacker',
    descriptionTh: 'อดีตทหารที่ผ่านการฝึกและสนามรบมาแล้ว',
  },
}

export function isSrdBackground(name: string): name is BackgroundName {
  return (BACKGROUNDS as readonly string[]).includes(name)
}
