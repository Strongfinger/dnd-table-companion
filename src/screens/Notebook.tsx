// The campaign notebook (Phase 3.4): pages for sessions, NPCs, places, quests, factions and items.
// A page opens in view mode (fields, text with clickable [[links]], pages that link here) and switches
// to edit mode (saves by itself a moment after typing). Used on the DM tab and in the DM panel.
import { useLiveQuery } from 'dexie-react-hooks'
import { useEffect, useRef, useState, type ReactNode } from 'react'
import { go } from '../app/router'
import { listCampaigns } from '../db/campaigns'
import { deleteNote, getNote, listNotes, saveNote } from '../db/notes'
import {
  backlinks, createNote, findPage, KIND_FIELDS, KIND_LABEL, NOTE_KINDS, noteTitle, pageSummary, parseLinks, plainText, searchNotes, thaiDate,
  type Note, type NoteKind,
} from '../model/note'
import { Button, TextInput } from '../ui/kit'

const SAVE_AFTER_MS = 700
const select = 'rounded-lg border border-stone-600 bg-stone-900 px-3 py-2 text-base'

/** The #/dm/note/<id> page. */
export default function NotePageRoute({ id }: { id: string }) {
  return <NotebookPage id={id} onBack={() => go('/dm')} onOpen={(next) => go(`/dm/note/${next}`)} backLabel="← ผู้ช่วย DM" />
}

/** Pages of a campaign (null = all), filtered by type and search; new pages by type. */
export function NotebookList({ campaignId, onOpen }: { campaignId: string | null; onOpen: (id: string) => void }) {
  const all = useLiveQuery(listNotes)
  const [kind, setKind] = useState<NoteKind | 'all'>('all')
  const [query, setQuery] = useState('')
  const [newKind, setNewKind] = useState<NoteKind>('session')
  const inCampaign = (all ?? []).filter((n) => !campaignId || n.campaignId === campaignId)
  const shown = searchNotes(inCampaign.filter((n) => kind === 'all' || n.kind === kind), query)
  const count = (k: NoteKind) => inCampaign.filter((n) => n.kind === k).length

  async function add() {
    const n = await saveNote(createNote(campaignId, Date.now(), newKind))
    onOpen(n.id)
  }

  return (
    <div className="space-y-3">
      <div className="flex gap-2">
        <select aria-label="ประเภทหน้าใหม่" className={`min-w-0 flex-1 ${select}`} value={newKind} onChange={(e) => setNewKind(e.target.value as NoteKind)}>
          {NOTE_KINDS.map((k) => <option key={k} value={k}>{KIND_LABEL[k]}</option>)}
        </select>
        <Button variant="primary" className="whitespace-nowrap" onClick={add}>+ หน้าใหม่</Button>
      </div>
      <div className="flex flex-wrap gap-1">
        {(['all', ...NOTE_KINDS] as const).map((k) => (
          <button
            key={k}
            type="button"
            onClick={() => setKind(k)}
            className={`rounded-full border px-2.5 py-0.5 text-xs ${kind === k ? 'border-amber-400 bg-amber-500 font-bold text-stone-900' : 'border-stone-600'}`}
          >
            {k === 'all' ? `ทั้งหมด ${inCampaign.length}` : `${KIND_LABEL[k]} ${count(k)}`}
          </button>
        ))}
      </div>
      {inCampaign.length > 3 && <TextInput value={query} placeholder="ค้นหา เช่น ชื่อ NPC เมือง ภารกิจ" onChange={setQuery} />}
      {all && shown.length === 0 && (
        <p className="text-sm text-stone-500">{query || kind !== 'all' ? 'ไม่พบหน้าที่ตรงกัน' : 'ยังไม่มีหน้า · เลือกประเภทแล้วกด "+ หน้าใหม่" (เช่น NPC ที่ปาร์ตี้เพิ่งเจอ)'}</p>
      )}
      <ul className="space-y-1.5">
        {shown.map((n) => (
          <li key={n.id}>
            <button type="button" onClick={() => onOpen(n.id)} className="w-full rounded-lg bg-stone-900 p-2.5 text-left hover:bg-stone-700">
              <div className="flex items-baseline justify-between gap-2">
                <span className="font-bold">{KIND_LABEL[n.kind].split(' ')[0]} {noteTitle(n)}</span>
                {n.kind === 'session' && <span className="shrink-0 text-xs text-stone-400">{thaiDate(n.sessionDate)}</span>}
              </div>
              {pageSummary(n) && <p className="text-xs text-amber-200/80">{pageSummary(n)}</p>}
              {n.body && <p className="line-clamp-2 text-xs text-stone-400">{plainText(n.body)}</p>}
            </button>
          </li>
        ))}
      </ul>
    </div>
  )
}

