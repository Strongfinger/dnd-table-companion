import { describe, expect, it } from 'vitest'
import { createChapter, type Chapter } from '../model/chronicle'
import { assembleChapter, chapterJson, chaptersToFetch, isShareId, mergeBook, newShareId, parseToc, planPublish, tocEntry } from './chronicleShare'

const ch = (id: string, patch: Partial<Chapter> = {}): Chapter => ({ ...createChapter('doip', [], 1000), id, published: true, ...patch })

describe('chronicle sharing', () => {
  it('makes long random share ids', () => {
    const id = newShareId()
    expect(isShareId(id)).toBe(true)
    expect(newShareId()).not.toBe(id)
    expect(isShareId('short')).toBe(false)
    // Bytes from 248 up are skipped, so every letter is equally likely.
    expect(newShareId(() => new Uint8Array(40).fill(250).map((v, i) => (i % 2 ? v : 0)))).toBe('A'.repeat(20))
  })

  it('sends only new or changed published chapters, and takes down the rest', () => {
    const a = ch('a', { updatedAt: 5 })
    const b = ch('b', { updatedAt: 7 })
    const draft = ch('d', { published: false })
    const remote = { a: tocEntry(a), b: { ...tocEntry(b), updatedAt: 6 }, old: tocEntry(ch('old')), d: tocEntry(draft) }
    const plan = planPublish([a, b, draft], remote)
    expect(plan.put.map((c) => c.id)).toEqual(['b'])
    expect(plan.remove.sort()).toEqual(['d', 'old'])
    expect(planPublish([a], { a: { ...tocEntry(a), number: 9 } }).put).toHaveLength(1)
  })

  it('pictures travel separately and come back together', () => {
    const c = ch('a', { body: '![x](img:p1)', images: [{ id: 'p1', dataUrl: 'data:image/webp;base64,UklGRg==', width: 800, height: 600 }] })
    const json = chapterJson(c)
    expect(json).not.toContain('base64')
    expect(assembleChapter('a', json, { p1: 'data:image/webp;base64,UklGRg==' })).toEqual(c)
    // A missing picture is just left out; broken data is not a chapter.
    expect(assembleChapter('a', json, null)?.images).toEqual([])
    expect(assembleChapter('a', '{oops', null)).toBeNull()
    expect(assembleChapter('a', 42, null)).toBeNull()
  })

  it('players download only what changed and keep the rest', () => {
    const a = ch('a', { updatedAt: 5, number: 1 })
    const b = ch('b', { updatedAt: 5, number: 2 })
    const toc = parseToc({ a: tocEntry(a), b: { ...tocEntry(b), updatedAt: 8 }, 'bad id!': tocEntry(a), c: { title: 1 } })
    expect(Object.keys(toc)).toEqual(['a', 'b'])
    expect(chaptersToFetch(toc, [a, b])).toEqual(['b'])
    const fresh = { ...b, updatedAt: 8, title: 'ใหม่' }
    const gone = ch('gone')
    expect(mergeBook(toc, [b, a, gone], [fresh]).map((c) => [c.id, c.title])).toEqual([['a', ''], ['b', 'ใหม่']])
    expect(parseToc(null)).toEqual({})
  })
})
