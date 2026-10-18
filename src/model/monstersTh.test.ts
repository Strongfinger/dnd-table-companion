import { describe, expect, it } from 'vitest'
import { buildMonstersTh, entryKeys, numbersOf, parseHeader, type MonsterForTh } from './monstersTh'
import thFile from '../data/srd-monsters-th.json'
import details from '../data/srd-monster-details.json'

const none = { traits: [], actions: [], bonusActions: [], reactions: [], legendaryActions: [] }
const mon = (id: string, name: string, s: Partial<MonsterForTh>): MonsterForTh => ({ ...none, id, name, ...s })

describe('parseHeader', () => {
  const keys = entryKeys(['Dominate Mind', 'Cold Breath', 'Running Water', 'Entangling Rope (Requires Magic Rope)', 'Vampire Weakness', 'Hooves'])

  it('takes the English name from the brackets and drops the usage from the Thai name', () => {
    expect(parseHeader('**_ควบคุมจิตใจ (Dominate Mind) (2/วัน)._** _ทอย:_ DC 16', keys)).toEqual({ key: 'dominatemind', name: 'ควบคุมจิตใจ', rest: '_ทอย:_ DC 16' })
    expect(parseHeader('**_ลมหายใจเย็น (Cold Breath (ชาร์จใหม่ 5-6)._** DC 12', keys)).toMatchObject({ key: 'coldbreath', name: 'ลมหายใจเย็น' })
  })

  it('matches names without their note, plurals and English-only headers', () => {
    expect(parseHeader('**_เชือกพันธนาการ (Entangling Rope) (ต้องใช้เชือกเวทย์มนต์)_** x', keys)).toMatchObject({ key: 'entanglingroperequiresmagicrope', name: 'เชือกพันธนาการ (ต้องใช้เชือกเวทย์มนต์)' })
    expect(parseHeader('**_จุดอ่อนแวมไพร์ (Vampire Weaknesses)_** x', keys)).toMatchObject({ key: 'vampireweakness' })
    expect(parseHeader('**_Hooves._** x', keys)).toMatchObject({ key: 'hooves', name: '' })
  })

  it('sub-entries need an English name; other bold lines (spell lists) are not headers', () => {
    expect(parseHeader('**น้ำไหล (Running Water):** 20 แต้ม', keys, true)).toEqual({ key: 'runningwater', name: 'น้ำไหล', rest: '20 แต้ม' })
    expect(parseHeader('**ตามต้องการ:** แสง (Light)', keys, true)).toBeNull()
    expect(parseHeader('ข้อความธรรมดา', keys)).toBeNull()
    // A header for an entry this stat block doesn't have: started, but dropped.
    expect(parseHeader('**_กัด (Bite)_** +5', keys)).toMatchObject({ key: null })
  })
})

describe('numbersOf', () => {
  it('compares dice, DCs and bonuses, whatever the dash or the Thai wording', () => {
    expect(numbersOf('Melee Attack Roll: +1, reach 5 ft. Hit: 1 (1d4 – 1) Piercing damage.')).toBe(numbersOf('_ทอยโจมตี:_ +1, ระยะ 5 ฟุต _โดน:_ 1 (1d4 - 1) แทง'))
    expect(numbersOf('(spell save DC 14)')).toBe(numbersOf('(DC การทอยป้องกันคาถา 14)'))
    expect(numbersOf('9 (2d8) extra')).not.toBe(numbersOf(''))
  })
})

