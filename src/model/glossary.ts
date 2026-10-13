// Short Thai explanations of game terms (2024 rules), shown when hovering (mouse) or
// long-pressing / tapping (phone). Written in our own words as quick reminders, not rules text.
import { BACKGROUND_INFO, isSrdBackground } from '../rules/srd/backgrounds'
import { FEAT_INFO, ORIGIN_FEATS, type OriginFeat } from '../rules/srd/feats'
import { isSrdSpecies, SPECIES_INFO } from '../rules/srd/species'

export interface GlossaryEntry {
  title: string
  text: string
  /** The SRD Rules Glossary entry this term is (English name), for the full Thai rules text. */
  srd?: string
}

/** Our names that the SRD Rules Glossary words differently. */
const SRD_NAMES: Record<string, string> = {
  'Temp HP': 'Temporary Hit Points', 'Death Save': 'Death Saving Throw', 'Hit Dice': 'Hit Point Dice',
  AC: 'Armor Class', 'Opportunity Attack': 'Opportunity Attacks',
}
/** Ours with no glossary entry of their own (they live in the spell and damage chapters). */
const NOT_IN_SRD_GLOSSARY = new Set(['Spell Save DC', 'Spell Slots', 'Massive Damage'])
const srdName = (k: string) => (NOT_IN_SRD_GLOSSARY.has(k) ? {} : { srd: SRD_NAMES[k] ?? k })

const CONDITIONS: Record<string, string> = {
  Blinded: 'มองไม่เห็น: Ability Check ที่ต้องใช้สายตาล้มเหลวทันที · การโจมตีใส่ตัวนี้มี Advantage · การโจมตีของตัวนี้มี Disadvantage',
  Charmed: 'ถูกสะกดใจ: โจมตีหรือใช้ความสามารถอันตรายใส่ผู้ที่สะกดไม่ได้ · ผู้สะกดมี Advantage ใน Ability Check เพื่อพูดคุย/โน้มน้าวตัวนี้',
  Deafened: 'หูหนวก: Ability Check ที่ต้องใช้การได้ยินล้มเหลวทันที',
  Exhaustion: 'เหนื่อยล้า มี 6 ระดับ: ทุก D20 Test −2 ต่อระดับ และ Speed −5 ft. ต่อระดับ · ระดับ 6 = ตาย · Long Rest ลด 1 ระดับ',
  Frightened: 'หวาดกลัว: Disadvantage ใน Ability Check และการโจมตี ขณะที่ยังเห็นต้นเหตุ · เคลื่อนเข้าหาต้นเหตุไม่ได้',
  Grappled: 'ถูกจับล็อก: Speed เป็น 0 · Disadvantage ในการโจมตีเป้าหมายอื่นที่ไม่ใช่ผู้จับ · ผู้จับลากไปด้วยได้ · หลุดเมื่อผู้จับ Incapacitated หรือถูกพาออกนอกระยะเอื้อม',
  Incapacitated: 'ทำอะไรไม่ได้: ใช้ Action, Bonus Action, Reaction ไม่ได้ · Concentration หลุด · พูดไม่ได้ · ถ้าเป็นตอนทอย Initiative จะมี Disadvantage',
  Invisible: 'ล่องหน: Advantage ตอนทอย Initiative · การโจมตีใส่ตัวนี้มี Disadvantage และการโจมตีของตัวนี้มี Advantage (ใช้ไม่ได้กับผู้ที่มองเห็นตัวนี้ได้) · เป็นเป้าของเอฟเฟกต์ที่ต้องมองเห็นเป้าหมายไม่ได้',
  Paralyzed: 'อัมพาต: Incapacitated · Speed 0 · STR/DEX Saving Throw ล้มเหลวทันที · การโจมตีใส่มี Advantage · ถ้าโดนจากระยะ 5 ft. = Critical Hit',
  Petrified: 'กลายเป็นหิน: Incapacitated · Speed 0 · มี Resistance ทุกความเสียหาย และไม่ติด Poisoned · STR/DEX Saving Throw ล้มเหลวทันที · การโจมตีใส่มี Advantage',
  Poisoned: 'ติดพิษ: Disadvantage ในการโจมตีและ Ability Check',
  Prone: 'ล้มลง: เคลื่อนที่ได้แค่คลาน หรือใช้ Speed ครึ่งหนึ่งเพื่อลุก · การโจมตีของตัวนี้มี Disadvantage · โจมตีใส่จากระยะ 5 ft. มี Advantage ไกลกว่านั้นมี Disadvantage',
  Restrained: 'ถูกพันธนาการ: Speed 0 · การโจมตีใส่มี Advantage · การโจมตีของตัวนี้มี Disadvantage · Disadvantage ใน DEX Saving Throw',
  Stunned: 'มึนงง: Incapacitated · STR/DEX Saving Throw ล้มเหลวทันที · การโจมตีใส่มี Advantage',
  Unconscious: 'หมดสติ: Incapacitated และ Prone · ทำของที่ถืออยู่หล่น · Speed 0 · STR/DEX Saving Throw ล้มเหลวทันที · การโจมตีใส่มี Advantage · โดนจากระยะ 5 ft. = Critical Hit',
}

