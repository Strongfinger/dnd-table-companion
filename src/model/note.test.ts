import { describe, expect, it } from 'vitest'
import { backlinks, createNote, findPage, noteTitle, pageSummary, parseLinks, searchNotes, thaiDate, today, withNoteDefaults } from './note'

describe('notes', () => {
  it('today uses local time', () => {
    expect(today(new Date(2026, 9, 12, 23, 30))).toBe('2026-10-12')
  })

  it('a new note starts empty for the campaign and today', () => {
    const n = createNote('camp', new Date(2026, 0, 5).getTime())
    expect(n).toMatchObject({ campaignId: 'camp', title: '', body: '', sessionDate: '2026-01-05', rev: 0 })
  })

  it('search matches every word in the title or text', () => {
    const a = { ...createNote(null), title: 'Session 3', body: 'ปาร์ตี้เจอ Goblin ที่ถ้ำ' }
    const b = { ...createNote(null), title: 'NPC', body: 'Sildar ผู้คุ้มกัน' }
    expect(searchNotes([a, b], 'goblin ถ้ำ')).toEqual([a])
    expect(searchNotes([a, b], '')).toEqual([a, b])
  })

  it('shows dates the Thai way', () => {
    expect(thaiDate('2026-10-12')).toMatch(/12 ต\.ค\. 2569/)
    expect(thaiDate('')).toBe('')
  })

  it('a list title falls back to the first line', () => {
    expect(noteTitle({ title: '', body: 'แผนการเล่น\nรายละเอียด' })).toBe('แผนการเล่น')
    expect(noteTitle({ title: '  ', body: '' })).toBe('(ยังไม่มีชื่อ)')
  })
})

describe('notebook pages', () => {
  const page = (kind: Parameters<typeof createNote>[2], title: string, body = '', fields: Record<string, string> = {}, campaignId: string | null = 'camp') =>
    ({ ...createNote(campaignId, Date.now(), kind, title), body, fields: { ...createNote(null, 0, kind).fields, ...fields } })

  it('old notes become session pages', () => {
    const old = { id: 'n1', campaignId: null, title: 'Session 1', body: '', sessionDate: '2026-10-01', createdAt: 0, updatedAt: 0, rev: 1, updatedBy: '' }
    expect(withNoteDefaults(old)).toMatchObject({ kind: 'session', fields: {} })
  })

  it('a new quest starts open', () => {
    expect(createNote('camp', 0, 'quest', 'Find Gundren').fields).toEqual({ status: 'open' })
  })

  it('a new house rule starts active and is listed with its effect', () => {
    const rule = createNote('camp', 0, 'rule', 'Burning')
    expect(rule.fields).toEqual({ status: 'active' })
    rule.fields = { ...rule.fields, type: 'condition', effect: '1d4 Fire ต่อเทิร์น' }
    expect(pageSummary(rule)).toBe('🟢 ใช้อยู่ · 🔥 สถานะ · 1d4 Fire ต่อเทิร์น')
  })

  it('reads [[links]] in text', () => {
    expect(parseLinks('Met [[Sildar]] at [[ Phandalin ]].')).toEqual([{ text: 'Met ' }, { link: 'Sildar' }, { text: ' at ' }, { link: 'Phandalin' }, { text: '.' }])
    expect(parseLinks('no links')).toEqual([{ text: 'no links' }])
    expect(parseLinks('[[broken')).toEqual([{ text: '[[broken' }])
  })

  it('finds linked pages (same campaign first) and pages that link here', () => {
    const sildar = page('npc', 'Sildar Hallwinter', '', { where: '[[Phandalin]]' })
    const other = page('npc', 'Sildar Hallwinter', '', {}, 'other-camp')
    const town = page('place', 'Phandalin')
    const session = page('session', 'Session 1', 'ช่วย [[sildar hallwinter]] ไว้ได้')
    expect(findPage([other, sildar, town], 'sildar hallwinter', 'camp')?.id).toBe(sildar.id)
    expect(findPage([town], 'Nowhere', 'camp')).toBeUndefined()
    expect(backlinks([sildar, town, session], town).map((p) => p.id)).toEqual([sildar.id]) // linked from a field
    expect(backlinks([sildar, town, session], sildar).map((p) => p.id)).toEqual([session.id])
  })

  it('summarises a page in one line', () => {
    expect(pageSummary(page('npc', 'Toblen', '', { role: 'เจ้าของโรงเตี๊ยม', attitude: 'friendly' }))).toBe('เจ้าของโรงเตี๊ยม · 😊 เป็นมิตร')
    expect(pageSummary(page('quest', 'Find Gundren', '', { giver: 'Sildar' }))).toBe('🟡 กำลังทำ · Sildar')
    expect(pageSummary(page('npc', 'Sildar', '', { where: '[[Phandalin]]' }))).toBe('Phandalin')
  })

  it('search looks in fields too', () => {
    const npc = page('npc', 'Toblen', '', { role: 'innkeeper' })
    expect(searchNotes([npc], 'innkeeper')).toEqual([npc])
  })
})
