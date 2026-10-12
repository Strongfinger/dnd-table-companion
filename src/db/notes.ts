// Read/write the DM's campaign notebook pages (the `notes` table; older notes read as Session pages).
import { withNoteDefaults, type Note } from '../model/note'
import { stamp } from '../model/sync'
import { db } from './db'
import { deviceId } from './device'

/** All notes, most recently edited first. */
export function listNotes(): Promise<Note[]> {
  return db.notes.orderBy('updatedAt').reverse().toArray().then((all) => all.map(withNoteDefaults))
}

export function getNote(id: string): Promise<Note | undefined> {
  return db.notes.get(id).then((n) => n && withNoteDefaults(n))
}

export async function saveNote(n: Note): Promise<Note> {
  const saved = stamp(n, deviceId())
  await db.notes.put(saved)
  return saved
}

export function deleteNote(id: string): Promise<void> {
  return db.notes.delete(id)
}