const ACTIONS: Record<string, string> = {
  Attack: 'โจมตีด้วยอาวุธหรือมือเปล่า (บาง Class โจมตีได้มากกว่า 1 ครั้งด้วย Extra Attack)',
  Magic: 'ร่ายคาถา ใช้ไอเทมเวท หรือใช้ความสามารถที่เป็นเวทมนตร์',
  Dash: 'เคลื่อนที่เพิ่มได้อีกเท่ากับ Speed ของตัวเองในเทิร์นนี้',
  Disengage: 'การเคลื่อนที่ในเทิร์นนี้ไม่ทำให้ศัตรูได้ Opportunity Attack',
  Dodge: 'จนถึงต้นเทิร์นถัดไป: การโจมตีใส่ตัวนี้มี Disadvantage (ถ้ามองเห็นผู้โจมตี) และ DEX Saving Throw มี Advantage · หมดผลถ้า Incapacitated หรือ Speed เป็น 0',
  Help: 'ช่วยเพื่อน: เลือก Skill/Tool ที่เราชำนาญ ให้เพื่อนมี Advantage ใน Ability Check ถัดไปด้วยสิ่งนั้น หรือรบกวนศัตรูที่อยู่ห่างเรา 5 ft. ให้การโจมตีถัดไปของเพื่อนใส่ศัตรูนั้นมี Advantage · หมดผลเมื่อถึงต้นเทิร์นถัดไปของเรา',
  Hide: 'ซ่อนตัว: ทอย DEX (Stealth) DC 15 ต้องอยู่หลัง Cover แบบ Three-Quarters/Total หรือใน Heavily Obscured และพ้นสายตาศัตรู · สำเร็จ = Invisible โดยค่า Stealth ที่ทอยได้คือ DC ที่คนอื่นต้องทำให้ถึงเพื่อหาตัวเจอ · หมดผลเมื่อถูกพบ ส่งเสียง โจมตี หรือร่ายคาถาที่มี Verbal',
  Influence: 'โน้มน้าวผู้อื่นด้วยคำพูดหรือท่าที เช่น Persuasion, Deception, Intimidation หรือ Animal Handling',
  Ready: 'เตรียมการล่วงหน้า: บอกเงื่อนไขและสิ่งที่จะทำ แล้วใช้ Reaction ทำเมื่อเงื่อนไขเกิดขึ้น · ถ้าเตรียมคาถา ใช้ Spell Slot ตอนเตรียมและต้องมี Concentration จนกว่าจะปล่อย',
  Search: 'ค้นหาสิ่งที่ไม่ชัดเจน ด้วย WIS เช่น Perception, Insight, Medicine หรือ Survival',
  Study: 'คิด วิเคราะห์ หรือนึกข้อมูล ด้วย INT เช่น Arcana, History, Investigation, Nature หรือ Religion',
  Utilize: 'ใช้สิ่งของที่ไม่ใช่เวทมนตร์ เช่น เปิดประตู ดึงคันโยก',
}

