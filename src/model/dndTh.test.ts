import { describe, expect, it } from 'vitest'
import { cleanMarkdown, nonSrdName, stripNonSrdNames } from './dndTh'

describe('cleanMarkdown', () => {
  it('turns spell ids into names, drops images, and takes the padding out of table rows', () => {
    expect(cleanMarkdown('ร่าย 2618887-fireball หรือ 2618911-beacon-of-hope ![รูป](/a.png)')).toBe('ร่าย Fireball หรือ Beacon of Hope')
    expect(cleanMarkdown('| 3      | Fireball      |\n| --- | --- |')).toBe('| 3 | Fireball |\n| --- | --- |')
  })

  it('drops empty anchor links', () => {
    expect(cleanMarkdown('[](#CrystalBallofTelepathy)ลูกแก้วพยากรณ์โทรจิต')).toBe('ลูกแก้วพยากรณ์โทรจิต')
  })
})

describe('stripNonSrdNames', () => {
  it('takes people\'s names out of English and Thai names, and uses the SRD names of renamed items', () => {
    expect(stripNonSrdNames("เป้สารพัดนึกฮิวเวิร์ด (Heward's Handy Haversack)")).toBe('เป้สารพัดนึก (Handy Haversack)')
    expect(stripNonSrdNames('กระท่อมน้อยของเลโอมุนด์ (Leomund’s Tiny Hut)')).toBe('กระท่อมน้อย (Tiny Hut)')
    expect(stripNonSrdNames('โทเคนขนนกของควาล และ เครื่องกลของควาลิช')).toBe('โทเคนขนนก และ เครื่องกล')
    expect(stripNonSrdNames('ตารางสำรับไพ่สารพัดสิ่ง (Deck of Many Things)')).toBe('ตารางสำรับไพ่ลึกลับ (Mysterious Deck)')
    expect(stripNonSrdNames('Tashas Hideous Laughter, Bigbys Hand')).toBe('Hideous Laughter, Hand')
  })

  it('leaves ordinary text alone', () => {
    const text = 'งานสร้างของดรูอิด ผู้เป็นที่ชื่นชอบของทวยเทพ Faerie Fire, Otto the farmer'
    expect(stripNonSrdNames(text)).toBe(text)
  })
})

describe('nonSrdName', () => {
  it('finds worlds and people outside the SRD', () => {
    expect(nonSrdName('ในจักรวาล Dragonlance พวกเอลฟ์')).toBe('Dragonlance')
    expect(nonSrdName('เพลิงแห่งแฟรี่ (Faerie Fire)')).toBeNull()
  })
})
