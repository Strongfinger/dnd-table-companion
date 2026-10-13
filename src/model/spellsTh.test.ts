import { describe, expect, it } from 'vitest'
import { buildSpellsTh, cleanMarkdown, findTypos, splitDescription } from './spellsTh'

const srd = [{ id: 'fireball', name: 'Fireball' }, { id: 'floating-disk', name: 'Floating Disk' }, { id: 'shield', name: 'Shield' }]
const spell = (name: string, title: string, description: string, version = '2024') => ({ version, name, title, description })

describe('cleanMarkdown / splitDescription', () => {
  it('turns site links into plain text and tidies blank lines', () => {
    expect(cleanMarkdown('พื้นที่ [ทรงกลม (Sphere)](/free-rules/rules-glossary#Sphere)\r\n\n\n\nต่อ  ')).toBe('พื้นที่ ทรงกลม (Sphere)\n\nต่อ')
  })

  it('splits off the higher-level paragraph (both headings) and the material note', () => {
    expect(splitDescription('ระเบิด\n\n**_เมื่อใช้กับสล็อตคาถาเลเวลสูงขึ้น_** เพิ่ม 1d6\n\n\\* (มูลค้างคาว)')).toEqual({ text: 'ระเบิด', higher: 'เพิ่ม 1d6', material: 'มูลค้างคาว' })
    expect(splitDescription('ยิง\n\n**_เพิ่มระะดับแคนทริป._** เพิ่ม 1d10')).toEqual({ text: 'ยิง', higher: 'เพิ่ม 1d10' })
    expect(splitDescription('ยิง\n\n_**เพิ่มระดับแคนทริป**_ เพิ่ม 1d10')).toEqual({ text: 'ยิง', higher: 'เพิ่ม 1d10' })
    expect(splitDescription('**_เสียง_** ดังก้อง\n\n- ข้อ 1')).toEqual({ text: '**_เสียง_** ดังก้อง\n\n- ข้อ 1' })
  })
})

describe('findTypos', () => {
  it('spots doubled vowel marks, a word typed twice and Latin stuck to Thai', () => {
    expect(findTypos('เพิ่มระะดับ')).toEqual(['…เพิ่มระะดับ…'])
    expect(findTypos('ใน เทิร์นs 5')).toEqual(['…ใน เทิร์นs 5…'])
    expect(findTypos('ความ ของของ คาถา')).toEqual(['…ความ ของของ คาถา…'])
    // Normal Thai: "ที่ที่", and repeats that only look like one across two words.
    expect(findTypos('ไปยังที่ที่คุณเห็น และ กันทันที และ ความเสียหายหาก ความเสียหายจากไฟ 8d6')).toEqual([])
  })
})

describe('buildSpellsTh', () => {
  it('keeps 2024 SRD spells only, also matching names without the wizard ("Tenser\'s …")', () => {
    const r = buildSpellsTh([
      spell('Fireball', 'ลูกไฟ', 'ระเบิด'),
      spell('Fireball', 'ลูกไฟ 2014', 'เก่า', '2014'),
      spell("Tenser's Floating Disk", 'จานลอย', 'จาน'),
      spell('Spellfire Flare', 'ไม่ใช่ SRD', 'x'),
    ], srd)
    if ('error' in r) throw new Error(r.error)
    expect(r.spells).toEqual({ fireball: { name: 'ลูกไฟ', text: 'ระเบิด' }, 'floating-disk': { name: 'จานลอย', text: 'จาน' } })
    expect(r.report).toMatchObject({ translated2024: 3, matched: 2, missing: ['Shield'], matchedWithoutOwner: ["Floating Disk = Tenser's Floating Disk"] })
  })

  it('rejects data that is not a list', () => {
    expect(buildSpellsTh({}, srd)).toHaveProperty('error')
  })
})