const TERMS: Record<string, string> = {
  Action: 'สิ่งหลักที่ทำได้ในเทิร์น 1 อย่าง เช่น Attack, Magic, Dash · กลับมาใช้ได้ทุกต้นเทิร์นของตัวเอง',
  'Bonus Action': 'การกระทำเสริมสั้นๆ ใช้ได้เทิร์นละ 1 ครั้ง เฉพาะเมื่อมีความสามารถหรือคาถาที่ระบุว่าเป็น Bonus Action',
  Reaction: 'การตอบสนองต่อเหตุการณ์ ใช้ได้ 1 ครั้งต่อรอบ แม้ไม่ใช่เทิร์นตัวเอง เช่น Opportunity Attack · กลับมาที่ต้นเทิร์นของตัวเอง',
  'Opportunity Attack': 'ใช้ Reaction โจมตีระยะประชิด 1 ครั้ง เมื่อศัตรูที่มองเห็นเคลื่อนที่ออกจากระยะเอื้อมของเรา · การ Teleport หรือถูกผลัก/ดึงไม่ทำให้เกิด',
  Concentration: 'ต้องตั้งสมาธิ ทีละ 1 คาถา · โดนดาเมจแต่ละครั้งทอย CON Saving Throw DC = ครึ่งดาเมจ (ปัดลง) ขั้นต่ำ 10 สูงสุด 30 · หลุดเมื่อ Incapacitated, ตาย หรือเริ่ม Concentration คาถาอื่น',
  'Temp HP': 'HP ชั่วคราว ถูกหักก่อน HP จริง · ไม่ซ้อนกัน (ได้ใหม่ให้เลือกค่าที่มากกว่า) · หมดเมื่อ Long Rest',
  'Death Save': 'เมื่อ HP เป็น 0 ทอย d20 ทุกต้นเทิร์น: 10+ สำเร็จ ต่ำกว่า 10 ล้มเหลว · ได้ 1 = ล้มเหลว 2 ครั้ง · ได้ 20 = ฟื้น 1 HP · สำเร็จ 3 = Stable · ล้มเหลว 3 = ตาย · โดนดาเมจตอน 0 HP = ล้มเหลว 1 ครั้ง (Critical Hit = 2)',
  Stable: 'อาการคงที่: HP ยังเป็น 0 และหมดสติ แต่ไม่ต้องทอย Death Save แล้ว · ฟื้น 1 HP หลังผ่านไป 1d4 ชม. · ถ้าโดนดาเมจจะกลับมาทอยใหม่',
  Bloodied: 'บาดเจ็บหนัก: HP เหลือครึ่งหนึ่งหรือน้อยกว่า',
  'Heroic Inspiration': 'แรงบันดาลใจ: ทอยลูกเต๋าลูกใดก็ได้ใหม่ทันทีหลังทอย (รวมลูกดาเมจ) และต้องใช้ผลใหม่ · เก็บได้สูงสุด 1 อัน',
  Advantage: 'ทอย d20 สองลูก เลือกผลที่สูงกว่า · หลายแหล่งไม่ซ้อนกัน · มีทั้ง Advantage และ Disadvantage (กี่แหล่งก็ตาม) = หักล้างกัน ทอยปกติ',
  Disadvantage: 'ทอย d20 สองลูก เลือกผลที่ต่ำกว่า · หลายแหล่งไม่ซ้อนกัน · มีทั้ง Advantage และ Disadvantage (กี่แหล่งก็ตาม) = หักล้างกัน ทอยปกติ',
  'Critical Hit': 'ทอย d20 โจมตีได้หน้า 20 (natural 20): โดนเสมอ และทอยลูกดาเมจทั้งหมดเป็น 2 เท่า (รวมดาเมจพิเศษอย่าง Sneak Attack) แล้วค่อยบวก modifier',
  'Hit Dice': 'ลูกเต๋าพลังชีวิต มีเท่ากับ Level · ใช้ตอน Short Rest เพื่อฟื้น HP (ทอย + CON) · Long Rest ได้คืนทั้งหมด',
  'Short Rest': 'พักสั้นอย่างน้อย 1 ชม.: ใช้ Hit Dice ฟื้น HP ได้ และความสามารถแบบ Short Rest กลับมา',
  'Long Rest': 'พักยาว 8 ชม.: HP และ Hit Dice กลับมาเต็ม · Spell Slots และความสามารถกลับมา · Exhaustion ลด 1 · ต้องมีอย่างน้อย 1 HP',
  AC: 'Armor Class: ค่าป้องกัน · ศัตรูต้องทอยโจมตีได้เท่ากับหรือมากกว่าค่านี้จึงจะโดน',
  Initiative: 'ทอย d20 + DEX modifier (เป็น DEX check) ตอนเริ่มต่อสู้ เพื่อกำหนดลำดับเทิร์น (สูงไปต่ำ) · Invisible = Advantage · Incapacitated หรือถูกจู่โจม (Surprised) = Disadvantage',
  Proficiency: 'Proficiency Bonus: โบนัสตาม Level (+2 ถึง +6) บวกในสิ่งที่ชำนาญ เช่น Skill, Saving Throw, อาวุธ',
  Expertise: 'ชำนาญพิเศษ: บวก Proficiency Bonus 2 เท่าใน Skill (หรือเครื่องมือ) นั้น',
  'Saving Throw': 'ทอยป้องกัน: d20 + modifier ของ Ability ที่ถูกเรียก (+ Proficiency ถ้าชำนาญ) เพื่อต้านเอฟเฟกต์',
  'Passive Perception': 'การสังเกตโดยไม่ต้องทอย = 10 + โบนัส Perception (+5 ถ้ามี Advantage, −5 ถ้ามี Disadvantage) · DM ใช้เทียบกับการซ่อนตัวของผู้อื่น',
  'Spell Save DC': 'ค่าที่เป้าหมายต้องทอย Saving Throw ให้ได้เพื่อต้านคาถาของเรา = 8 + Proficiency + modifier ของ Ability ร่ายเวท',
  'Spell Attack': 'โบนัสทอยโจมตีด้วยคาถา = Proficiency + modifier ของ Ability ร่ายเวท',
  'Spell Slots': 'ช่องร่ายคาถาตาม Level ของคาถา · ร่ายคาถา Level 1 ขึ้นไปใช้ 1 ช่อง (ใช้ช่อง Level สูงกว่าเพื่อเพิ่มพลังได้) · Cantrip ไม่ใช้ · ได้คืนตอน Long Rest (Warlock คืนตอน Short Rest)',
  'Massive Damage': 'ถ้าดาเมจที่เหลือหลัง HP เป็น 0 มากกว่าหรือเท่ากับ Max HP = ตายทันที',
  Speed: 'ระยะเคลื่อนที่ต่อเทิร์น (ฟุต) · แบ่งเดินก่อนและหลังการกระทำได้',
}

