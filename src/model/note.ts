// The DM's campaign notebook (Phase 3.4): pages for sessions, NPCs, places, quests, factions and items.
// Each page has a few key fields for its type plus free text, and links to other pages by writing
// [[Page title]] in the text. Pages belong to a campaign (or none) and stay on the DM's device:
// never sent to players. (Stored in the `notes` table; notes from before the notebook are Session pages.)
import { newId } from './character'
import { sceneTexts, type Scene } from './sessionPlan'
import type { SyncMeta } from './sync'

export const NOTE_KINDS = ['session', 'npc', 'place', 'quest', 'faction', 'item', 'rule'] as const
export type NoteKind = (typeof NOTE_KINDS)[number]

export const KIND_LABEL: Record<NoteKind, string> = {
  session: '📅 เซสชัน', npc: '🧑 NPC', place: '🏰 สถานที่', quest: '📜 ภารกิจ', faction: '🛡 กลุ่ม', item: '💎 ไอเทม',
  rule: '📏 House rule',
}

/** A key field of a page type: free text, or one of a few choices. */
export interface FieldDef {
  key: string
  label: string
  placeholder?: string
  choices?: { value: string; label: string }[]
}

const ATTITUDE = [
  { value: '', label: '—' }, { value: 'friendly', label: '😊 เป็นมิตร' }, { value: 'neutral', label: '😐 เป็นกลาง' }, { value: 'hostile', label: '😠 ไม่เป็นมิตร' },
]
/** House rules: the group's own rules, not the official ones (2024 SRD). */
export const RULE_TYPES = [
  { value: '', label: '—' }, { value: 'weapon', label: '⚔️ อาวุธ' }, { value: 'condition', label: '🔥 สถานะ' },
  { value: 'trait', label: '✨ Trait พิเศษ' }, { value: 'other', label: '📌 อื่นๆ' },
]
export const RULE_STATUS = [
  { value: 'active', label: '🟢 ใช้อยู่' }, { value: 'trial', label: '🧪 ลองใช้' }, { value: 'off', label: '⚪ เลิกใช้' },
]
export const QUEST_STATUS = [
  { value: 'open', label: '🟡 กำลังทำ' }, { value: 'done', label: '✅ สำเร็จ' }, { value: 'failed', label: '❌ ล้มเหลว' },
]

/** The few fields that matter at the table, per page type (everything else goes in the text). */
export const KIND_FIELDS: Record<NoteKind, FieldDef[]> = {
  session: [],
  npc: [
    { key: 'role', label: 'บทบาท / อาชีพ', placeholder: 'เช่น เจ้าของร้านเหล้า' },
    { key: 'where', label: 'อยู่ที่', placeholder: 'เช่น [[Phandalin]]' },
    { key: 'attitude', label: 'ท่าทีต่อปาร์ตี้', choices: ATTITUDE },
    { key: 'look', label: 'ลักษณะ / น้ำเสียง', placeholder: 'เช่น ผมแดง เสียงแหบ พูดเร็ว' },
    { key: 'wants', label: 'ต้องการอะไร', placeholder: 'เช่น อยากให้ใครสักคนตามหาน้องชาย' },
  ],
  place: [
    { key: 'type', label: 'ประเภท', placeholder: 'เช่น เมือง ดันเจี้ยน ร้านค้า' },
    { key: 'where', label: 'อยู่ใน / ใกล้', placeholder: 'เช่น ทางเหนือของ [[Neverwinter]]' },
    { key: 'who', label: 'ใครอยู่ที่นี่', placeholder: 'เช่น [[Toblen Stonehill]]' },
    { key: 'secret', label: 'ความลับ (DM)', placeholder: 'สิ่งที่ผู้เล่นยังไม่รู้' },
  ],
  quest: [
    { key: 'status', label: 'สถานะ', choices: QUEST_STATUS },
    { key: 'giver', label: 'ผู้ให้ภารกิจ', placeholder: 'เช่น [[Sildar Hallwinter]]' },
    { key: 'goal', label: 'เป้าหมาย', placeholder: 'ต้องทำอะไร' },
    { key: 'reward', label: 'รางวัล', placeholder: 'เช่น 50 gp' },
  ],
  faction: [
    { key: 'leader', label: 'ผู้นำ', placeholder: 'เช่น [[Glasstaff]]' },
    { key: 'goal', label: 'เป้าหมาย' },
    { key: 'base', label: 'ฐาน', placeholder: 'เช่น [[Tresendar Manor]]' },
    { key: 'attitude', label: 'ท่าทีต่อปาร์ตี้', choices: ATTITUDE },
  ],
  item: [
    { key: 'holder', label: 'อยู่กับใคร', placeholder: 'เช่น ปาร์ตี้ หรือ [[Glasstaff]]' },
    { key: 'where', label: 'อยู่ที่ไหน' },
    { key: 'rarity', label: 'ความหายาก', placeholder: 'เช่น Uncommon' },
    { key: 'effect', label: 'ทำอะไรได้' },
  ],
  rule: [
    { key: 'status', label: 'สถานะกฎ', choices: RULE_STATUS },
    { key: 'type', label: 'ประเภท', choices: RULE_TYPES },
    { key: 'trigger', label: 'ใช้เมื่อไร', placeholder: 'เช่น เมื่ออาวุธติดไฟ' },
    { key: 'effect', label: 'ผล', placeholder: 'เช่น ดาเมจ +2 (Fire)' },
    { key: 'duration', label: 'นานเท่าไร', placeholder: 'เช่น 2 เทิร์น' },
    { key: 'who', label: 'ใครใช้ได้', placeholder: 'เช่น ทุกคน หรือ [[Gojo Satoru]]' },
    { key: 'official', label: 'กฎทางการเดิม (SRD)', placeholder: 'กฎ 2024 ว่าอย่างไร ถ้ามี' },
  ],
}

