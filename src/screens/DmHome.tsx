// The DM's tools: party rest for the live room, generators and the campaign notebook. Everything here stays on
// the DM's device. The SRD lookup has its own tab (📖 ค้นหา).
import { useEffect, useState } from 'react'
import { go } from '../app/router'
import { getSetting } from '../db/device'
import CampaignPicker, { ALL } from '../ui/CampaignPicker'
import { Button, Section } from '../ui/kit'
import Generators from './Generators'
import PartyRest from './PartyRest'
import { NotebookList } from './Notebook'

export default function DmHome() {
  const [campaignId, setCampaignId] = useState(ALL)
  useEffect(() => {
    getSetting<string>('currentCampaignId').then((id) => id && setCampaignId(id))
  }, [])

  return (
    <div className="space-y-4">
      <header>
        <h1 className="text-3xl font-bold text-amber-400">🧙 ผู้ช่วย DM</h1>
        <p className="text-stone-400">พักทั้งปาร์ตี้ เครื่องสุ่ม และสมุดแคมเปญ (เก็บในเครื่องนี้ ผู้เล่นไม่เห็น)</p>
      </header>

      <PartyRest />

      <CampaignPicker value={campaignId} onChange={setCampaignId} />

      <Section title="🎲 เครื่องสุ่ม">
        <Generators campaignId={campaignId === ALL ? null : campaignId} />
      </Section>

      <Section title="📚 บันทึกการเดินทาง">
        <p className="mb-2 text-sm text-stone-400">หลังจบเซสชัน เขียนเรื่องที่เกิดขึ้นเป็นบทใหม่ (ใส่รูปได้) แล้วส่งให้ผู้เล่นอ่านเหมือนนิยาย</p>
        <Button className="w-full" onClick={() => go(campaignId === ALL ? '/story' : `/story/m/${campaignId}`)}>✏️ เขียน / จัดการบันทึก</Button>
      </Section>

      <Section title="📒 สมุดแคมเปญ" action={<span className="flex gap-3"><a href="#/dm/import" className="text-sm text-amber-400 underline">📦 นำเข้าแพ็ก</a><a href="#/backup" className="text-sm text-amber-400 underline">💾 สำรอง</a></span>}>
        <NotebookList campaignId={campaignId === ALL ? null : campaignId} onOpen={(id) => go(`/dm/note/${id}`)} />
      </Section>
    </div>
  )
}
