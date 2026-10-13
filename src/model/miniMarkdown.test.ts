import { describe, expect, it } from 'vitest'
import { parseInline, parseMarkdown } from './miniMarkdown'

describe('parseInline', () => {
  it('reads *italic* and ***bold italic*** as DND-TH writes them, but not a lone star', () => {
    expect(parseInline('***คาถา (Spells).*** ใช้ *ถุงวิเศษ* ได้')).toEqual([
      { text: 'คาถา (Spells).', bold: true, italic: true }, { text: ' ใช้ ' }, { text: 'ถุงวิเศษ', italic: true }, { text: ' ได้' },
    ])
    expect(parseInline('5 * 3 = 15')).toEqual([{ text: '5 * 3 = 15' }])
  })

  it('reads bold, italic, both, and escapes', () => {
    expect(parseInline('ก **ข** _ค_ **_ง_** \\* จ')).toEqual([
      { text: 'ก ' }, { text: 'ข', bold: true }, { text: ' ' }, { text: 'ค', italic: true }, { text: ' ' },
      { text: 'ง', bold: true, italic: true }, { text: ' * จ' },
    ])
  })
  it('leaves HTML as plain text (it is never rendered as HTML)', () => {
    expect(parseInline('<img src=x onerror=alert(1)>')).toEqual([{ text: '<img src=x onerror=alert(1)>' }])
  })
})

describe('parseMarkdown', () => {
  it('splits paragraphs, keeps line breaks, and reads headings, lists and tables', () => {
    const md = 'หนึ่ง\nต่อ\n\n#### หัวข้อ\n- ก\n* ข\n\n| ผล | ความหมาย |\n| --- | --- |\n| Weal | ดี |\n| Woe | แย่ |\n\nจบ'
    expect(parseMarkdown(md)).toEqual([
      { kind: 'p', lines: [[{ text: 'หนึ่ง' }], [{ text: 'ต่อ' }]] },
      { kind: 'h', line: [{ text: 'หัวข้อ' }] },
      { kind: 'ul', items: [[{ text: 'ก' }], [{ text: 'ข' }]] },
      { kind: 'table', head: [[{ text: 'ผล' }], [{ text: 'ความหมาย' }]], rows: [[[{ text: 'Weal' }], [{ text: 'ดี' }]], [[{ text: 'Woe' }], [{ text: 'แย่' }]]] },
      { kind: 'p', lines: [[{ text: 'จบ' }]] },
    ])
  })
})
