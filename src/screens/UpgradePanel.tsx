// "⬆️ อัปเกรด" banner on sheets made before the SRD equipment and feature catalog: shows what would change,
// then applies it (or "ไม่ต้อง" hides it for good). See model/upgrade.ts.
import { useState } from 'react'
import { useLobby } from '../app/useLobby'
import { updateCharacter } from '../db/characters'
import type { Character } from '../model/character'
import { applyUpgrade, planUpgrade, upgradedAC, upgradeIsEmpty } from '../model/upgrade'
import { Button, Checkbox } from '../ui/kit'
import { useEquipment } from './useSrdData'

export default function UpgradePanel({ c }: { c: Character }) {
  const data = useEquipment()
  const lobby = useLobby()
  const [open, setOpen] = useState(false)
  const [wearArmor, setWearArmor] = useState(true)
  const [replaceAttacks, setReplaceAttacks] = useState(false)
  if (c.srdLinked || c.monster || !data) return null
  const plan = planUpgrade(c, data)
  if (upgradeIsEmpty(plan)) return null

  async function save(fn: (latest: Character) => Character) {
    await updateCharacter(c.id, (latest) => ({ character: fn(latest), text: '' }))
    lobby.shareSheet(c.id)
  }
  const apply = () => save((latest) => applyUpgrade(latest, data!, planUpgrade(latest, data!), { wearArmor, replaceAttacks }))
  const dismiss = () => save((latest) => ({ ...latest, srdLinked: true }))

  if (!open) {
    return (
      <div className="flex items-center justify-between gap-2 rounded-lg bg-sky-950 p-3 text-sm text-sky-100">
        <span>⬆️ ใช้ข้อมูล SRD กับตัวละครนี้: อาวุธ/เกราะ, AC อัตโนมัติ, ความสามารถ</span>
        <Button className="shrink-0 px-3 py-1 text-sm" onClick={() => setOpen(true)}>ดู</Button>
      </div>
    )
  }
  const newAc = upgradedAC(c, data, plan)
  return (
    <div className="space-y-2 rounded-lg bg-sky-950 p-3 text-sm text-sky-100">
      <p className="font-bold">⬆️ อัปเกรดเป็นข้อมูล SRD</p>
      {plan.links.length > 0 && <p>ของในกระเป๋าที่จับคู่ได้: {plan.links.map((l) => (l.from === l.to.name ? l.to.name : `${l.from} → ${l.to.name}`)).join(', ')}</p>}
      {plan.linkFeatures.length > 0 && <p>ความสามารถที่ผูกกับ SRD (จำนวนครั้งคำนวณใหม่): {plan.linkFeatures.map((l) => l.to.name).join(', ')}</p>}
      {plan.addFeatures.length > 0 && <p>ความสามารถที่จะเพิ่ม: {plan.addFeatures.map((f) => f.name).join(', ')}</p>}
      {plan.armor.length > 0 && (
        <Checkbox checked={wearArmor} onChange={setWearArmor}
          label={<span>สวม {plan.armor.map((a) => a.name).join(' + ')} และคำนวณ AC อัตโนมัติ (AC {c.ac} → {newAc})</span>} />
      )}
      {plan.attacks.length > 0 && (
        <Checkbox checked={replaceAttacks} onChange={setReplaceAttacks}
          label={<span>ใช้อาวุธ SRD แทนการโจมตีที่ใส่เอง: {plan.attacks.map((a) => a.name).join(', ')} (ถ้าใส่โบนัสเวทมนตร์ไว้ อย่าเลือก)</span>} />
      )}
      <p className="text-xs text-sky-300">ของที่ไม่ตรงกับ SRD (เช่นชื่อภาษาไทย) อยู่เหมือนเดิม · แก้ทีหลังได้ทั้งหมด</p>
      <div className="flex gap-2">
        <Button variant="primary" className="flex-1" onClick={apply}>อัปเกรด</Button>
        <Button className="flex-1" onClick={dismiss}>ไม่ต้อง</Button>
      </div>
    </div>
  )
}
