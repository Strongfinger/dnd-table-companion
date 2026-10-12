// Pick the current campaign (remembered on this device), create a new one, or (the DM's device that
// created it) rename / delete it. Players' copies of the DM's campaign are read-only.
import { useLiveQuery } from 'dexie-react-hooks'
import { useState } from 'react'
import { useLobby } from '../app/useLobby'
import { addCampaign, deleteCampaign, listCampaigns, renameCampaign } from '../db/campaigns'
import { deviceId, setSetting } from '../db/device'
import { canManageCampaign } from '../model/campaign'
import { Button, TextInput } from './kit'

export const ALL = '__all'

export default function CampaignPicker({ value, onChange }: { value: string; onChange: (id: string) => void }) {
  const campaigns = useLiveQuery(listCampaigns) ?? []
  const lobby = useLobby()
  const playerInRoom = lobby.session?.role === 'player'
  const [creating, setCreating] = useState(false)
  const [name, setName] = useState('')
  const [managing, setManaging] = useState(false)
  const [newName, setNewName] = useState('')
  const [confirmDelete, setConfirmDelete] = useState(false)
  const selected = campaigns.find((c) => c.id === value)
  const canManage = !!selected && canManageCampaign(selected, deviceId(), playerInRoom)
  // The DM's open room plays this campaign: switch the room first (deleting it would leave the room without one).
  const roomUsesIt = lobby.session?.role === 'dm' && lobby.campaignId === value

  function choose(id: string) {
    onChange(id)
    setSetting('currentCampaignId', id)
  }

  function openManage() {
    setManaging(!managing)
    setNewName(selected?.name ?? '')
    setConfirmDelete(false)
  }

  async function rename() {
    if (selected && newName.trim()) await renameCampaign(selected.id, newName)
    setManaging(false)
  }

  async function remove() {
    if (!selected || roomUsesIt) return
    await deleteCampaign(selected.id)
    choose(ALL)
    setManaging(false)
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
        {canManage && <Button className="px-3" aria-label="จัดการแคมเปญ" onClick={openManage}>⚙️</Button>}
        {!playerInRoom && <Button className="whitespace-nowrap" onClick={() => setCreating(!creating)}>+ แคมเปญ</Button>}
      </div>
      {selected && !canManage && (
        <p className="text-xs text-stone-500">🔒 แคมเปญของ DM: เปลี่ยนชื่อ/ลบได้เฉพาะเครื่อง DM ที่สร้าง{playerInRoom && ' · ในห้อง แคมเปญตามที่ DM เลือก'}</p>
      )}
      {managing && canManage && (
        <div className="space-y-2 rounded-lg bg-stone-900 p-3">
          <div className="flex gap-2">
            <div className="flex-1"><TextInput value={newName} placeholder="ชื่อแคมเปญ" onChange={setNewName} /></div>
            <Button variant="primary" onClick={rename}>เปลี่ยนชื่อ</Button>
          </div>
          {roomUsesIt ? (
            <p className="text-xs text-stone-400">ห้องที่เปิดอยู่เล่นแคมเปญนี้ เปลี่ยนแคมเปญของห้อง (แท็บ ห้อง) ก่อนจึงจะลบได้</p>
          ) : (
            <div className="flex gap-2">
              <Button className="flex-1" onClick={() => setConfirmDelete(!confirmDelete)}>{confirmDelete ? 'ไม่ลบ' : '🗑 ลบแคมเปญ'}</Button>
              {confirmDelete && <Button variant="danger" className="flex-1" onClick={remove}>ยืนยันลบ</Button>}
            </div>
          )}
          {confirmDelete && <p className="text-xs text-stone-400">ลบแค่แคมเปญ: ตัวละคร การต่อสู้ และโน้ตยังอยู่ (กลายเป็น "ไม่มีแคมเปญ")</p>}
        </div>
      )}
      {creating && (
        <div className="flex gap-2">
          <div className="flex-1"><TextInput value={name} placeholder="ชื่อแคมเปญ เช่น Lost Mine of Phandelver" onChange={setName} /></div>
          <Button variant="primary" onClick={create}>สร้าง</Button>
        </div>
      )}
    </div>
  )
}
