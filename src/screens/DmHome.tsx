// The DM's tools, in Tan's order: campaign notebook, party rest, players' coin requests, the reward pool, generators, journey chronicle. Everything here stays on
// the DM's device. The SRD lookup has its own tab (📖 ค้นหา).
import { useEffect, useState } from 'react'
import { go } from '../app/router'
import { getSetting } from '../db/device'
import CampaignPicker, { ALL } from '../ui/CampaignPicker'
import { Button, Section } from '../ui/kit'
import Generators from './Generators'
import PartyRest from './PartyRest'
import { CoinRequests, RewardPool } from './RewardDesk'
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
        <p className="text-stone-400">สมุดแคมเปญ พักทั้งปาร์ตี้ คำขอเงิน คลังของรางวัล เครื่องสุ่ม และบันทึกการเดินทาง (เก็บในเครื่องนี้)</p>
      </header>

      {/* The campaign picker sets which campaign the notebook, generators and chronicle use. */}
      <CampaignPicker value={campaignId} onChange={setCampaignId} />

      <Section title="📒 สมุดแคมเปญ" action={<span className="flex gap-3"><a href="#/dm/import" className="text-sm text-amber-400 underline">📦 นำเข้าแพ็ก</a><a href="#/backup" className="text-sm text-amber-400 underline">💾 สำรอง</a></span>}>
        <NotebookList campaignId={campaignId === ALL ? null : campaignId} onOpen={(id) => go(`/dm/note/${id}`)} />
      </Section>

      <PartyRest />

      <CoinRequests />

      <RewardPool />

      <Section title="🎲 เครื่องสุ่ม">
        <Generators campaignId={campaignId === ALL ? null : campaignId} />
      </Section>

      <Section title="📚 บันทึกการเดินทาง">
        <p className="mb-2 text-sm text-stone-400">หลังจบเซสชัน เขียนเรื่องที่เกิดขึ้นเป็นบทใหม่ (ใส่รูปได้) แล้วส่งให้ผู้เล่นอ่านเหมือนนิยาย</p>
        <Button className="w-full" onClick={() => go(campaignId === ALL ? '/story' : `/story/m/${campaignId}`)}>✏️ เขียน / จัดการบันทึก</Button>
      </Section>
    </div>
  )
}
