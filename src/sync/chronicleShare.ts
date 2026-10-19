// Sharing the journey chronicle with players through Firebase, so they can read it on their phones any time
// (not only during a live room). The DM's device sends the chapters marked "players may read"; a player's
// phone downloads them and keeps a copy for offline reading (db/chronicle.ts).
//
// Layout (protected by database.rules.json):
//   chronicles/{shareId}/owner                 sign-in id of the DM's device (only it may write)
//   chronicles/{shareId}/title                 campaign name
//   chronicles/{shareId}/updatedAt
//   chronicles/{shareId}/toc/{chapterId}       { number, title, sessionDate, updatedAt }  (small: the list)
//   chronicles/{shareId}/chapters/{chapterId}  the chapter as JSON text, pictures left out
//   chronicles/{shareId}/images/{chapterId}/{imageId}  one picture (data URL)
// The share id is long and random: only people given it (the room, or the link) can find the book.
import { MAX_TITLE, parseChapter, sortChapters, type Chapter } from '../model/chronicle'
import { firebaseConfig } from './firebaseTransport'

export interface TocEntry {
  number: number
  title: string
  sessionDate: string
  updatedAt: number
}

/** A downloaded book on a player's phone. */
export interface SharedBook {
  shareId: string
  title: string
  chapters: Chapter[]
  fetchedAt: number
}

export const SHARE_ID_LENGTH = 20
const SHARE_CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'

export function newShareId(random: (n: number) => Uint8Array = (n) => crypto.getRandomValues(new Uint8Array(n))): string {
  // 62 letters: bytes ≥ 248 would favour the first few, so they are skipped.
  let id = ''
  while (id.length < SHARE_ID_LENGTH) for (const b of random(SHARE_ID_LENGTH * 2)) if (b < 248 && id.length < SHARE_ID_LENGTH) id += SHARE_CHARS[b % 62]
  return id
}

export const isShareId = (v: unknown): v is string => typeof v === 'string' && new RegExp(`^[A-Za-z0-9]{${SHARE_ID_LENGTH}}$`).test(v)

// --- pure: what to send / download ---

export function tocEntry(c: Chapter): TocEntry {
  return { number: c.number, title: c.title, sessionDate: c.sessionDate, updatedAt: c.updatedAt }
}

/** The chapter as stored in Firebase: pictures only by size (their data goes under images/). */
export function chapterJson(c: Chapter): string {
  return JSON.stringify({ ...c, images: c.images.map(({ id, width, height }) => ({ id, width, height })) })
}

/** DM: which chapters to (re)send and which to take down, given what Firebase has now. */
export function planPublish(chapters: Chapter[], remote: Record<string, TocEntry>): { put: Chapter[]; remove: string[] } {
  const shown = chapters.filter((c) => c.published)
  const ids = new Set(shown.map((c) => c.id))
  return {
    put: shown.filter((c) => remote[c.id]?.updatedAt !== c.updatedAt || remote[c.id]?.number !== c.number),
    remove: Object.keys(remote).filter((id) => !ids.has(id)),
  }
}

/** Read the chapter list from Firebase (network data: check everything). */
export function parseToc(raw: unknown): Record<string, TocEntry> {
  const out: Record<string, TocEntry> = {}
  if (typeof raw !== 'object' || raw === null) return out
  for (const [id, v] of Object.entries(raw as Record<string, unknown>).slice(0, 500)) {
    if (!/^[\w-]{1,64}$/.test(id) || typeof v !== 'object' || v === null) continue
    const e = v as Record<string, unknown>
    if (!Number.isInteger(e.number) || !Number.isFinite(e.updatedAt)) continue
    out[id] = {
      number: e.number as number, updatedAt: e.updatedAt as number,
      title: typeof e.title === 'string' ? e.title.slice(0, MAX_TITLE) : '',
      sessionDate: typeof e.sessionDate === 'string' ? e.sessionDate.slice(0, 10) : '',
    }
  }
  return out
}

/** Player: chapters to download (new or changed since the saved copy). */
export function chaptersToFetch(toc: Record<string, TocEntry>, cached: Chapter[]): string[] {
  const have = new Map(cached.map((c) => [c.id, c.updatedAt]))
  return Object.keys(toc).filter((id) => have.get(id) !== toc[id].updatedAt)
}

/** A downloaded chapter with its pictures put back. Null if it isn't a valid chapter. */
export function assembleChapter(id: string, json: unknown, images: unknown): Chapter | null {
  if (typeof json !== 'string') return null
  let raw: unknown
  try {
    raw = JSON.parse(json)
  } catch {
    return null
  }
  if (typeof raw !== 'object' || raw === null) return null
  const sizes = new Map<string, { width: unknown; height: unknown }>()
  const list = (raw as { images?: unknown }).images
  if (Array.isArray(list)) for (const i of list) if (typeof i === 'object' && i !== null && typeof (i as { id?: unknown }).id === 'string') sizes.set((i as { id: string }).id, i as { width: unknown; height: unknown })
  const data = typeof images === 'object' && images !== null ? (images as Record<string, unknown>) : {}
  const withData = Object.entries(data).map(([imgId, dataUrl]) => ({ id: imgId, dataUrl, ...sizes.get(imgId) }))
  return parseChapter({ ...(raw as object), id, images: withData, published: true })
}

/** The book after a download: saved chapters still listed, replaced by fresh ones, in book order. */
export function mergeBook(toc: Record<string, TocEntry>, cached: Chapter[], fresh: Chapter[]): Chapter[] {
  const byId = new Map(cached.filter((c) => toc[c.id]).map((c) => [c.id, c]))
  for (const c of fresh) byId.set(c.id, c)
  return sortChapters([...byId.values()])
}

