// Pick the current campaign (remembered on this device) or create a new one.
import { useLiveQuery } from 'dexie-react-hooks'
import { useState } from 'react'
import { addCampaign, listCampaigns } from '../db/campaigns'
import { setSetting } from '../db/device'
import { Button, TextInput } from './kit'

export const ALL = '__all'

export default function CampaignPicker({ value, onChange }: { value: string; onChange: (id: string) => void }) {
  const campaigns = useLiveQuery(listCampaigns) ?? []
  const [creating, setCreating] = useState(false)
  const [name, setName] = useState('')

  function choose(id: string) {
    onChange(id)
    setSetting('currentCampaignId', id)
  }

  async function create() {
    if (!name.trim()) return
    const c = await addCampaign(name)
    choose(c.id)
    setName('')
    setCreating(false)
  }

  return (
    <div className="space-y-2">
      <div className="flex gap-2">
        <select
          className="min-w-0 flex-1 rounded-lg border border-stone-600 bg-stone-900 px-3 py-2 text-base"
          aria-label="แคมเปญ"
          value={value}
          onChange={(e) => choose(e.target.value)}
        >
          <option value={ALL}>ทุกแคมเปญ</option>
          {campaigns.map((c) => <option key={c.id} value={c.id}>🗺 {c.name}</option>)}
        </select>
        <Button className="whitespace-nowrap" onClick={() => setCreating(!creating)}>+ แคมเปญ</Button>
      </div>
      {creating && (
        <div className="flex gap-2">
          <div className="flex-1"><TextInput value={name} placeholder="ชื่อแคมเปญ เช่น Lost Mine of Phandelver" onChange={setName} /></div>
          <Button variant="primary" onClick={create}>สร้าง</Button>
        </div>
      )}
    </div>
  )
}
