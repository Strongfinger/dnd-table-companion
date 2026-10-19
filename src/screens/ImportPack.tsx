// Import a campaign pack: prepared notebook pages, session plans and fights from one JSON file.
import { useState } from 'react'
import { go } from '../app/router'
import { applyPack, planPackImport, type PackPlan } from '../db/campaignPack'
import { listCampaigns } from '../db/campaigns'
import type { Campaign } from '../model/campaign'
import { MAX_PACK_BYTES, defaultPackTarget, parseCampaignPack, type CampaignPack } from '../model/campaignPack'
import { KIND_LABEL, NOTE_KINDS } from '../model/note'
import { Button, Checkbox, Label, Section, Select } from '../ui/kit'

export default function ImportPack() {
  const [error, setError] = useState('')
  const [preview, setPreview] = useState<{ pack: CampaignPack; warnings: string[]; plan: PackPlan } | null>(null)
  const [busy, setBusy] = useState(false)
  const [resetStarted, setResetStarted] = useState(false)
  const [campaigns, setCampaigns] = useState<Campaign[]>([])
  /** The campaign on this device that gets the pages and fights. */
  const [target, setTarget] = useState('')

  async function pickFile(file: File | undefined) {
    setPreview(null)
    if (!file) return
    if (file.size > MAX_PACK_BYTES) return setError('ไฟล์ใหญ่เกินไป (เกิน 1 MB)')
    const r = parseCampaignPack(await file.text())
    if (!r.ok) return setError(r.error)
    setError('')
    const list = await listCampaigns()
    setCampaigns(list)
    setTarget(defaultPackTarget(r.pack, list) ?? r.pack.campaign.id)
    setPreview({ ...r, plan: await planPackImport(r.pack) })
  }

  async function save(mode: 'replace' | 'addOnly') {
    if (!preview) return
    setBusy(true)
    await applyPack(preview.pack, mode, mode === 'replace' && resetStarted, target || preview.pack.campaign.id)
    go('/dm')
  }

  const p = preview?.pack
  const plan = preview?.plan
  const exists = plan && plan.existingNotes + plan.existingFights + plan.startedFights > 0

  return (
    <div className="space-y-4">
      <a href="#/dm" className="text-sm text-stone-400">← ผู้ช่วย DM</a>
      <h1 className="text-2xl font-bold text-amber-400">📦 นำเข้าแพ็กแคมเปญ</h1>
      <p className="text-sm text-stone-400">
        ไฟล์ .json ที่มีหน้าสมุด (NPC สถานที่ ภารกิจ…) แผนเซสชัน และการต่อสู้ที่เตรียมไว้ เก็บในเครื่องนี้เท่านั้น ผู้เล่นไม่เห็น
      </p>

      <Section title="1. เลือกไฟล์">
        <input
          type="file"
          accept=".json,application/json"
          className="block w-full text-sm file:mr-3 file:rounded-lg file:border-0 file:bg-amber-500 file:px-4 file:py-2 file:font-bold file:text-stone-900"
          onChange={(e) => pickFile(e.target.files?.[0])}
        />
        {error && <p className="mt-2 text-sm text-red-400">⚠️ {error}</p>}
      </Section>

      {p && plan && preview && (
        <Section title="2. ตรวจสอบก่อนบันทึก">
          <p className="text-lg font-bold">{p.campaign.name}</p>
          <div className="mb-3 mt-2">
            <Label text="นำเข้าไปที่แคมเปญ">
              <Select
                value={target}
                onChange={setTarget}
                options={[
                  ...(plan.campaignExists ? [] : [{ value: p.campaign.id, label: `➕ สร้างแคมเปญใหม่: ${p.campaign.name}` }]),
                  ...campaigns.map((c) => ({ value: c.id, label: `🗺 ${c.name}${c.id === p.campaign.id ? ' (แคมเปญของไฟล์นี้)' : ''}` })),
                ]}
              />
            </Label>
          </div>
          {target !== p.campaign.id && (
            <p className="mb-3 text-xs text-stone-400">หน้าและการต่อสู้จะอยู่ในแคมเปญที่เลือก (ชื่อแคมเปญไม่เปลี่ยน) ผู้เล่นที่อยู่ในแคมเปญนี้แล้วไม่ต้องทำอะไรเพิ่ม</p>
          )}
          <ul className="space-y-1 text-sm">
            {NOTE_KINDS.map((k) => {
              const n = p.notes.filter((x) => x.kind === k).length
              return n > 0 && <li key={k}>{KIND_LABEL[k]} × {n}</li>
            })}
            <li>⚔️ การต่อสู้ × {p.encounters.length}</li>
          </ul>

          {preview.warnings.length > 0 && (
            <ul className="mt-3 space-y-1 rounded-lg bg-stone-900 p-3 text-sm text-amber-300">
              {preview.warnings.map((w) => <li key={w}>⚠️ {w}</li>)}
            </ul>
          )}

          <div className="mt-4 space-y-2">
            {exists ? (
              <>
                <p className="text-sm">
                  มีอยู่แล้ว {plan.existingNotes} หน้า · {plan.existingFights} การต่อสู้ — ใหม่ {plan.newNotes} หน้า · {plan.newFights} การต่อสู้
                  {plan.startedFights > 0 && ` · การต่อสู้ที่เริ่มหรือจบแล้ว ${plan.startedFights} อัน`}
                </p>
                <Button variant="primary" className="w-full" onClick={() => !busy && save('addOnly')}>➕ เพิ่มเฉพาะที่ยังไม่มี (เก็บที่แก้ไว้)</Button>
                <Button className="w-full" onClick={() => !busy && save('replace')}>
                  🔄 แทนที่ด้วยไฟล์นี้ (ติ๊กในแผนเริ่มใหม่{resetStarted && plan.startedFights > 0 ? ', รีเซ็ตการต่อสู้ที่เลือก' : ''})
                </Button>
                {plan.startedFights > 0 && (
                  <div className="rounded-lg bg-stone-900 p-3 text-sm">
                    <Checkbox checked={resetStarted} onChange={setResetStarted}
                      label={`ตอนแทนที่ ให้รีเซ็ตการต่อสู้ที่เริ่มหรือจบแล้วด้วย (${plan.startedFights} อัน)`} />
                    <p className="mt-1 text-xs text-stone-400">
                      {plan.startedFightNames.join(' · ')} — กลับเป็นแบบที่เตรียมไว้ในไฟล์: Initiative, HP มอนสเตอร์ และบันทึกการต่อสู้เริ่มใหม่
                      (สภาวะที่ติดอยู่บนใบตัวละครผู้เล่นไม่ถูกล้าง) · ถ้าไม่ติ๊ก การต่อสู้เหล่านี้จะไม่ถูกแทนที่
                    </p>
                  </div>
                )}
              </>
            ) : (
              <Button variant="primary" className="w-full" onClick={() => !busy && save('replace')}>📥 นำเข้า</Button>
            )}
          </div>
        </Section>
      )}
    </div>
  )
}
