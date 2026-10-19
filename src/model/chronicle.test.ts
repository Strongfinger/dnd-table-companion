import { describe, expect, it } from 'vitest'
import {
  bookOf, chapterFromMarkdown, chapterHeading, createChapter, dropUnusedImages, imageMarkdown, insertBlock, neighbours,
  nextChapterNumber, parseChapter, readingMinutes, sortChapters, usedImageIds, type Chapter,
} from './chronicle'
import { parseMarkdown } from './miniMarkdown'

const img = (id: string) => ({ id, dataUrl: 'data:image/jpeg;base64,/9j/4AAQ', width: 10, height: 10 })
const ch = (patch: Partial<Chapter>): Chapter => ({ ...createChapter('doip', [], 1000), ...patch })

describe('chapters', () => {
  it('numbers a new chapter after the last one of its campaign', () => {
    const existing = [ch({ number: 1 }), ch({ number: 4 }), ch({ number: 9, campaignId: 'other' })]
    expect(createChapter('doip', existing).number).toBe(5)
    expect(createChapter('new', existing).number).toBe(1)
    expect(nextChapterNumber([])).toBe(1)
    expect(createChapter('doip', []).published).toBe(false)
  })

  it('sorts by number, and names chapters in Thai', () => {
    const list = sortChapters([ch({ id: 'b', number: 2 }), ch({ id: 'a', number: 1 })])
    expect(list.map((c) => c.id)).toEqual(['a', 'b'])
    expect(chapterHeading({ number: 3, title: ' เหมืองดวอร์ฟ ' })).toBe('บทที่ 3: เหมืองดวอร์ฟ')
    expect(chapterHeading({ number: 3, title: '' })).toBe('บทที่ 3')
  })

  it('a book shows one campaign; players only get published chapters', () => {
    const all = [ch({ id: 'a', number: 1, published: true }), ch({ id: 'b', number: 2 }), ch({ id: 'c', campaignId: 'other', published: true })]
    expect(bookOf('Icespire', all, 'doip', false).chapters.map((c) => c.id)).toEqual(['a', 'b'])
    expect(bookOf('Icespire', all, 'doip', true).chapters.map((c) => c.id)).toEqual(['a'])
    const book = bookOf('Icespire', all, 'doip', false)
    expect(neighbours(book, 'a')).toEqual({ prev: null, next: book.chapters[1] })
    expect(neighbours(book, 'b').next).toBeNull()
  })

  it('pictures: written as ![caption](img:id), unused ones dropped on save', () => {
    expect(imageMarkdown('p1', 'ทาง[เข้า]')).toBe('![ทาง เข้า](img:p1)')
    const c = ch({ body: `เริ่มเรื่อง\n\n${imageMarkdown('p1', 'ถ้ำ')}`, images: [img('p1'), img('p2')] })
    expect([...usedImageIds(c.body)]).toEqual(['p1'])
    expect(dropUnusedImages(c).images.map((i) => i.id)).toEqual(['p1'])
  })

  it('inserts a picture on its own line at the cursor', () => {
    expect(insertBlock('ab', 1, 'X')).toEqual({ body: 'a\n\nX\n\nb', cursor: 6 })
    expect(insertBlock('', 0, 'X').body).toBe('X\n\n')
    expect(insertBlock('a\n\n', 3, 'X').body).toBe('a\n\nX\n\n')
  })

  it('imports a markdown file: the first heading becomes the title', () => {
    expect(chapterFromMarkdown('# บทที่ 1: เหมืองดวอร์ฟ\n\nกาลครั้งหนึ่ง')).toEqual({ title: 'เหมืองดวอร์ฟ', body: 'กาลครั้งหนึ่ง' })
    expect(chapterFromMarkdown('﻿\n# Session 2 - The Orcs\ntext')).toEqual({ title: 'The Orcs', body: 'text' })
    expect(chapterFromMarkdown('no heading\nhere')).toEqual({ title: '', body: 'no heading\nhere' })
  })

  it('checks chapters from files or the network', () => {
    const good = ch({ id: 'x', title: 'T', body: 'b', images: [img('p1')], published: true })
    expect(parseChapter(JSON.parse(JSON.stringify(good)))).toEqual(good)
    expect(parseChapter({ id: 'bad id!', body: '' })).toBeNull()
    expect(parseChapter({ id: 'x' })).toBeNull()
    const evil = parseChapter({ ...good, images: [{ id: 'e', dataUrl: 'data:text/html;base64,PHNjcmlwdD4=' }, { id: 'f', dataUrl: 'https://x/y.png' }] })
    expect(evil?.images).toEqual([])
  })

  it('reading time counts characters (Thai has no spaces), at least a minute', () => {
    expect(readingMinutes('สั้น')).toBe(1)
    expect(readingMinutes('ก'.repeat(3000))).toBe(5)
  })
})

describe('story markdown', () => {
  it('reads pictures, quotes and scene breaks only in story mode', () => {
    const md = 'ย่อหน้า\n\n![ถ้ำ](img:p1)\n\n> "ระวัง!"\n> Norbus\n\n---'
    expect(parseMarkdown(md, { story: true }).map((b) => b.kind)).toEqual(['p', 'img', 'quote', 'hr'])
    expect(parseMarkdown(md, { story: true })[1]).toEqual({ kind: 'img', id: 'p1', caption: 'ถ้ำ' })
    expect(parseMarkdown(md).map((b) => b.kind)).toEqual(['p', 'p', 'p', 'p'])
  })
})

describe('picture limit', () => {
  it('keeps a fully illustrated chapter (one picture per scene, e.g. 14)', () => {
    const images = Array.from({ length: 14 }, (_, i) => ({ id: `p${i}`, dataUrl: 'data:image/jpeg;base64,/9j/4AAQ', width: 10, height: 10 }))
    expect(parseChapter({ ...createChapter('doip', [], 1000), images })?.images).toHaveLength(14)
  })
})
