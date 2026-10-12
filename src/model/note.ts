// The DM's session notes. Each belongs to a campaign (or none). They stay on the DM's device:
// never sent to players.
import { newId } from './character'
import type { SyncMeta } from './sync'

export interface Note extends SyncMeta {
  id: string
  campaignId: string | null
  title: string
  body: string
  /** The session day, as YYYY-MM-DD. */
  sessionDate: string
  createdAt: number
}

/** Today as YYYY-MM-DD in local time (not UTC, so a late-night session keeps its day). */
export function today(now = new Date()): string {
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`
}

export function createNote(campaignId: string | null, now = Date.now()): Note {
  return { id: newId(), campaignId, title: '', body: '', sessionDate: today(new Date(now)), createdAt: now, updatedAt: now, rev: 0, updatedBy: '' }
}

/** Notes whose title or text contains the search words (all of them, any case). */
export function searchNotes(notes: Note[], query: string): Note[] {
  const words = query.toLowerCase().split(/\s+/).filter(Boolean)
  return notes.filter((n) => {
    const text = `${n.title}\n${n.body}`.toLowerCase()
    return words.every((w) => text.includes(w))
  })
}

/** A short preview line for lists: the title, or the first line of text. */
export function noteTitle(n: Pick<Note, 'title' | 'body'>): string {
  return n.title.trim() || n.body.trim().split('\n')[0].slice(0, 60) || '(ยังไม่มีชื่อ)'
}

/** "2026-10-12" → "12 ต.ค. 2569" (Thai date, Buddhist year). */
export function thaiDate(ymd: string): string {
  const [y, m, d] = ymd.split('-').map(Number)
  return y ? new Date(y, m - 1, d).toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: 'numeric' }) : ''
}
