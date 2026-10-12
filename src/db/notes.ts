// Read/write the DM's session notes.
import type { Note } from '../model/note'
import { stamp } from '../model/sync'
import { db } from './db'
import { deviceId } from './device'

/** All notes, most recently edited first. */
export function listNotes(): Promise<Note[]> {
  return db.notes.orderBy('updatedAt').reverse().toArray()
}

export function getNote(id: string): Promise<Note | undefined> {
  return db.notes.get(id)
}

export async function saveNote(n: Note): Promise<Note> {
  const saved = stamp(n, deviceId())
  await db.notes.put(saved)
  return saved
}

export function deleteNote(id: string): Promise<void> {
  return db.notes.delete(id)
}
