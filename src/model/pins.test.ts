import { describe, expect, it } from 'vitest'
import { createNote, type Note } from './note'
import { createScene } from './sessionPlan'
import { isPinned, livePins, MAX_PINS, movePin, pushRecent, quickSearch, recentPages, togglePin, type Pin } from './pins'

const page = (title: string, kind: Note['kind'] = 'npc', body = ''): Note => ({ ...createNote('c', 1, kind, title), id: title, body })

describe('pins', () => {
  it('pins and unpins a page or a scene separately', () => {
    let pins: Pin[] = []
    pins = togglePin(pins, { noteId: 'a' })
    pins = togglePin(pins, { noteId: 'a', sceneId: 's1' })
    expect(pins).toEqual([{ noteId: 'a' }, { noteId: 'a', sceneId: 's1' }])
    expect(isPinned(pins, { noteId: 'a', sceneId: 's1' })).toBe(true)
    expect(togglePin(pins, { noteId: 'a' })).toEqual([{ noteId: 'a', sceneId: 's1' }])
  })

  it('stops at 8 pins but still lets you unpin', () => {
    const full = Array.from({ length: MAX_PINS }, (_, i) => ({ noteId: `n${i}` }))
    expect(togglePin(full, { noteId: 'extra' })).toBe(full)
    expect(togglePin(full, { noteId: 'n0' })).toHaveLength(MAX_PINS - 1)
  })

  it('moves a pin and stays put at the ends', () => {
    const pins = [{ noteId: 'a' }, { noteId: 'b' }, { noteId: 'c' }]
    expect(movePin(pins, { noteId: 'b' }, -1).map((p) => p.noteId)).toEqual(['b', 'a', 'c'])
    expect(movePin(pins, { noteId: 'c' }, 1)).toBe(pins)
    expect(movePin(pins, { noteId: 'a' }, -1)).toBe(pins)
    expect(movePin(pins, { noteId: 'zzz' }, 1)).toBe(pins)
  })

  it('drops pins of deleted pages and scenes', () => {
    const session = { ...page('s', 'session'), scenes: [createScene('Cave')] }
    const sceneId = session.scenes[0].id
    const pins = [{ noteId: 's' }, { noteId: 's', sceneId }, { noteId: 's', sceneId: 'gone' }, { noteId: 'deleted' }]
    expect(livePins(pins, [session])).toEqual([{ noteId: 's' }, { noteId: 's', sceneId }])
    const ok = [{ noteId: 's' }]
    expect(livePins(ok, [session])).toBe(ok)
  })

  it('keeps the 5 latest opened pages, no repeats', () => {
    let r: string[] = []
    for (const id of ['a', 'b', 'c', 'd', 'e', 'f']) r = pushRecent(r, id)
    expect(r).toEqual(['f', 'e', 'd', 'c', 'b'])
    expect(pushRecent(r, 'd')).toEqual(['d', 'f', 'e', 'c', 'b'])
    expect(recentPages(['x', 'f'], [page('f')]).map((n) => n.id)).toEqual(['f'])
  })
})

describe('quickSearch', () => {
  const wolf = page('Wolf Den', 'place')
  const mention = page('Mira', 'npc', 'afraid of the wolf pack')
  const session: Note = { ...page('Session 3', 'session'), scenes: [createScene('Wolf ambush'), createScene('Tavern')] }

  it('gives nothing for an empty query', () => {
    expect(quickSearch([wolf], '  ')).toEqual([])
  })

  it('ranks title matches first, then scene titles, then text', () => {
    const r = quickSearch([mention, session, wolf], 'wolf')
    expect(r.map((x) => x.pin)).toEqual([
      { noteId: 'Wolf Den' },
      { noteId: 'Session 3', sceneId: session.scenes[0].id },
      { noteId: 'Mira' },
      { noteId: 'Session 3' }, // the session page itself matches through its scene text
    ])
    expect(r[1].sceneTitle).toBe('Wolf ambush')
  })

  it('matches every word and caps at 6 results', () => {
    expect(quickSearch([wolf, mention], 'wolf pack').map((x) => x.note.id)).toEqual(['Mira'])
    const many = Array.from({ length: 9 }, (_, i) => page(`Goblin ${i}`))
    expect(quickSearch(many, 'goblin')).toHaveLength(6)
  })
})
