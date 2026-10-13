import { describe, expect, it } from 'vitest'
import { buildSpellsTh, cleanText, parseCsv, splitTitle } from './spellsTh'

const srd = [{ id: 'fireball', name: 'Fireball' }, { id: 'hunters-mark', name: "Hunter's Mark" }, { id: 'shield', name: 'Shield' }]

function ok(csv: string) {
  const r = buildSpellsTh(csv, srd)
  if ('error' in r) throw new Error(r.error)
  return r
}

describe('parseCsv', () => {
  it('reads quotes, doubled quotes, commas and line breaks inside quotes, CRLF and a BOM', () => {
    expect(parseCsv('﻿a,b\r\n"x, y","say ""hi""\nline 2"\r\n\r\n')).toEqual([['a', 'b'], ['x, y', 'say "hi"\nline 2']])
  })
})

describe('cleanText / splitTitle', () => {
  it('drops HTML and tidies spaces but keeps paragraphs', () => {
    expect(cleanText('<p>หนึ่ง &amp;  สอง</p><p>สาม<br>สี่</p>', 100)).toBe('หนึ่ง & สอง\nสาม\nสี่')
  })
  it('splits "Thai (English)" titles', () => {
    expect(splitTitle('ลูกไฟโลกันต์ (Fireball)')).toEqual({ thai: 'ลูกไฟโลกันต์', english: 'Fireball' })
    expect(splitTitle('no english')).toBeNull()
  })
})

describe('buildSpellsTh', () => {
  it('matches by English name (any case, curly apostrophes) from either column layout', () => {
    const a = ok('english_name,thai_name,thai_text,thai_higher_levels\nFIREBALL,ลูกไฟ,ระเบิด,+1d6\n')
    expect(a.spells.fireball).toEqual({ name: 'ลูกไฟ', text: 'ระเบิด', higher: '+1d6' })
    const b = ok('title,thai_text\n"เครื่องหมายนักล่า (Hunter’s Mark)",ทำเครื่องหมาย\n')
    expect(b.spells['hunters-mark']).toEqual({ name: 'เครื่องหมายนักล่า', text: 'ทำเครื่องหมาย' })
  })

  it('reports non-SRD, duplicate, incomplete and missing spells without failing', () => {
    const { spells, report } = ok('title,thai_text\nลูกไฟ (Fireball),ก\nลูกไฟ 2014 (Fireball),ข\nประกาย (Spellfire Flare),ค\nโล่ (Shield),\n')
    expect(spells.fireball.text).toBe('ก')
    expect(report).toEqual({ rows: 4, matched: 1, notInSrd: ['Spellfire Flare'], missing: ["Hunter's Mark", 'Shield'], duplicates: ['Fireball'], incomplete: 1 })
  })

  it('explains missing columns', () => {
    expect(buildSpellsTh('name,text\na,b', srd)).toHaveProperty('error')
  })
})
