// The DM's tools (Phase 3): SRD lookup, generators and the campaign notebook. Everything here stays on the DM's device.
import { useEffect, useState } from 'react'
import { go } from '../app/router'
import { getSetting } from '../db/device'
import CampaignPicker, { ALL } from '../ui/CampaignPicker'
import { Section } from '../ui/kit'
import Generators from './Generators'
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
        <p className="text-stone-400">ค้นหา SRD และสมุดแคมเปญ (เก็บในเครื่องนี้ ผู้เล่นไม่เห็น)</p>
      </header>

      <div className="grid grid-cols-2 gap-2">
        <a href="#/lookup/monsters" className="rounded-xl bg-stone-800 p-3 hover:bg-stone-700">
          <div className="font-bold">👹 มอนสเตอร์ SRD</div>
          <div className="text-xs text-stone-400">Stat block เต็ม · เพิ่มเข้าการต่อสู้</div>
        </a>
        <a href="#/lookup/spells" className="rounded-xl bg-stone-800 p-3 hover:bg-stone-700">
          <div className="font-bold">✨ คาถา SRD</div>
          <div className="text-xs text-stone-400">339 คาถา · ค้นตาม Level / Class</div>
        </a>
        <a href="#/lookup/rules" className="rounded-xl bg-stone-800 p-3 hover:bg-stone-700">
          <div className="font-bold">📖 กติกา & Conditions</div>
          <div className="text-xs text-stone-400">คำอธิบายย่อภาษาไทย</div>
        </a>
      </div>

      <CampaignPicker value={campaignId} onChange={setCampaignId} />

      <Section title="🎲 เครื่องสุ่ม">
        <Generators campaignId={campaignId === ALL ? null : campaignId} />
      </Section>

      <Section title="📒 สมุดแคมเปญ" action={<a href="#/dm/import" className="text-sm text-amber-400 underline">📦 นำเข้าแพ็ก</a>}>
        <NotebookList campaignId={campaignId === ALL ? null : campaignId} onOpen={(id) => go(`/dm/note/${id}`)} />
      </Section>
    </div>
  )
}
