import 'fake-indexeddb/auto'
import { beforeEach, describe, expect, it } from 'vitest'
import { createNote } from '../model/note'
import { db } from './db'
import { deleteNote, getNote, listNotes, saveNote } from './notes'

beforeEach(async () => {
  await db.notes.clear()
})

describe('note storage', () => {
  it('saves (with a new revision), lists newest first, deletes', async () => {
    const a = await saveNote({ ...createNote('camp'), title: 'A', updatedAt: 0 })
    await new Promise((r) => setTimeout(r, 5))
    const b = await saveNote({ ...createNote('camp'), title: 'B' })
    expect(a.rev).toBe(1)
    expect((await listNotes()).map((n) => n.title)).toEqual(['B', 'A'])
    await deleteNote(b.id)
    expect(await getNote(b.id)).toBeUndefined()
  })
})
