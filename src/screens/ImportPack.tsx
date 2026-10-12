// Import a campaign pack: prepared notebook pages, session plans and fights from one JSON file.
import { useState } from 'react'
import { go } from '../app/router'
import { applyPack, planPackImport, type PackPlan } from '../db/campaignPack'
import { MAX_PACK_BYTES, parseCampaignPack, type CampaignPack } from '../model/campaignPack'
import { KIND_LABEL, NOTE_KINDS } from '../model/note'
import { Button, Section } from '../ui/kit'

export default function ImportPack() {
  const [error, setError] = useState('')
  const [preview, setPreview] = useState<{ pack: CampaignPack; warnings: string[]; plan: PackPlan } | null>(null)
  const [busy, setBusy] = useState(false)

  async function pickFile(file: File | undefined) {
    setPreview(null)
    if (!file) return
    if (file.size > MAX_PACK_BYTES) return setError('ไฟล์ใหญ่เกินไป (เกิน 1 MB)')
    const r = parseCampaignPack(await file.text())
    if (!r.ok) return setError(r.error)
    setError('')
    setPreview({ ...r, plan: await planPackImport(r.pack) })
  }

  async function save(mode: 'replace' | 'addOnly') {
    if (!preview) return
    setBusy(true)
    await applyPack(preview.pack, mode)
    go('/dm')
  }

  const p = preview?.pack
  const plan = preview?.plan
  const exists = plan && plan.existingNotes + plan.existingFights > 0

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
          <p className="mb-3 text-sm text-stone-400">{plan.campaignExists ? 'แคมเปญนี้มีในเครื่องแล้ว' : 'จะสร้างแคมเปญใหม่'}</p>
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
                  {plan.startedFights > 0 && ` · การต่อสู้ที่เริ่มแล้ว ${plan.startedFights} อันจะไม่ถูกแทนที่`}
                </p>
                <Button variant="primary" className="w-full" onClick={() => !busy && save('addOnly')}>➕ เพิ่มเฉพาะที่ยังไม่มี (เก็บที่แก้ไว้)</Button>
                <Button className="w-full" onClick={() => !busy && save('replace')}>🔄 แทนที่ด้วยไฟล์นี้ (ติ๊กในแผนเริ่มใหม่)</Button>
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
