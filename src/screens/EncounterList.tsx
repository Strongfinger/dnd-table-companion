// The DM's list of fights: start a new one or continue a saved one.
import { useLiveQuery } from 'dexie-react-hooks'
import { useEffect, useState } from 'react'
import { go } from '../app/router'
import { getSetting } from '../db/device'
import { listEncounters, saveEncounter } from '../db/encounters'
import { createEncounter } from '../model/encounter'
import CampaignPicker, { ALL } from '../ui/CampaignPicker'
import { Button, Section, TextInput } from '../ui/kit'

const STATUS = { setup: 'เตรียมการ', active: 'กำลังต่อสู้', ended: 'จบแล้ว' }

export default function EncounterList() {
  const all = useLiveQuery(listEncounters)
  const [name, setName] = useState('')
  const [campaignId, setCampaignId] = useState(ALL)
  useEffect(() => {
    getSetting<string>('currentCampaignId').then((id) => id && setCampaignId(id))
  }, [])
  const encounters = campaignId === ALL ? all : all?.filter((e) => e.campaignId === campaignId)

  async function create() {
    const e = await saveEncounter(createEncounter(name, campaignId === ALL ? null : campaignId))
    go(`/fight/${e.id}`)
  }

  return (
    <div className="space-y-4">
      <header>
        <h1 className="text-3xl font-bold text-amber-400">การต่อสู้</h1>
        <p className="text-stone-400">Initiative Tracker สำหรับ DM</p>
      </header>

      <CampaignPicker value={campaignId} onChange={setCampaignId} />

      <Section title="สร้างการต่อสู้ใหม่">
        <div className="flex gap-2">
          <div className="flex-1"><TextInput value={name} placeholder="เช่น ซุ่มโจมตีของ Goblin" onChange={setName} /></div>
          <Button variant="primary" onClick={create}>+ สร้าง</Button>
        </div>
      </Section>

      {encounters?.length === 0 && <p className="text-center text-stone-500">ยังไม่มีการต่อสู้</p>}
      <ul className="space-y-2">
        {encounters?.map((e) => (
          <li key={e.id}>
            <a href={`#/fight/${e.id}`} className="flex items-center justify-between rounded-xl bg-stone-800 p-4 hover:bg-stone-700">
              <div>
                <div className="text-lg font-bold">{e.name}</div>
                <div className="text-sm text-stone-400">
                  {STATUS[e.status]}{e.status === 'active' && ` · รอบที่ ${e.round}`} · {e.combatants.length} ตัว
                </div>
              </div>
              <span className="text-stone-500">›</span>
            </a>
          </li>
        ))}
      </ul>
    </div>
  )
}
