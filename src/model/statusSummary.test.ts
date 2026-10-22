// Status chips and HP change previews shown in the HP box.
import { describe, expect, it } from 'vitest'
import { createCharacter } from './character'
import { activeStatuses, hpChangePreview } from './statusSummary'

const hero = createCharacter({ name: 'Hee', hp: { max: 20, current: 15, temp: 0 } })

describe('activeStatuses', () => {
  it('is empty for a character with nothing on', () => {
    expect(activeStatuses(hero)).toEqual([])
  })

  it('lists conditions first, then Exhaustion, Concentration, buffs and magic items', () => {
    const c = {
      ...hero,
      conditions: ['Prone' as const, 'Poisoned' as const],
      exhaustion: 2,
      concentration: 'Bless',
      buffs: [{ id: 'ls', name: 'Longstrider', note: '', mods: { speed: 10 }, ends: 'shortRest' as const }],
      inventory: [{ id: 'am', name: 'Amulet of Health', qty: 1, magic: true, equipped: true, description: 'CON 19' }],
    }
    const chips = activeStatuses(c as typeof hero)
    expect(chips.map((x) => x.kind)).toEqual(['condition', 'condition', 'exhaustion', 'concentration', 'buff', 'magic'])
    expect(chips[0]).toMatchObject({ label: 'Prone ล้มลง', term: 'Prone' })
    expect(chips[2].label).toBe('Exhaustion 2')
    expect(chips[3].label).toBe('Concentration: Bless')
    expect(chips[4].label).toBe('Longstrider Speed +10 ft.')
    expect(chips[5].label).toBe('Amulet of Health')
  })

  it('shows a buff with no numbers by its name only', () => {
    const c = { ...hero, buffs: [{ id: 'b', name: 'Bless', note: '+1d4', mods: {}, ends: 'shortRest' as const }] }
    expect(activeStatuses(c)[0].label).toBe('Bless')
  })
})

describe('hpChangePreview', () => {
  it('damage: HP before and after', () => {
    expect(hpChangePreview(hero, 'damage', 5)).toBe('15 → 10 / 20 HP')
  })

  it('damage: Temp HP is lost first', () => {
    const c = { ...hero, hp: { ...hero.hp, temp: 4 } }
    expect(hpChangePreview(c, 'damage', 6)).toBe('15 → 13 / 20 HP · Temp 4 → 0')
  })

  it('damage: dropping to 0 and massive damage', () => {
    expect(hpChangePreview(hero, 'damage', 15)).toContain('ล้มลง 0 HP')
    expect(hpChangePreview(hero, 'damage', 35)).toContain('💀 ตาย')
  })

  it('damage at 0 HP: a death save failure (2 on a Critical Hit)', () => {
    const down = { ...hero, hp: { ...hero.hp, current: 0 } }
    expect(hpChangePreview(down, 'damage', 3)).toContain('Death Save ล้มเหลว 1/3')
    expect(hpChangePreview(down, 'damage', 3, true)).toContain('Death Save ล้มเหลว 2/3')
  })

  it('heal: never above max', () => {
    expect(hpChangePreview(hero, 'heal', 3)).toBe('15 → 18 / 20 HP')
    expect(hpChangePreview(hero, 'heal', 30)).toBe('15 → 20 / 20 HP')
  })

  it('Temp HP: keeps the higher, does not stack', () => {
    expect(hpChangePreview(hero, 'temp', 5)).toBe('Temp HP 0 → 5')
    const c = { ...hero, hp: { ...hero.hp, temp: 8 } }
    expect(hpChangePreview(c, 'temp', 5)).toContain('ไม่ซ้อนกัน')
    expect(hpChangePreview(c, 'temp', 10)).toBe('Temp HP 8 → 10')
  })
})
