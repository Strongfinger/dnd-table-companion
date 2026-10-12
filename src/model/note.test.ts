import { describe, expect, it } from 'vitest'
import { createNote, noteTitle, searchNotes, thaiDate, today } from './note'

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