/** One page: view mode with links, or edit mode (a page just created starts in edit mode). */
export function NotebookPage({ id, onBack, onOpen, backLabel }: {
  id: string
  onBack: () => void
  onOpen: (id: string) => void
  backLabel: string
}) {
  const [note, setNote] = useState<Note | null | undefined>(undefined)
  const [editing, setEditing] = useState(false)
  const pages = useLiveQuery(listNotes) ?? []

  useEffect(() => {
    getNote(id).then((n) => {
      setNote(n ?? null)
      // A page just created (from "+ หน้าใหม่" or a [[link]]) opens for editing.
      setEditing(!!n && n.rev <= 1 && !n.body)
    })
  }, [id])

  if (note === undefined) return null
  if (note === null) return <p className="text-center text-stone-400">ไม่พบหน้านี้ · <button type="button" onClick={onBack} className="underline">กลับ</button></p>

  /** Open a [[link]]: the page with that title, or a new one (as an NPC unless the DM changes it). */
  async function follow(title: string) {
    const target = findPage(pages, title, note!.campaignId)
    if (target) return onOpen(target.id)
    const created = await saveNote(createNote(note!.campaignId, Date.now(), 'npc', title))
    onOpen(created.id)
  }

  return editing
    ? <PageEditor note={note} pages={pages} onDone={(saved) => { setNote(saved); setEditing(false) }} onDeleted={onBack} />
    : <PageView note={note} pages={pages} backLabel={backLabel} onBack={onBack} onEdit={() => setEditing(true)} onFollow={follow} onOpen={onOpen} />
}

/** Text with its [[links]] as buttons; links to missing pages are dashed (tap to create one). */
function LinkedText({ text, pages, campaignId, onFollow }: { text: string; pages: Note[]; campaignId: string | null; onFollow: (title: string) => void }) {
  return (
    <>
      {parseLinks(text).map((p, i) => {
        if ('text' in p) return <span key={i}>{p.text}</span>
        const exists = !!findPage(pages, p.link, campaignId)
        return (
          <button
            key={i}
            type="button"
            onClick={() => onFollow(p.link)}
            title={exists ? 'เปิดหน้านี้' : 'ยังไม่มีหน้านี้: แตะเพื่อสร้าง'}
            className={`font-bold underline ${exists ? 'text-sky-300' : 'text-stone-400 decoration-dashed'}`}
          >
            {p.link}
          </button>
        )
      })}
    </>
  )
}

