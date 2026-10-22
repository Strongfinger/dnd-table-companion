// Pinned notebook pages / scenes and "recently opened" for the DM's side panel (Phase 2c).
// Pure list operations; saving (per campaign, in the device settings) is in db/pins.ts.
import { noteTitle, searchNotes, type Note } from './note'

/** A pinned page, or one scene of a session page. */
export interface Pin {
  noteId: string
  sceneId?: string
}

export const MAX_PINS = 8
export const MAX_RECENT = 5
export const MAX_RESULTS = 6

export const samePin = (a: Pin, b: Pin) => a.noteId === b.noteId && (a.sceneId ?? '') === (b.sceneId ?? '')
export const isPinned = (pins: Pin[], p: Pin) => pins.some((x) => samePin(x, p))

/** Pin it, or unpin it if already pinned. A full strip (8) refuses a new pin and returns the same list. */
export function togglePin(pins: Pin[], p: Pin): Pin[] {
  if (isPinned(pins, p)) return pins.filter((x) => !samePin(x, p))
  if (pins.length >= MAX_PINS) return pins
  return [...pins, p.sceneId ? { noteId: p.noteId, sceneId: p.sceneId } : { noteId: p.noteId }]
}

/** Move a pin one place left (-1) or right (+1). */
export function movePin(pins: Pin[], p: Pin, dir: -1 | 1): Pin[] {
  const i = pins.findIndex((x) => samePin(x, p))
  const j = i + dir
  if (i < 0 || j < 0 || j >= pins.length) return pins
  const out = [...pins]
  ;[out[i], out[j]] = [out[j], out[i]]
  return out
}

/** Drop pins whose page (or scene) was deleted; the same list comes back if nothing changed. */
export function livePins(pins: Pin[], notes: Note[]): Pin[] {
  const ok = pins.filter((p) => {
    const n = notes.find((x) => x.id === p.noteId)
    return !!n && (!p.sceneId || n.scenes.some((s) => s.id === p.sceneId))
  })
  return ok.length === pins.length ? pins : ok
}

/** Newest first, no repeats, at most 5. Scenes count as their page. */
export function pushRecent(recent: string[], noteId: string): string[] {
  return [noteId, ...recent.filter((id) => id !== noteId)].slice(0, MAX_RECENT)
}

/** Recent page ids that still exist, as pages. */
export function recentPages(recent: string[], notes: Note[]): Note[] {
  return recent.flatMap((id) => notes.find((n) => n.id === id) ?? [])
}

export interface QuickResult {
  pin: Pin
  note: Note
  /** Scene title when the match is a scene. */
  sceneTitle?: string
}

/**
 * Notes and scenes for the quick search box. Best first: title starts with the words, title contains them,
 * scene title, then text anywhere else (body, fields, scene text). At most 6; empty query gives nothing.
 */
export function quickSearch(notes: Note[], query: string): QuickResult[] {
  const words = query.toLowerCase().split(/\s+/).filter(Boolean)
  if (words.length === 0) return []
  const scored: { r: QuickResult; score: number }[] = []
  for (const note of searchNotes(notes, query)) {
    const title = noteTitle(note).toLowerCase()
    const inTitle = words.every((w) => title.includes(w))
    const score = inTitle && title.startsWith(words[0]) ? 0 : inTitle ? 1 : 3
    scored.push({ r: { pin: { noteId: note.id }, note }, score })
    for (const s of note.scenes) {
      const st = s.title.toLowerCase()
      if (s.title && words.every((w) => st.includes(w))) scored.push({ r: { pin: { noteId: note.id, sceneId: s.id }, note, sceneTitle: s.title }, score: 2 })
    }
  }
  // Array.sort is stable: pages stay in the notebook's own order (latest edited first) within a score.
  return scored.sort((a, b) => a.score - b.score).slice(0, MAX_RESULTS).map((x) => x.r)
}
