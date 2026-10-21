import { describe, expect, it } from 'vitest'
import { effectSummary, srdSummaryByName, type MagicItemSummaryFile } from './magicItemSummary'
import { MAX_ITEM_SUMMARY } from './inventory'
import type { LootItem } from './generators'

const items: MagicItemSummaryFile['items'] = {
  'adamantine-armor': { name: 'Adamantine Armor', summary: 'Critical Hit กลายเป็นการโดนธรรมดา' },
}

describe('magic item summaries', () => {
  it('finds the SRD summary by English name', () => {
    expect(srdSummaryByName(items, '  adamantine  Armor ')).toBe('Critical Hit กลายเป็นการโดนธรรมดา')
    expect(srdSummaryByName(items, 'Ring of the Old King')).toBeUndefined()
  })

  it('shows the item\'s own summary, else the SRD one, else the start of its text', () => {
    const text = '*Uncommon*\n\nข้อความยาวมาก'
    expect(effectSummary({ name: 'Adamantine Armor', summary: 'ของ DM', description: text }, items)).toBe('ของ DM')
    expect(effectSummary({ name: 'Adamantine Armor', description: text }, items)).toBe('Critical Hit กลายเป็นการโดนธรรมดา')
    expect(effectSummary({ name: 'Ring of the Old King', description: text }, items)).toBe('ข้อความยาวมาก')
  })

  it('has a short summary for every SRD magic item', async () => {
    const file = (await import('../data/srd-magic-items-summary-th.json')).default as MagicItemSummaryFile
    const all = (await import('../data/srd-magic-items.json')).default as LootItem[]
    expect(Object.keys(file.items).sort()).toEqual(all.map((i) => i.id).sort())
    for (const i of all) {
      const s = file.items[i.id]
      expect(s.name).toBe(i.name)
      expect(s.summary.length).toBeGreaterThan(5)
      expect(s.summary.length).toBeLessThanOrEqual(MAX_ITEM_SUMMARY)
    }
  })
})
