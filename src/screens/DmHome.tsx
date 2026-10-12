// The DM's tools (Phase 3): session notes per campaign. Generators and lookup come next.
// Everything here stays on the DM's device.
import { useLiveQuery } from 'dexie-react-hooks'
import { useEffect, useState } from 'react'
import { go } from '../app/router'
import { getSetting } from '../db/device'
import { listNotes, saveNote } from '../db/notes'
import { createNote, noteTitle, searchNotes, thaiDate } from '../model/note'
import CampaignPicker, { ALL } from '../ui/CampaignPicker'
import { Button, Section, TextInput } from '../ui/kit'

export default function DmHome() {
  const all = useLiveQuery(listNotes)
  const [campaignId, setCampaignId] = useState(ALL)
  const [query, setQuery] = useState('')
  useEffect(() => {
    getSetting<string>('currentCampaignId').then((id) => id && setCampaignId(id))
  }, [])
  const inCampaign = campaignId === ALL ? all : all?.filter((n) => n.campaignId === campaignId)
  const notes = inCampaign && searchNotes(inCampaign, query)

  async function add() {
    const n = await saveNote(createNote(campaignId === ALL ? null : campaignId))
    go(`/dm/note/${n.id}`)
  }

  return (
    <div className="space-y-4">
      <header>
        <h1 className="text-3xl font-bold text-amber-400">🧙 ผู้ช่วย DM</h1>
        <p className="text-stone-400">บันทึกเซสชัน (เก็บในเครื่องนี้ ผู้เล่นไม่เห็น)</p>
      </header>

      <CampaignPicker value={campaignId} onChange={setCampaignId} />

      <Section title="📝 บันทึกเซสชัน" action={<Button variant="primary" className="text-sm" onClick={add}>+ บันทึกใหม่</Button>}>
        {(inCampaign?.length ?? 0) > 3 && (
          <div className="mb-3"><TextInput value={query} placeholder="ค้นหาในบันทึก เช่น ชื่อ NPC" onChange={setQuery} /></div>
        )}
        {notes?.length === 0 && (
          <p className="text-sm text-stone-500">{query ? 'ไม่พบบันทึกที่ตรงกับคำค้น' : 'ยังไม่มีบันทึก กด "+ บันทึกใหม่" เพื่อจดแผนหรือสิ่งที่เกิดขึ้นในเซสชัน'}</p>
        )}
        <ul className="space-y-2">
          {notes?.map((n) => (
            <li key={n.id}>
              <a href={`#/dm/note/${n.id}`} className="block rounded-lg bg-stone-900 p-3 hover:bg-stone-700">
                <div className="flex items-baseline justify-between gap-2">
                  <span className="font-bold">{noteTitle(n)}</span>
                  <span className="shrink-0 text-xs text-stone-400">{thaiDate(n.sessionDate)}</span>
                </div>
                {n.body && <p className="mt-1 line-clamp-2 text-sm text-stone-400">{n.body}</p>}
              </a>
            </li>
          ))}
        </ul>
      </Section>
    </div>
  )
}
