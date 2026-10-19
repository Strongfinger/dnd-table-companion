// The journey chronicle (บันทึกการเดินทาง): the campaign's story so far, told like a storybook. The DM writes
// one chapter after each session (markdown text with pictures); players read it on their phones.
//
// Chapters are saved on the DM's device (the `chapters` table, included in backups). Chapters marked
// `published` are sent to Firebase so players can read them any time (sync/chronicleShare.ts).
// Pure code: no database or network here.
import { newId } from './character'
import { today } from './note'
import type { SyncMeta } from './sync'

/** A picture in a chapter, already made small (see ui/imageResize.ts). Written in the text as ![caption](img:<id>). */
export interface ChapterImage {
  id: string
  /** "data:image/webp;base64,…" or jpeg/png. */
  dataUrl: string
  width: number
  height: number
}

export interface Chapter extends SyncMeta {
  id: string
  campaignId: string | null
  /** Order in the book (1, 2, 3…). */
  number: number
  title: string
  /** The session day, YYYY-MM-DD ('' if not set). */
  sessionDate: string
  /** The story text (simple markdown, see miniMarkdown.ts with `story`). */
  body: string
  images: ChapterImage[]
  /** Players may read it (drafts stay on the DM's device). */
  published: boolean
  createdAt: number
}

/** Limits that keep a chapter small enough to send and store (Firebase free plan, backups). */
export const MAX_CHAPTER_TEXT = 100_000
export const MAX_IMAGES_PER_CHAPTER = 12
/** One picture as text (base64). Pictures are resized to ~200 KB; this only stops a wrong one. */
export const MAX_IMAGE_CHARS = 1_500_000
export const MAX_TITLE = 200

export function createChapter(campaignId: string | null, existing: Pick<Chapter, 'campaignId' | 'number'>[], now = Date.now()): Chapter {
  const number = nextChapterNumber(existing.filter((c) => c.campaignId === campaignId))
  return {
    id: newId(), campaignId, number, title: '', sessionDate: today(new Date(now)), body: '', images: [],
    published: false, createdAt: now, updatedAt: now, rev: 0, updatedBy: '',
  }
}

export function nextChapterNumber(chapters: Pick<Chapter, 'number'>[]): number {
  return chapters.reduce((n, c) => Math.max(n, c.number), 0) + 1
}

/** Book order: by number, then by when it was written. */
export function sortChapters<T extends Pick<Chapter, 'number' | 'createdAt' | 'id'>>(chapters: T[]): T[] {
  return [...chapters].sort((a, b) => a.number - b.number || a.createdAt - b.createdAt || a.id.localeCompare(b.id))
}

/** "บทที่ 3: ถ้ำของเจลลี่" (or just "บทที่ 3"). */
export function chapterHeading(c: Pick<Chapter, 'number' | 'title'>): string {
  return c.title.trim() ? `บทที่ ${c.number}: ${c.title.trim()}` : `บทที่ ${c.number}`
}

// --- pictures in the text ---

/** The text to put in the story for a picture. Brackets in the caption would end it early, so they go. */
export function imageMarkdown(imageId: string, caption = ''): string {
  return `![${caption.replace(/[[\]\n]/g, ' ').trim()}](img:${imageId})`
}

const IMAGE_REF = /!\[[^\]\n]*\]\(img:([\w-]{1,64})\)/g

/** Ids of the pictures the text uses. */
export function usedImageIds(body: string): Set<string> {
  return new Set([...body.matchAll(IMAGE_REF)].map((m) => m[1]))
}

/** Pictures no longer in the text (deleted from it): dropped when saving, so they don't fill the device. */
export function dropUnusedImages(c: Chapter): Chapter {
  const used = usedImageIds(c.body)
  return c.images.every((i) => used.has(i.id)) ? c : { ...c, images: c.images.filter((i) => used.has(i.id)) }
}

/** Insert text at the cursor (`at`), on its own line, and say where the cursor goes after it. */
export function insertBlock(body: string, at: number, block: string): { body: string; cursor: number } {
  const pos = Math.max(0, Math.min(at, body.length))
  const before = body.slice(0, pos)
  const after = body.slice(pos)
  const lead = before === '' || before.endsWith('\n\n') ? '' : before.endsWith('\n') ? '\n' : '\n\n'
  const tail = after.startsWith('\n') ? '\n' : '\n\n'
  const inserted = `${lead}${block}${tail}`
  return { body: before + inserted + after.replace(/^\n/, ''), cursor: pos + inserted.length }
}

