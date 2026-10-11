// SRD 5.2.1 Origin feats (2024 rules).
export const ORIGIN_FEATS = ['Alert', 'Magic Initiate', 'Savage Attacker', 'Skilled'] as const
export type OriginFeat = (typeof ORIGIN_FEATS)[number]

export const FEAT_INFO: Record<OriginFeat, { repeatable: boolean; descriptionTh: string }> = {
  Alert: { repeatable: false, descriptionTh: 'บวก Proficiency Bonus ใน Initiative และสลับลำดับกับเพื่อนได้' },
  'Magic Initiate': { repeatable: true, descriptionTh: 'ได้ Cantrip 2 อันและคาถา Level 1 อีก 1 อัน (ใช้ INT, WIS หรือ CHA)' },
  'Savage Attacker': { repeatable: false, descriptionTh: 'เทิร์นละครั้ง ทอยลูกเต๋าความเสียหายของอาวุธ 2 รอบ เลือกค่าที่ดีกว่า' },
  Skilled: { repeatable: true, descriptionTh: 'ได้ Proficiency เพิ่ม 3 อย่าง (Skill หรือเครื่องมือ)' },
}

/** Extra skill proficiencies a feat may give (Skilled can also be spent on tools). */
export function featSkillCount(feat: string): number {
  return feat === 'Skilled' ? 3 : 0
}
