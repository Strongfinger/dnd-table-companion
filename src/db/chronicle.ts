// Read/write the journey chronicle: the DM's chapters (`chapters`) and players' downloaded copies (`storyCache`).
import { dropUnusedImages, type Chapter } from '../model/chronicle'
import { stamp } from '../model/sync'
import type { SharedBook } from '../sync/chronicleShare'
import { db } from './db'
import { deviceId } from './device'

export function listChapters(): Promise<Chapter[]> {
  return db.chapters.toArray()
}

export function getChapter(id: string): Promise<Chapter | undefined> {
  return db.chapters.get(id)
}

/** Save (pictures no longer in the text are dropped). */
export async function saveChapter(c: Chapter): Promise<Chapter> {
  const saved = stamp(dropUnusedImages(c), deviceId())
  await db.chapters.put(saved)
  return saved
}

export function deleteChapter(id: string): Promise<void> {
  return db.chapters.delete(id)
}

export function listSharedBooks(): Promise<SharedBook[]> {
  return db.storyCache.toArray()
}

export function getSharedBook(shareId: string): Promise<SharedBook | undefined> {
  return db.storyCache.get(shareId)
}

export async function saveSharedBook(b: SharedBook): Promise<void> {
  await db.storyCache.put(b)
}

export function deleteSharedBook(shareId: string): Promise<void> {
  return db.storyCache.delete(shareId)
}
