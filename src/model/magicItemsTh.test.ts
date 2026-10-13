import { describe, expect, it } from 'vitest'
import { buildMagicItemsTh } from './magicItemsTh'

const item = (name: string, nameTh: string, description: string, version = '2024') => ({ version, name, name_th: nameTh, description })
const srd = [
  { id: 'bag-of-holding', name: 'Bag of Holding' }, { id: 'armor-2', name: 'Armor +2' }, { id: 'weapon-1', name: 'Weapon +1' },
  { id: 'handy-haversack', name: 'Handy Haversack' }, { id: 'potions-of-healing-rare', name: 'Potion of Superior Healing' },
  { id: 'dragon-orb', name: 'Dragon Orb' }, { id: 'ring-of-x', name: 'Ring of X' }, { id: 'mace-of-terror', name: 'Mace of Terror' },
]

describe('buildMagicItemsTh', () => {
  const r = buildMagicItemsTh([
    item('Bag of Holding', 'ถุงวิเศษ', "ใส่ [เป้สารพัดนึกฮิวเวิร์ด (Heward's Handy Haversack)](/magic-items/x) แล้วพัง"),
    item('Bag of Holding', 'เก่า', 'เก่า', '2014'),
    item('Armor, +1, +2, or +3', 'ชุดเกราะ +1, +2 หรือ +3', 'โบนัส AC'),
    item('Weapon, +1, +2, or +3', 'อาวุธ, +1, +2 หรือ +3', 'โบนัสโจมตี'),
    item("Heward's Handy Haversack", 'เป้สารพัดนึกของฮิวเวิร์ด', 'เป้'),
    item('Potions of Healing', 'โพชันแห่งการฟื้นฟู', 'ฟื้นฟู'),
    item('Orb of Dragonkind', 'ลูกแก้วเผ่าพันธุ์มังกร', 'Dragonlance'),
    item('Ring of X', 'แหวน X', 'ในโลก Greyhawk'),
  ], srd)
  if ('error' in r) throw new Error(r.error)

  it('matches SRD items, also +1/+2/+3, renamed and tiered ones, with people\'s names taken out', () => {
    expect(r.items).toEqual({
      'bag-of-holding': { name: 'ถุงวิเศษ', text: 'ใส่ เป้สารพัดนึก (Handy Haversack) แล้วพัง' },
      'armor-2': { name: 'ชุดเกราะ +2', text: 'โบนัส AC' },
      'weapon-1': { name: 'อาวุธ +1', text: 'โบนัสโจมตี' },
      'handy-haversack': { name: 'เป้สารพัดนึก', text: 'เป้' },
      'potions-of-healing-rare': { name: 'โพชันแห่งการฟื้นฟู (ยิ่งกว่า)', text: 'ฟื้นฟู' },
    })
  })

  it('leaves English the Dragon Orb, text naming a non-SRD world, and items DND-TH lacks', () => {
    expect(r.report).toMatchObject({ translated2024: 7, matched: 5, missing: ['Dragon Orb', 'Mace of Terror'], nonSrd: ['Ring of X (Greyhawk)'] })
    expect(buildMagicItemsTh({}, srd)).toEqual({ error: 'magic-items.json should be a list' })
  })
})
