import { describe, expect, it } from 'vitest'
import { buildClassFeaturesTh, buildFeatsTh, buildTraitsTh, classSections, traitSections } from './featuresTh'

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

const classPage = `---
name: Fighter
---
### ความสามารถของไฟท์เตอร์ {#FighterFeatures}

#### เลเวล 1: แรงฮึดรอบสอง (Second Wind) {#Level1SecondWind}

ฟื้นฟู [ฮิตพอยต์](/x) 1d10

> ไฟท์เตอร์ที่ดีควรพักผ่อน (sidebar)

#### เลเวล 3: คลาสย่อยของไฟท์เตอร์ {#Level3FighterSubclass}

เลือกคลาสย่อย

#### ตัวเลือกพิเศษ (Options) {#Options}

ไม่ใช่ความสามารถ

### คลาสย่อยไฟท์เตอร์ {#FighterSubclass}

#### ผู้เจนศึก (แบ็ทเทิลมาสเตอร์ - Battle Master) {#BattleMaster}

##### เลเวล 3: ศิษย์แห่งสงคราม (Student of War) {#Level3StudentofWar}

ไม่อยู่ใน SRD

#### แชมเปียน (Champion) {#Champion}

##### เลเวล 3: คริติคัลขั้นสูง (Improved Critical) {#Level3ImprovedCritical}

ทอยได้ 19

##### คาถาคริติคัล (Improved Critical) {#ImprovedCriticalTable}

| เลเวล | คาถา |
| --- | --- |
| 3     | 2618946-burning-hands, 2619132-tashas-hideous-laughter |

##### เลเวล 7: สไตล์เพิ่มเติม (Additional Fighting Style) {#Level7AdditionalFightingStyle}

อีกหนึ่ง
`

describe('classSections / buildClassFeaturesTh', () => {
  it('reads features with their subclass; leaves out sidebars and headings that aren\'t the feature\'s own', () => {
    expect(classSections(classPage).map((s) => [s.en, s.level, s.subclass ?? ''])).toEqual([
      ['Second Wind', 1, ''], ['FighterSubclass', 3, ''], ['Student of War', 3, 'Battle Master'],
      ['Improved Critical', 3, 'Champion'], ['Additional Fighting Style', 7, 'Champion'],
    ])
  })

  it('matches SRD features only, turning spell ids into names and dropping people the SRD leaves out', () => {
    const r = buildClassFeaturesTh([{ className: 'Fighter', md: classPage }], [
      { id: 'fighter-second-wind', name: 'Second Wind', className: 'Fighter', level: 1 },
      { id: 'fighter-subclass', name: 'Fighter Subclass', className: 'Fighter', level: 3 },
      { id: 'champion-improved-critical', name: 'Improved Critical', className: 'Fighter', subclass: 'Champion', level: 3 },
      { id: 'fighter-indomitable', name: 'Indomitable', className: 'Fighter', level: 9 },
    ])
    expect(r.features['fighter-second-wind']).toEqual({ name: 'แรงฮึดรอบสอง', text: 'ฟื้นฟู ฮิตพอยต์ 1d10' })
    expect(r.features['fighter-subclass']).toEqual({ name: 'คลาสย่อยของไฟท์เตอร์', text: 'เลือกคลาสย่อย' })
    expect(r.features['champion-improved-critical'].text).toBe('ทอยได้ 19\n\n##### คาถาคริติคัล (Improved Critical)\n\n| เลเวล | คาถา |\n| --- | --- |\n| 3 | Burning Hands, Hideous Laughter |')
    expect(r.report.missing).toEqual(['Fighter 9: Indomitable'])
  })
})

const speciesPage = `---
name: Elf
---
#### คุณสมบัติของเอลฟ์ {#ElfTraits}

**_สายตระกูลเอลฟ์ (Elven Lineage)_** เลือกสายตระกูลจากตาราง

**_มองเห็นในความมืด (Darkvision)_** ระยะ 60 ฟุต

**_เข้าภวังค์ (Trance)._** ไม่ต้องนอน

##### ตารางสายตระกูลเอลฟ์ (Elven Lineages)

| สายตระกูล | เลเวล 1 |
| --- | --- |
| ดรอว์ | Dancing Lights |

#### เรื่องเล่า

ไม่ใช่คุณสมบัติ
`

describe('traitSections / buildTraitsTh', () => {
  it('reads each trait; a lineage table goes with its trait', () => {
    expect(traitSections(speciesPage).map((s) => [s.en, s.text.trim().split('\n')[0]])).toEqual([
      ['Elven Lineage', 'เลือกสายตระกูลจากตาราง'], ['Darkvision', 'ระยะ 60 ฟุต'], ['Trance', 'ไม่ต้องนอน'],
    ])
    expect(traitSections(speciesPage)[0].text).toContain('| ดรอว์ | Dancing Lights |')
  })

  it('matches by species and name; ranges must agree; variants use their base trait only when it has no entry', () => {
    const dragonborn = '---\nname: Dragonborn\n---\n**_อาวุธลมหายใจ (Breath Weapon)_** พ่นลม\n'
    const r = buildTraitsTh([{ species: 'Elf', md: speciesPage }, { species: 'Dragonborn', md: dragonborn }], [
      { id: 'darkvision-60', name: 'Darkvision (60 ft.)', species: ['Dragonborn', 'Elf'] },
      { id: 'darkvision-120', name: 'Darkvision (120 ft.)', species: ['Elf'] },
      { id: 'trance', name: 'Trance', species: ['Elf'] },
      { id: 'breath-acid', name: 'Breath Weapon: Acid', species: ['Dragonborn'] },
      { id: 'elven-lineage', name: 'Elven Lineage', species: ['Elf'] },
      { id: 'lineage-drow', name: 'Elven Lineage: Drow', species: ['Elf'] },
    ])
    expect(Object.keys(r.features).sort()).toEqual(['breath-acid', 'darkvision-60', 'elven-lineage', 'trance'])
    expect(r.features.trance).toEqual({ name: 'เข้าภวังค์', text: 'ไม่ต้องนอน' })
    expect(r.report.missing).toEqual(['Elf: Darkvision (120 ft.)', 'Elf: Elven Lineage: Drow'])
  })
})
