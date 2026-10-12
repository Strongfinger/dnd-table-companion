import { describe, expect, it } from 'vitest'
import { backlinks, createNote, searchNotes, withNoteDefaults } from './note'
import { addCheck, createScene, moveScene, progress, removeCheck, setCheck, splitUnplayed, updateScene } from './sessionPlan'

describe('session plan scenes', () => {
  const a = createScene('Arrive in Phandalin')
  const b = createScene('Goblin ambush')
  const c = createScene('Talk to Sildar')

  it('reorders, updates and counts progress', () => {
    expect(moveScene([a, b, c], c.id, -1).map((s) => s.title)).toEqual(['Arrive in Phandalin', 'Talk to Sildar', 'Goblin ambush'])
    expect(moveScene([a, b, c], a.id, -1)).toEqual([a, b, c]) // already first
    const played = updateScene([a, b, c], a.id, { done: true })
    expect(progress(played)).toEqual({ done: 1, total: 3 })
  })

  it('manages a checklist', () => {
    let s = addCheck(a, '  ให้แผนที่ไป Cragmaw  ')
    s = addCheck(s, '   ') // empty: ignored
    expect(s.checklist.map((x) => x.text)).toEqual(['ให้แผนที่ไป Cragmaw'])
    const id = s.checklist[0].id
    expect(setCheck(s, id, true).checklist[0].done).toBe(true)
    expect(removeCheck(s, id).checklist).toEqual([])
  })

  it('carries unplayed scenes over with fresh ticks', () => {
    const half = { ...addCheck(b, 'clue'), checklist: [{ id: 'k', text: 'clue', done: true }] }
    const r = splitUnplayed([{ ...a, done: true }, half])
    expect(r.played.map((s) => s.title)).toEqual(['Arrive in Phandalin'])
    expect(r.carried.map((s) => [s.title, s.checklist[0].done])).toEqual([['Goblin ambush', false]])
  })

  it('scene text counts for search and [[links]]; older pages get an empty plan', () => {
    const sildar = { ...createNote('camp', 0, 'npc', 'Sildar') }
    const session = { ...createNote('camp', 0, 'session', 'Session 2'), scenes: [{ ...c, notes: 'ถามเรื่อง [[Sildar]]' }] }
    expect(backlinks([sildar, session], sildar).map((p) => p.id)).toEqual([session.id])
    expect(searchNotes([session], 'phandalin')).toEqual([])
    expect(searchNotes([session], 'talk')).toEqual([session])
    expect(withNoteDefaults({ id: 'old' }).scenes).toEqual([])
  })
})