function PageView({ note, pages, backLabel, onBack, onEdit, onFollow, onOpen }: {
  note: Note
  pages: Note[]
  backLabel: string
  onBack: () => void
  onEdit: () => void
  onFollow: (title: string) => void
  onOpen: (id: string) => void
}) {
  const linked = (text: string): ReactNode => <LinkedText text={text} pages={pages} campaignId={note.campaignId} onFollow={onFollow} />
  const fields = KIND_FIELDS[note.kind].filter((f) => note.fields[f.key])
  const linksHere = backlinks(pages, note)
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <button type="button" onClick={onBack} className="text-sm text-stone-400">{backLabel}</button>
        <Button className="text-sm" onClick={onEdit}>✏️ แก้ไข</Button>
      </div>
      <header>
        <p className="text-xs text-stone-400">{KIND_LABEL[note.kind]}{note.kind === 'session' && ` · ${thaiDate(note.sessionDate)}`}</p>
        <h2 className="text-2xl font-bold text-amber-400">{noteTitle(note)}</h2>
      </header>
      {fields.length > 0 && (
        <dl className="space-y-1 rounded-lg bg-stone-900 p-3 text-sm">
          {fields.map((f) => (
            <div key={f.key} className="flex gap-2">
              <dt className="shrink-0 text-stone-400">{f.label}:</dt>
              <dd>{f.choices ? f.choices.find((c) => c.value === note.fields[f.key])?.label ?? note.fields[f.key] : linked(note.fields[f.key])}</dd>
            </div>
          ))}
        </dl>
      )}
      {note.body ? <div className="whitespace-pre-line leading-relaxed">{linked(note.body)}</div> : <p className="text-sm text-stone-500">ยังไม่มีรายละเอียด · กด ✏️ แก้ไข</p>}
      {linksHere.length > 0 && (
        <div className="border-t border-stone-700 pt-2">
          <p className="mb-1 text-xs text-stone-400">ถูกพูดถึงใน</p>
          <div className="flex flex-wrap gap-1">
            {linksHere.map((p) => (
              <button key={p.id} type="button" onClick={() => onOpen(p.id)} className="rounded-full bg-stone-900 px-2.5 py-1 text-xs hover:bg-stone-700">
                {KIND_LABEL[p.kind].split(' ')[0]} {noteTitle(p)}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

/** Edit a page; saves by itself a moment after the last change. */
function PageEditor({ note: start, pages, onDone, onDeleted }: { note: Note; pages: Note[]; onDone: (saved: Note) => void; onDeleted: () => void }) {
  const [note, setNote] = useState(start)
  const [status, setStatus] = useState<'saved' | 'saving' | 'changed' | 'idle'>('idle')
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [linkPick, setLinkPick] = useState('')
  const campaigns = useLiveQuery(listCampaigns) ?? []
  const dirty = useRef(false)
  const bodyRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    if (!dirty.current) return
    const timer = setTimeout(async () => {
      dirty.current = false
      setStatus('saving')
      await saveNote(note)
      setStatus('saved')
    }, SAVE_AFTER_MS)
    return () => clearTimeout(timer)
  }, [note])

  const set = (patch: Partial<Note>) => {
    dirty.current = true
    setStatus('changed')
    setNote((n) => ({ ...n, ...patch }))
  }
  const setField = (key: string, value: string) => set({ fields: { ...note.fields, [key]: value } })

  async function done() {
    // Don't lose the last few letters typed just before leaving edit mode.
    const saved = dirty.current ? await saveNote(note) : note
    dirty.current = false
    onDone(saved)
  }

  /** Put [[title]] where the cursor is in the text. */
  function insertLink(title: string) {
    if (!title) return
    const el = bodyRef.current
    const at = el?.selectionStart ?? note.body.length
    const body = `${note.body.slice(0, at)}[[${title}]]${note.body.slice(el?.selectionEnd ?? at)}`
    set({ body })
    setLinkPick('')
  }

  const otherTitles = [...new Set(pages.filter((p) => p.id !== note.id && p.title.trim() && (!note.campaignId || p.campaignId === note.campaignId)).map((p) => p.title.trim()))].sort()
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs text-stone-500">{status === 'saving' ? 'กำลังบันทึก…' : status === 'saved' ? '✓ บันทึกแล้ว' : status === 'changed' ? '…' : 'บันทึกให้อัตโนมัติ'}</span>
        <Button variant="primary" className="text-sm" onClick={done}>✓ เสร็จ</Button>
      </div>
      <div className="flex flex-wrap gap-2">
        <select aria-label="ประเภทหน้า" className={select} value={note.kind} onChange={(e) => set({ kind: e.target.value as NoteKind })}>
          {NOTE_KINDS.map((k) => <option key={k} value={k}>{KIND_LABEL[k]}</option>)}
        </select>
        <select aria-label="แคมเปญ" className={`min-w-0 flex-1 ${select}`} value={note.campaignId ?? ''} onChange={(e) => set({ campaignId: e.target.value || null })}>
          <option value="">— ไม่มีแคมเปญ —</option>
          {campaigns.map((c) => <option key={c.id} value={c.id}>🗺 {c.name}</option>)}
        </select>
      </div>
      <TextInput value={note.title} placeholder={note.kind === 'session' ? 'เช่น เซสชัน 3: ถ้ำก็อบลิน' : 'ชื่อ (ใช้ลิงก์ด้วย [[ชื่อนี้]])'} onChange={(title) => set({ title })} />
      {note.kind === 'session' && (
        <input type="date" aria-label="วันที่เล่น" className={select} value={note.sessionDate} onChange={(e) => set({ sessionDate: e.target.value })} />
      )}
      {KIND_FIELDS[note.kind].map((f) => (
        <label key={f.key} className="block text-sm">
          <span className="text-stone-400">{f.label}</span>
          {f.choices ? (
            <select className={`mt-1 w-full ${select}`} value={note.fields[f.key] ?? ''} onChange={(e) => setField(f.key, e.target.value)}>
              {f.choices.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
            </select>
          ) : (
            <div className="mt-1"><TextInput value={note.fields[f.key] ?? ''} placeholder={f.placeholder} onChange={(v) => setField(f.key, v)} /></div>
          )}
        </label>
      ))}
      <div className="flex gap-2">
        <select aria-label="แทรกลิงก์ไปหน้าอื่น" className={`min-w-0 flex-1 ${select}`} value={linkPick} onChange={(e) => insertLink(e.target.value)}>
          <option value="">🔗 แทรกลิงก์ไปหน้า… (หรือพิมพ์ [[ชื่อ]] เอง)</option>
          {otherTitles.map((t) => <option key={t} value={t}>{t}</option>)}
        </select>
      </div>
      <textarea
        ref={bodyRef}
        aria-label="รายละเอียด"
        className="min-h-[40dvh] w-full rounded-lg border border-stone-600 bg-stone-900 px-3 py-2 text-base leading-relaxed"
        placeholder={note.kind === 'session' ? 'แผนเซสชัน, สิ่งที่เกิดขึ้น, เบาะแส, ของที่ได้… พิมพ์ [[ชื่อ]] เพื่อลิงก์ไปหน้า NPC/สถานที่' : 'รายละเอียด ความสัมพันธ์ ความลับ… พิมพ์ [[ชื่อ]] เพื่อลิงก์'}
        value={note.body}
        onChange={(e) => set({ body: e.target.value })}
      />
      <div className="flex justify-end gap-2">
        <Button className="text-sm" onClick={() => setConfirmDelete(!confirmDelete)}>🗑 ลบหน้านี้</Button>
        {confirmDelete && <Button variant="danger" className="text-sm" onClick={async () => { await deleteNote(note.id); onDeleted() }}>ยืนยันลบ</Button>}
      </div>
    </div>
  )
}
