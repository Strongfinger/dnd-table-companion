// Write one session note. Saves by itself a moment after you stop typing.
import { useLiveQuery } from 'dexie-react-hooks'
import { useEffect, useRef, useState } from 'react'
import { go } from '../app/router'
import { listCampaigns } from '../db/campaigns'
import { deleteNote, getNote, saveNote } from '../db/notes'
import type { Note } from '../model/note'
import { Button, TextInput } from '../ui/kit'

const SAVE_AFTER_MS = 700

export default function NoteEdit({ id }: { id: string }) {
  const [note, setNote] = useState<Note | null | undefined>(undefined)
  const [status, setStatus] = useState<'saved' | 'saving' | 'changed' | 'idle'>('idle')
  const [confirmDelete, setConfirmDelete] = useState(false)
  const campaigns = useLiveQuery(listCampaigns) ?? []
  // Set when the text changed and isn't saved yet.
  const dirty = useRef(false)

  useEffect(() => {
    getNote(id).then((n) => setNote(n ?? null))
  }, [id])

  // Save a moment after the last change.
  useEffect(() => {
    if (!note || !dirty.current) return
    const timer = setTimeout(async () => {
      dirty.current = false
      setStatus('saving')
      await saveNote(note)
      setStatus('saved')
    }, SAVE_AFTER_MS)
    return () => clearTimeout(timer)
  }, [note])

  if (note === undefined) return null
  if (note === null) return <p className="text-center text-stone-400">ไม่พบบันทึกนี้ · <a href="#/dm" className="underline">กลับ</a></p>

  const n = note
  const set = (patch: Partial<Note>) => {
    dirty.current = true
    setStatus('changed')
    setNote({ ...n, ...patch })
  }

  async function back() {
    // Don't lose the last few letters typed just before leaving.
    if (dirty.current) await saveNote(n)
    go('/dm')
  }

  return (
    <div className="space-y-3 pb-24">
      <button type="button" onClick={back} className="text-sm text-stone-400">← ผู้ช่วย DM</button>
      <TextInput value={n.title} placeholder="ชื่อบันทึก เช่น เซสชัน 3: ถ้ำก็อบลิน" onChange={(title) => set({ title })} />
      <div className="flex flex-wrap gap-2">
        <input
          type="date"
          aria-label="วันที่เล่น"
          className="rounded-lg border border-stone-600 bg-stone-900 px-3 py-2 text-base"
          value={n.sessionDate}
          onChange={(e) => set({ sessionDate: e.target.value })}
        />
        <select
          aria-label="แคมเปญ"
          className="min-w-0 flex-1 rounded-lg border border-stone-600 bg-stone-900 px-3 py-2 text-base"
          value={n.campaignId ?? ''}
          onChange={(e) => set({ campaignId: e.target.value || null })}
        >
          <option value="">— ไม่มีแคมเปญ —</option>
          {campaigns.map((c) => <option key={c.id} value={c.id}>🗺 {c.name}</option>)}
        </select>
      </div>
      <textarea
        aria-label="บันทึก"
        className="min-h-[50dvh] w-full rounded-lg border border-stone-600 bg-stone-900 px-3 py-2 text-base leading-relaxed"
        placeholder="แผนเซสชัน, NPC ที่เจอ, สิ่งที่ผู้เล่นทำ, เบาะแส, ของที่ได้…"
        value={n.body}
        onChange={(e) => set({ body: e.target.value })}
      />
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs text-stone-500">{status === 'saving' ? 'กำลังบันทึก…' : status === 'saved' ? '✓ บันทึกแล้ว' : status === 'changed' ? '…' : 'บันทึกให้อัตโนมัติ'}</span>
        <div className="flex gap-2">
          <Button className="text-sm" onClick={() => setConfirmDelete(!confirmDelete)}>🗑 ลบ</Button>
          {confirmDelete && <Button variant="danger" className="text-sm" onClick={async () => { await deleteNote(n.id); go('/dm') }}>ยืนยันลบ</Button>}
        </div>
      </div>
    </div>
  )
}
