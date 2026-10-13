import { describe, expect, it } from 'vitest'
import { buildFeatsTh } from './featuresTh'

const srd = [{ id: 'alert', name: 'Alert' }, { id: 'two-weapon-fighting', name: 'Two-Weapon Fighting' }, { id: 'grappler', name: 'Grappler' }]
const feat = (name: string, nameTh: string, description: string, benefits: string[] = [], version = '2024') => ({ version, name, name_th: nameTh, description, benefits })

describe('buildFeatsTh', () => {
  it('keeps 2024 SRD feats only: description, then each benefit as a paragraph, links made plain', () => {
    const r = buildFeatsTh([
      feat('Alert', 'ตื่นตัว', 'คุณจะได้รับประโยชน์', ['**_สลับ (Swap)_** ทอย [จัดลำดับ (Initiative)](/free-rules/rules-glossary#Initiative)  ', '']),
      feat('Alert', 'เก่า', 'เก่า', [], '2014'),
      feat('Two Weapon Fighting', 'สองอาวุธ', 'โจมตีด้วยมือรอง'),
      feat('Spellfire Spark', 'ไม่ใช่ SRD', 'x'),
    ], srd)
    if ('error' in r) throw new Error(r.error)
    expect(r.features).toEqual({
      alert: { name: 'ตื่นตัว', text: 'คุณจะได้รับประโยชน์\n\n**_สลับ (Swap)_** ทอย จัดลำดับ (Initiative)' },
      'two-weapon-fighting': { name: 'สองอาวุธ', text: 'โจมตีด้วยมือรอง' },
    })
    expect(r.report).toMatchObject({ translated2024: 3, matched: 2, missing: ['Grappler'] })
  })

  it('skips rows of the wrong shape and lists likely typos', () => {
    const r = buildFeatsTh([{ version: '2024', name: 'Alert', name_th: 'ตื่นตัว', description: 'x', benefits: [1] }, feat('Grappler', 'นักจับยึด', 'สิ่งมีชีวิตน้้น')], srd)
    if ('error' in r) throw new Error(r.error)
    expect(Object.keys(r.features)).toEqual(['grappler'])
    expect(r.report.typos).toEqual([expect.stringMatching(/^Grappler: .*สิ่งมีชีวิตน้้น/)])
    expect(buildFeatsTh({}, srd)).toEqual({ error: 'feats.json should be a list' })
  })
})