const ALL: Record<string, GlossaryEntry> = {
  ...Object.fromEntries(Object.entries(CONDITIONS).map(([k, text]) => [k, { title: `${k} (Condition)`, text, ...srdName(k) }])),
  ...Object.fromEntries(Object.entries(ACTIONS).map(([k, text]) => [k, { title: `${k} (Action)`, text, ...srdName(k) }])),
  ...Object.fromEntries(Object.entries(TERMS).map(([k, text]) => [k, { title: k, text, ...srdName(k) }])),
}

/**
 * Find the help for a term. Understands the extras we use around names:
 * "Attack: Greatsword" → Attack, "Magic: Bless" → Magic, "Bonus" → Bonus Action,
 * plus species, backgrounds and Origin feats from the SRD data.
 */
export function lookupTerm(name: string): GlossaryEntry | null {
  const key = name.trim()
  // Object.hasOwn: names like "constructor" must not match built-in object properties.
  const has = (k: string) => Object.hasOwn(ALL, k)
  if (has(key)) return ALL[key]
  const head = key.split(':')[0].trim()
  if (head !== key && has(head)) return { ...ALL[head], title: `${ALL[head].title} · ${key.slice(head.length + 1).trim()}` }
  if (key === 'Bonus') return ALL['Bonus Action']
  if (isSrdSpecies(key)) return { title: `${key} (Species)`, text: `${SPECIES_INFO[key].descriptionTh} · ${SPECIES_INFO[key].traits.join(', ')}` }
  if (isSrdBackground(key)) {
    const b = BACKGROUND_INFO[key]
    return { title: `${key} (Background)`, text: `${b.descriptionTh} · Skill: ${b.skills.join(', ')} · Feat: ${b.feat}` }
  }
  if ((ORIGIN_FEATS as readonly string[]).includes(key)) return { title: `${key} (Feat)`, text: FEAT_INFO[key as OriginFeat].descriptionTh }
  return null
}

/** All entry names (for tests and a future glossary page). */
export const GLOSSARY_TERMS = Object.keys(ALL)