// --- Firebase ---

export type ShareError = 'not-set-up' | 'offline' | 'not-owner' | 'not-found' | 'denied'

export const SHARE_ERROR_TEXT: Record<ShareError, string> = {
  'not-set-up': 'แอปนี้ยังไม่ได้ตั้งค่า Firebase (ใช้แชร์ไม่ได้)',
  offline: 'เชื่อมต่ออินเทอร์เน็ตไม่ได้ ลองใหม่เมื่อออนไลน์',
  'not-owner': 'เครื่องนี้ไม่ใช่เครื่องที่สร้างลิงก์นี้ (เช่น ล้างข้อมูลเครื่องไปแล้ว) กด "สร้างลิงก์ใหม่" แล้วส่งลิงก์ใหม่ให้ผู้เล่น',
  'not-found': 'ไม่พบบันทึกการเดินทางนี้ (DM อาจยังไม่ได้ส่ง หรือลิงก์ผิด)',
  denied: 'Firebase ไม่อนุญาต: DM ต้องอัปเดตกฎ (database.rules.json) ใน Firebase Console ก่อน',
}

export class ShareFailed extends Error {
  readonly reason: ShareError
  constructor(reason: ShareError) {
    super(reason)
    this.reason = reason
  }
}

async function connect() {
  const config = firebaseConfig()
  if (!config) throw new ShareFailed('not-set-up')
  const [{ initializeApp, getApps }, auth, db] = await Promise.all([
    import('firebase/app'), import('firebase/auth'), import('firebase/database'),
  ])
  const app = getApps()[0] ?? initializeApp(config)
  let uid: string
  try {
    uid = (await auth.signInAnonymously(auth.getAuth(app))).user.uid
  } catch {
    throw new ShareFailed('offline')
  }
  return { db, database: db.getDatabase(app), uid }
}

/** Firebase errors → a reason the screen can explain. */
function reasonOf(err: unknown): ShareError {
  if (err instanceof ShareFailed) return err.reason
  const text = String((err as { code?: string; message?: string })?.code ?? (err as Error)?.message ?? err).toLowerCase()
  return text.includes('permission') ? 'denied' : 'offline'
}

/** Firebase calls wait forever offline; give up after a while instead. */
function inTime<T>(p: Promise<T>, ms = 20_000): Promise<T> {
  return Promise.race([p, new Promise<T>((_, reject) => setTimeout(() => reject(new ShareFailed('offline')), ms))])
}

/**
 * DM: send the published chapters (only what changed) and take down the rest. Returns how many were sent
 * and removed. Throws ShareFailed.
 */
export async function publishChronicle(shareId: string, title: string, chapters: Chapter[], onProgress?: (done: number, total: number) => void): Promise<{ sent: number; removed: number }> {
  try {
    const { db, database, uid } = await connect()
    const root = `chronicles/${shareId}`
    const owner = (await inTime(db.get(db.ref(database, `${root}/owner`)))).val()
    if (owner !== null && owner !== uid) throw new ShareFailed('not-owner')
    const remote = parseToc((await inTime(db.get(db.ref(database, `${root}/toc`)))).val())
    const plan = planPublish(chapters, remote)
    await inTime(db.update(db.ref(database, root), { owner: uid, title: title.slice(0, MAX_TITLE), updatedAt: Date.now() }))
    // One chapter per write (all its parts together), so a dropped connection never leaves half a chapter.
    let done = 0
    for (const c of plan.put) {
      onProgress?.(done, plan.put.length)
      await inTime(db.update(db.ref(database, root), {
        [`chapters/${c.id}`]: chapterJson(c),
        [`images/${c.id}`]: c.images.length ? Object.fromEntries(c.images.map((i) => [i.id, i.dataUrl])) : null,
        [`toc/${c.id}`]: tocEntry(c),
      }), 120_000)
      done++
    }
    if (plan.remove.length) {
      await inTime(db.update(db.ref(database, root), Object.fromEntries(plan.remove.flatMap((id) => [[`chapters/${id}`, null], [`images/${id}`, null], [`toc/${id}`, null]]))))
    }
    return { sent: plan.put.length, removed: plan.remove.length }
  } catch (err) {
    throw new ShareFailed(reasonOf(err))
  }
}

/** Player: download what's new in a shared book, on top of the saved copy. Throws ShareFailed. */
export async function fetchChronicle(shareId: string, cached: SharedBook | undefined, now = Date.now()): Promise<SharedBook> {
  try {
    const { db, database } = await connect()
    const root = `chronicles/${shareId}`
    const [titleSnap, tocSnap] = await inTime(Promise.all([db.get(db.ref(database, `${root}/title`)), db.get(db.ref(database, `${root}/toc`))]))
    if (titleSnap.val() === null && tocSnap.val() === null) throw new ShareFailed('not-found')
    const toc = parseToc(tocSnap.val())
    const old = cached?.chapters ?? []
    const fresh: Chapter[] = []
    for (const id of chaptersToFetch(toc, old)) {
      const [json, images] = await inTime(Promise.all([db.get(db.ref(database, `${root}/chapters/${id}`)), db.get(db.ref(database, `${root}/images/${id}`))]), 120_000)
      const c = assembleChapter(id, json.val(), images.val())
      if (c) fresh.push(c)
    }
    const title = typeof titleSnap.val() === 'string' ? (titleSnap.val() as string).slice(0, MAX_TITLE) : cached?.title ?? ''
    return { shareId, title, chapters: mergeBook(toc, old, fresh), fetchedAt: now }
  } catch (err) {
    throw new ShareFailed(reasonOf(err))
  }
}