export interface Note extends SyncMeta {
  id: string
  campaignId: string | null
  /** Page type. Notes from before the notebook have none: they are sessions. */
  kind: NoteKind
  title: string
  /** The type's key fields (see KIND_FIELDS), by key. */
  fields: Record<string, string>
  body: string
  /** The session day, as YYYY-MM-DD (used by session pages). */
  sessionDate: string
  /** Session pages: the plan, as scenes in order (see sessionPlan.ts). */
  scenes: Scene[]
  createdAt: number
}

/** Fill in what notes saved before the notebook don't have. */
export function withNoteDefaults(stored: Partial<Note> & { id: string }): Note {
  const note = { kind: 'session', fields: {}, scenes: [], ...stored } as Note
  // A page type from a newer app version: show it as a session page instead of crashing.
  return (NOTE_KINDS as readonly string[]).includes(note.kind) ? note : { ...note, kind: 'session' }
}

/**
 * The page with another type. Choice fields (like a quest's or a house rule's status) keep their value
 * only if the new type has the same choice; otherwise the new type's default is used.
 */
export function changeKind(note: Note, kind: NoteKind): Note {
  const defaults = createNote(null, 0, kind).fields
  const fields: Record<string, string> = {}
  for (const [key, value] of Object.entries(note.fields ?? {})) {
    const def = KIND_FIELDS[kind].find((f) => f.key === key)
    if (def?.choices && !def.choices.some((c) => c.value === value)) continue
    fields[key] = value
  }
  return { ...note, kind, fields: { ...defaults, ...fields } }
}

/** Today as YYYY-MM-DD in local time (not UTC, so a late-night session keeps its day). */
export function today(now = new Date()): string {
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`
}

export function createNote(campaignId: string | null, now = Date.now(), kind: NoteKind = 'session', title = ''): Note {
  const fields: Record<string, string> = kind === 'quest' ? { status: 'open' } : kind === 'rule' ? { status: 'active' } : {}
  return { id: newId(), campaignId, kind, title, fields, body: '', sessionDate: today(new Date(now)), scenes: [], createdAt: now, updatedAt: now, rev: 0, updatedBy: '' }
}

/** Notes whose title or text contains the search words (all of them, any case). */
export function searchNotes(notes: Note[], query: string): Note[] {
  const words = query.toLowerCase().split(/\s+/).filter(Boolean)
  return notes.filter((n) => {
    const text = [n.title, n.body, ...Object.values(n.fields ?? {}), ...(n.scenes ?? []).flatMap(sceneTexts)].join('\n').toLowerCase()
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

/** Text with [[links]], as parts: plain text, and links by the title written inside the brackets. */
export type TextPart = { text: string } | { link: string }

export function parseLinks(text: string): TextPart[] {
  const parts: TextPart[] = []
  let last = 0
  for (const m of text.matchAll(/\[\[([^[\]\n]{1,100})\]\]/g)) {
    if (m.index > last) parts.push({ text: text.slice(last, m.index) })
    parts.push({ link: m[1].trim() })
    last = m.index + m[0].length
  }
  if (last < text.length) parts.push({ text: text.slice(last) })
  return parts
}

const sameTitle = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase()

/** The page a [[link]] points to: same title (any case), preferring the same campaign. */
export function findPage(pages: Note[], title: string, campaignId: string | null): Note | undefined {
  const named = pages.filter((p) => p.title.trim() && sameTitle(p.title, title))
  return named.find((p) => p.campaignId === campaignId) ?? named[0]
}

/** Pages that link to this one (in their text, fields or scenes), newest first. */
export function backlinks(pages: Note[], page: Note): Note[] {
  if (!page.title.trim()) return []
  return pages
    .filter((p) => p.id !== page.id)
    .filter((p) => [p.body, ...Object.values(p.fields ?? {}), ...(p.scenes ?? []).flatMap(sceneTexts)].some((t) => parseLinks(t).some((x) => 'link' in x && sameTitle(x.link, page.title))))
    .sort((a, b) => b.updatedAt - a.updatedAt)
}

/** Text without the [[ ]] around links, for short previews. */
export const plainText = (text: string) => text.replace(/\[\[([^[\]\n]{1,100})\]\]/g, '$1')

/** One short line for lists: the page's most useful field (an NPC's role, a quest's status…). */
export function pageSummary(n: Note): string {
  const f = Object.fromEntries(Object.entries(n.fields ?? {}).map(([k, v]) => [k, plainText(v)]))
  const choice = (key: string) => KIND_FIELDS[n.kind].find((d) => d.key === key)?.choices?.find((c) => c.value === f[key])?.label
  switch (n.kind) {
    case 'npc': return [f.role, f.where, choice('attitude')].filter(Boolean).join(' · ')
    case 'place': return [f.type, f.where].filter(Boolean).join(' · ')
    case 'quest': return [choice('status'), f.giver].filter(Boolean).join(' · ')
    case 'faction': return [f.leader, choice('attitude')].filter(Boolean).join(' · ')
    case 'item': return [f.rarity, f.holder].filter(Boolean).join(' · ')
    case 'rule': return [choice('status'), choice('type'), f.effect].filter(Boolean).join(' · ')
    default: return ''
  }
}