// --- importing a markdown file as a chapter ---

/**
 * A chapter from a .md file: the first "# heading" becomes the title (with a leading "บทที่ N:" or
 * "Session N:" taken off), the rest is the text.
 */
export function chapterFromMarkdown(text: string): { title: string; body: string } {
  const lines = text.replace(/\r\n?/g, '\n').replace(/^﻿/, '').split('\n')
  const first = lines.findIndex((l) => l.trim() !== '')
  const heading = first >= 0 ? lines[first].match(/^#\s+(.+)$/) : null
  if (!heading) return { title: '', body: text.trim().slice(0, MAX_CHAPTER_TEXT) }
  const title = heading[1].trim().replace(/^(บทที่|chapter|session)\s*\d+\s*[:：.\-–]\s*/i, '').slice(0, MAX_TITLE)
  return { title, body: lines.slice(first + 1).join('\n').trim().slice(0, MAX_CHAPTER_TEXT) }
}

// --- checking chapters from a file or the network (never trust their shape) ---

type Obj = Record<string, unknown>
const isObj = (v: unknown): v is Obj => typeof v === 'object' && v !== null && !Array.isArray(v)
const isId = (v: unknown): v is string => typeof v === 'string' && /^[\w-]{1,64}$/.test(v)
const isInt = (v: unknown, min: number, max: number): v is number => Number.isInteger(v) && (v as number) >= min && (v as number) <= max
const str = (v: unknown, max: number) => (typeof v === 'string' ? v.slice(0, max) : '')
const time = (v: unknown, fallback: number) => (typeof v === 'number' && Number.isFinite(v) && v >= 0 && v < 8.64e15 ? v : fallback)

const DATA_URL = /^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/]+=*$/

export function parseChapterImage(raw: unknown): ChapterImage | null {
  if (!isObj(raw) || !isId(raw.id) || typeof raw.dataUrl !== 'string') return null
  if (raw.dataUrl.length > MAX_IMAGE_CHARS || !DATA_URL.test(raw.dataUrl)) return null
  return { id: raw.id, dataUrl: raw.dataUrl, width: isInt(raw.width, 1, 10_000) ? raw.width : 1, height: isInt(raw.height, 1, 10_000) ? raw.height : 1 }
}

/** A chapter from a backup file or another device; null if it isn't one. Bad pictures are left out. */
export function parseChapter(raw: unknown, now = Date.now()): Chapter | null {
  if (!isObj(raw) || !isId(raw.id) || typeof raw.body !== 'string') return null
  const images = Array.isArray(raw.images) ? raw.images.slice(0, MAX_IMAGES_PER_CHAPTER).flatMap((i) => parseChapterImage(i) ?? []) : []
  return {
    id: raw.id,
    campaignId: isId(raw.campaignId) ? raw.campaignId : null,
    number: isInt(raw.number, 0, 10_000) ? raw.number : 1,
    title: str(raw.title, MAX_TITLE),
    sessionDate: typeof raw.sessionDate === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(raw.sessionDate) ? raw.sessionDate : '',
    body: raw.body.slice(0, MAX_CHAPTER_TEXT),
    images,
    published: raw.published === true,
    createdAt: time(raw.createdAt, now),
    rev: isInt(raw.rev, 0, 1e9) ? raw.rev : 0,
    updatedBy: str(raw.updatedBy, 64),
    updatedAt: time(raw.updatedAt, now),
  }
}

// --- a book to read (the DM's own chapters, or a copy downloaded for a player) ---

export interface Book {
  title: string
  chapters: Chapter[]
}

/** The DM's book for a campaign: `onlyPublished` shows what players see. */
export function bookOf(title: string, chapters: Chapter[], campaignId: string | null, onlyPublished: boolean): Book {
  return { title, chapters: sortChapters(chapters.filter((c) => c.campaignId === campaignId && (!onlyPublished || c.published))) }
}

/** Previous and next chapter in a book (null at the ends). */
export function neighbours(book: Book, chapterId: string): { prev: Chapter | null; next: Chapter | null } {
  const i = book.chapters.findIndex((c) => c.id === chapterId)
  if (i < 0) return { prev: null, next: null }
  return { prev: book.chapters[i - 1] ?? null, next: book.chapters[i + 1] ?? null }
}

/** About how long a chapter takes to read (Thai has no spaces between words, so count characters). */
export function readingMinutes(body: string): number {
  const chars = body.replace(IMAGE_REF, '').replace(/\s+/g, '').length
  return Math.max(1, Math.round(chars / 600))
}
