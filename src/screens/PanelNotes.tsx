// Always visible at the top of the DM panel (Phase 2c): the pinned strip (tonight's pages and scenes, one tap to open)
// and the quick search for notes and scenes ("/" focuses it; Enter opens the top result, Shift+Enter pins it).
import { useEffect, useState } from 'react'
import { movePinned, setPins, togglePinned, usePins, useRecent } from '../db/pins'
import { KIND_LABEL, noteTitle, pageSummary, type Note } from '../model/note'
import { livePins, quickSearch, recentPages, type Pin, type QuickResult } from '../model/pins'
import PinButton from './PinButton'

const emoji = (n: Note) => KIND_LABEL[n.kind].split(' ')[0]
const short = (s: string, max = 14) => (s.length > max ? `${s.slice(0, max)}…` : s)

/** Pins in order; a pin whose page was deleted is dropped from the saved list. */
export function PinnedStrip({ campaignId, notes, onOpen }: { campaignId: string | null; notes: Note[]; onOpen: (p: Pin) => void }) {
  const saved = usePins(campaignId)
  const [editing, setEditing] = useState(false)
  const pins = saved ? livePins(saved, notes) : []
  // Clean up pins of deleted pages (only once the notes have loaded).
  useEffect(() => {
    if (saved && notes.length > 0 && pins !== saved) void setPins(campaignId, pins)
  })

  if (pins.length === 0) {
    return <p className="px-3 py-2 text-xs text-stone-500">📌 ยังไม่ได้ปักหมุด · เปิดหน้าสมุดแล้วกด 📌 เพื่อปักไว้ที่นี่</p>
  }
  return (
    <div className="flex items-center gap-1 px-2 py-1.5">
      <span aria-hidden className="text-sm">📌</span>
      <ul className="flex min-w-0 flex-1 gap-1 overflow-x-auto">
        {pins.map((p) => {
          const note = notes.find((n) => n.id === p.noteId)!
          const scene = p.sceneId ? note.scenes.find((s) => s.id === p.sceneId) : undefined
          const full = scene ? `ฉาก: ${scene.title}` : noteTitle(note)
          return (
            <li key={`${p.noteId}/${p.sceneId ?? ''}`} className="flex shrink-0 items-center rounded-lg bg-stone-900">
              {editing && <button type="button" aria-label={`เลื่อน ${full} ไปซ้าย`} className="h-10 px-1.5 text-stone-400 hover:text-amber-300" onClick={() => void movePinned(campaignId, p, -1)}>◀</button>}
              <button type="button" title={full} aria-label={`เปิด ${full}`} onClick={() => onOpen(p)} className="h-10 whitespace-nowrap px-2.5 text-sm hover:bg-stone-700 lg:h-10">
                {scene ? 'ฉาก: ' : `${emoji(note)} `}{short(scene ? scene.title : noteTitle(note))}
              </button>
              {editing && (
                <>
                  <button type="button" aria-label={`เลื่อน ${full} ไปขวา`} className="h-10 px-1.5 text-stone-400 hover:text-amber-300" onClick={() => void movePinned(campaignId, p, 1)}>▶</button>
                  <button type="button" aria-label={`เลิกปักหมุด ${full}`} className="h-10 px-2 text-red-300 hover:text-red-200" onClick={() => void togglePinned(campaignId, p)}>✕</button>
                </>
              )}
            </li>
          )
        })}
      </ul>
      <button
        type="button"
        aria-pressed={editing}
        aria-label="จัดเรียง/เลิกปักหมุด"
        onClick={() => setEditing(!editing)}
        className={`h-10 shrink-0 rounded-lg px-2 text-sm ${editing ? 'bg-amber-500 font-bold text-stone-900' : 'text-stone-400 hover:bg-stone-700'}`}
      >
        {editing ? 'เสร็จ' : '✎'}
      </button>
    </div>
  )
}

/** Type to find a page or scene; with nothing typed it lists the pages opened most recently. */
export function QuickSearch({ campaignId, notes, onOpen }: { campaignId: string | null; notes: Note[]; onOpen: (p: Pin) => void }) {
  const [query, setQuery] = useState('')
  const [index, setIndex] = useState(0)
  const [focused, setFocused] = useState(false)
  const recent = useRecent(campaignId) ?? []

  const typed = query.trim().length > 0
  const results: QuickResult[] = typed
    ? quickSearch(notes, query)
    : recentPages(recent, notes).map((note) => ({ pin: { noteId: note.id }, note }))
  const at = Math.min(index, Math.max(results.length - 1, 0))
  // The list shows while typing, and for "ล่าสุด" while the box has the cursor.
  const showList = typed || (focused && results.length > 0)

  function open(r: QuickResult) {
    onOpen(r.pin)
    setQuery('')
    setIndex(0)
    ;(document.activeElement as HTMLElement | null)?.blur()
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.nativeEvent.isComposing) return
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault()
      setIndex(Math.max(0, Math.min(results.length - 1, at + (e.key === 'ArrowDown' ? 1 : -1))))
    } else if (e.key === 'Enter' && results[at]) {
      e.preventDefault()
      if (e.shiftKey) void togglePinned(campaignId, results[at].pin)
      else open(results[at])
    } else if (e.key === 'Escape') {
      setQuery('')
      setIndex(0)
      e.currentTarget.blur()
    }
  }

  return (
    <div className="px-2 pb-2">
      <input
        data-quick-search
        type="search"
        value={query}
        placeholder="🔎 ค้นหาสมุดและฉาก ( / )"
        aria-label="ค้นหาสมุดและฉาก"
        className="w-full rounded-lg border border-stone-600 bg-stone-900 px-3 py-2 text-base"
        onChange={(e) => { setQuery(e.target.value); setIndex(0) }}
        onFocus={() => setFocused(true)}
        onBlur={() => setTimeout(() => setFocused(false), 150)}
        onKeyDown={onKeyDown}
      />
      {showList && (
        <div className="mt-1 rounded-lg bg-stone-900 p-1">
          {!typed && <p className="px-2 pt-1 text-xs text-stone-400">ล่าสุด</p>}
          {typed && results.length === 0 && <p className="px-2 py-1.5 text-sm text-stone-500">ไม่พบหน้าหรือฉากที่ตรงกัน</p>}
          <ul>
            {results.map((r, i) => (
              <li key={`${r.pin.noteId}/${r.pin.sceneId ?? ''}`} className={`flex items-center rounded-lg ${i === at ? 'bg-stone-700' : ''}`}>
                <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => open(r)} className="min-w-0 flex-1 p-2 text-left">
                  <span className="block truncate font-bold">
                    {r.sceneTitle ? <>ฉาก: {r.sceneTitle} <span className="font-normal text-stone-400">· {noteTitle(r.note)}</span></> : <>{emoji(r.note)} {noteTitle(r.note)}</>}
                  </span>
                  {!r.sceneTitle && pageSummary(r.note) && <span className="block truncate text-xs text-amber-200/80">{pageSummary(r.note)}</span>}
                </button>
                <span onMouseDown={(e) => e.preventDefault()}>
                  <PinButton campaignId={campaignId} pin={r.pin} className="h-11" />
                </span>
              </li>
            ))}
          </ul>
          {typed && results.length > 0 && <p className="px-2 pb-1 text-xs text-stone-500">Enter = เปิดอันบนสุด · Shift+Enter = ปักหมุด · Esc = ล้าง</p>}
        </div>
      )}
    </div>
  )
}