describe('buildMonstersTh', () => {
  const srd = [
    mon('mage', 'Mage', {
      actions: [{ name: 'Spellcasting', text: 'The mage casts (spell save DC 14):' }],
      bonusActions: [{ name: 'Misty Step', text: 'The mage casts Misty Step.' }],
    }),
    mon('werewolf-human', 'Werewolf, Human Form', { actions: [{ name: 'Multiattack', text: 'Two attacks.' }, { name: 'Longbow', text: 'Ranged Attack Roll: +4' }] }),
    mon('rhinoceros', 'Rhinoceros', { actions: [{ name: 'Gore', text: 'Hit: 14 (2d8 + 5), an extra 9 (2d8).' }] }),
    mon('will-o-wisp', 'Will-o’-Wisp', { traits: [{ name: 'Ephemeral', text: 'No gear.' }] }),
    mon('warhorse-skeleton', 'Warhorse Skeleton', { actions: [{ name: 'Hooves', text: 'x' }] }),
  ]
  const r = buildMonstersTh([
    {
      version: '2024', name: 'Mage', title: 'นักเวทย์',
      actions: ['**_การใช้คาถา (Spellcasting)_** นักเวทย์ร่าย (DC การทอยป้องกันคาถา 14):', '**ตามต้องการ:** [แสง (Light)](/spells/2618996-light)'],
      bonus_actions: ['**_ก้าวย่างในสายหมอก (Misty Step) (3/วัน)_** นักเวทย์ร่ายคาถา'],
    },
    {
      version: '2024', name: 'Werewolf', title: 'มนุษย์หมาป่า',
      actions: ['**_โจมตีหลายครั้ง (Multiattack)_** โจมตี 2 ครั้ง', '**_กัด (Bite)_** +5, 2d8 + 3', '**_ธนูยาว (เฉพาะร่างมนุษย์) (Longbow)_** +4'],
    },
    { version: '2024', name: 'Rhinoceros', title: 'แรด', actions: ['**_ขวิด (Gore)_** _โดน:_ 14 (2d8 + 5)'] },
    { version: '2024', name: "Will-o'-Wisp", title: 'วิลโอวิสป์ (Will-o\'-Wisp)', traits: ['**_ร่างชั่วคราว (Ephemeral)_** ถือของไม่ได้'] },
    { version: '2014', name: 'Warhorse Skeleton', title: 'เก่า', actions: ['**_กีบ (Hooves)_** x'] },
  ], srd)
  if ('error' in r) throw new Error(r.error)

  it('keeps spell lists in the entry, links made plain, usage out of the name', () => {
    expect(r.monsters.mage).toEqual({
      name: 'นักเวทย์',
      entries: {
        actions: { Spellcasting: { name: 'การใช้คาถา', text: 'นักเวทย์ร่าย (DC การทอยป้องกันคาถา 14):\n\n**ตามต้องการ:** แสง (Light)' } },
        bonusActions: { 'Misty Step': { name: 'ก้าวย่างในสายหมอก', text: 'นักเวทย์ร่ายคาถา' } },
      },
    })
  })

  it('gives each form the shared stat block, without another form\'s entries running into its own', () => {
    expect(r.monsters['werewolf-human'].entries.actions).toEqual({
      Multiattack: { name: 'โจมตีหลายครั้ง', text: 'โจมตี 2 ครั้ง' },
      Longbow: { name: 'ธนูยาว (เฉพาะร่างมนุษย์)', text: '+4' },
    })
  })

  it('leaves an entry English when its numbers differ; matches curly apostrophes; drops the English from the title', () => {
    expect(r.monsters.rhinoceros).toEqual({ name: 'แรด', entries: {} })
    expect(r.report.numbersDiffer).toEqual(['Rhinoceros: Gore'])
    expect(r.monsters['will-o-wisp'].name).toBe('วิลโอวิสป์')
    expect(r.report.missing).toEqual(['Warhorse Skeleton'])
    expect(buildMonstersTh({}, srd)).toEqual({ error: 'monsters.json should be a list' })
  })
})

describe('srd-monsters-th.json', () => {
  type Entries = Record<string, { name: string; text: string }[]>
  const english = new Map((details as unknown as ({ id: string } & Entries)[]).map((d) => [d.id, d]))

  it('every Thai entry belongs to an English entry and has the same numbers', () => {
    const monsters = Object.entries(thFile.monsters as Record<string, { name: string; entries: Record<string, Record<string, { text: string }>> }>)
    expect(monsters.length).toBeGreaterThan(330)
    for (const [id, m] of monsters) {
      const en = english.get(id)
      expect(en, id).toBeDefined()
      expect(m.name, id).toMatch(/[ก-๛]/)
      for (const [section, entries] of Object.entries(m.entries)) {
        for (const [name, t] of Object.entries(entries)) {
          const e = en![section].find((x) => x.name === name)
          expect(e, `${id} ${name}`).toBeDefined()
          expect(numbersOf(t.text), `${id} ${name}`).toBe(numbersOf(e!.text))
          expect(t.text, `${id} ${name}`).not.toMatch(/\]\(|<\w/)
        }
      }
    }
  })
})
