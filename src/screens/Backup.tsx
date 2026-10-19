// Back up everything on this device to one JSON file, and restore such a file (#/backup).
// Restoring always shows what will change first; "replace" also downloads a copy of the current data first.
import { useLiveQuery } from 'dexie-react-hooks'
import { useState } from 'react'
import { backupThisDevice, planRestoreHere, restoreBackup } from '../db/backup'
import { listCampaigns } from '../db/campaigns'
import { deviceId } from '../db/device'
import {
  backupFileName, MAX_BACKUP_BYTES, parseBackup, TABLE_LABEL, TABLES,
  type BackupFile, type RestoreMode, type RestorePlan, type Table,
} from '../model/backup'
import { Button, Checkbox, Label, Section, Select } from '../ui/kit'

const ALL = '__all'

/** Save a backup file: the share sheet on phones when asked, else a download. */
async function saveFile(file: BackupFile, name: string, share: boolean): Promise<string> {
  const blob = new File([JSON.stringify(file)], name, { type: 'application/json' })
  if (share && typeof navigator.canShare === 'function' && navigator.canShare({ files: [blob] })) {
    try {
      await navigator.share({ files: [blob], title: name })
      return `แชร์ ${name} แล้ว`
    } catch {
      return ''
    }
  }
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = name
  a.click()
  URL.revokeObjectURL(url)
  return `ดาวน์โหลด ${name} แล้ว`
}

export default function Backup() {
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold text-amber-400">💾 สำรอง / กู้คืนข้อมูล</h1>
      <p className="text-sm text-stone-400">
        เก็บข้อมูลทั้งหมดในเครื่องนี้ (ตัวละคร แคมเปญ การต่อสู้ สมุด แผนเซสชัน และบันทึก) เป็นไฟล์ .json ไฟล์เดียว
        เก็บไว้นอกแอป แล้วนำกลับมาใส่เครื่องนี้หรือเครื่องใหม่ได้
      </p>
      <ExportSection />
      <ImportSection />
    </div>
  )
}

function ExportSection() {
  const campaigns = useLiveQuery(listCampaigns) ?? []
  const [scope, setScope] = useState(ALL)
  const [status, setStatus] = useState('')
  const canShare = typeof navigator.canShare === 'function'

  async function run(share: boolean) {
    const campaignId = scope === ALL ? null : scope
    const file = await backupThisDevice(campaignId)
    const name = backupFileName(new Date(), campaigns.find((c) => c.id === campaignId)?.name)
    setStatus(await saveFile(file, name, share))
  }

  return (
    <Section title="📤 ส่งออก (สำรองข้อมูล)">
      <Label text="ข้อมูลที่จะส่งออก">
        <Select
          value={scope}
          onChange={setScope}
          options={[{ value: ALL, label: '🗂 ทั้งหมดในเครื่องนี้' }, ...campaigns.map((c) => ({ value: c.id, label: `🗺 เฉพาะแคมเปญ ${c.name}` }))]}
        />
      </Label>
      <div className="mt-3 flex flex-wrap gap-2">
        {canShare && <Button className="flex-1" onClick={() => run(true)}>📤 แชร์ไฟล์</Button>}
        <Button variant="primary" className="flex-1" onClick={() => run(false)}>💾 ดาวน์โหลด .json</Button>
      </div>
      {status && <p className="mt-2 text-sm text-emerald-300">{status}</p>}
      <p className="mt-2 text-xs text-stone-500">ไฟล์มีข้อมูลลับของ DM (HP มอนสเตอร์ สมุด) อย่าส่งให้ผู้เล่น · ชื่ออุปกรณ์และห้องที่เข้าอยู่ไม่ได้อยู่ในไฟล์</p>
    </Section>
  )
}

const COLUMNS: { key: keyof RestorePlan['counts'][Table]; label: string }[] = [
  { key: 'added', label: 'ใหม่' },
  { key: 'updated', label: 'ใช้จากไฟล์' },
  { key: 'kept', label: 'คงเดิม' },
  { key: 'deleted', label: 'ลบ' },
]

function ImportSection() {
  const campaigns = useLiveQuery(listCampaigns) ?? []
  const [error, setError] = useState('')
  const [loaded, setLoaded] = useState<{ file: BackupFile; warnings: string[] } | null>(null)
  const [mode, setMode] = useState<RestoreMode>('merge')
  const [takeOver, setTakeOver] = useState(true)
  const [plan, setPlan] = useState<RestorePlan | null>(null)
  const [busy, setBusy] = useState(false)
  const [done, setDone] = useState<RestorePlan | null>(null)

  async function preview(file: BackupFile, m: RestoreMode, t: boolean) {
    setPlan(await planRestoreHere(file, m, t))
  }

  async function pickFile(f: File | undefined) {
    setLoaded(null)
    setPlan(null)
    setDone(null)
    if (!f) return
    if (f.size > MAX_BACKUP_BYTES) return setError('ไฟล์ใหญ่เกินไป (เกิน 50 MB)')
    const r = parseBackup(await f.text())
    if (!r.ok) return setError(r.error)
    setError('')
    setLoaded(r)
    setMode('merge')
    await preview(r.file, 'merge', takeOver)
  }

  async function restore() {
    if (!loaded || busy) return
    setBusy(true)
    try {
      // A copy of what's here now, in case the replace was a mistake.
      if (mode === 'replace') await saveFile(await backupThisDevice(null), backupFileName(new Date(), 'ก่อนกู้คืน'), false)
      setDone(await restoreBackup(loaded.file, mode, takeOver))
      setLoaded(null)
      setPlan(null)
    } catch {
      setError('กู้คืนไม่สำเร็จ ข้อมูลในเครื่องไม่ถูกเปลี่ยน')
    }
    setBusy(false)
  }

  const file = loaded?.file
  const scopeName = file?.campaignId
    ? file.campaigns.find((c) => c.id === file.campaignId)?.name ?? campaigns.find((c) => c.id === file.campaignId)?.name ?? file.campaignId
    : null
  // Restoring on another device: offer to make this one the owner of the old device's campaigns.
  const otherOwner = !!file && !!file.deviceId && file.deviceId !== deviceId() && file.campaigns.some((c) => c.ownerDeviceId === file.deviceId)
  const deleting = plan ? TABLES.reduce((n, t) => n + plan.counts[t].deleted, 0) : 0

  return (
    <Section title="📥 นำเข้า (กู้คืน)">
      <input
        type="file"
        accept=".json,application/json"
        className="block w-full text-sm file:mr-3 file:rounded-lg file:border-0 file:bg-amber-500 file:px-4 file:py-2 file:font-bold file:text-stone-900"
        onChange={(e) => pickFile(e.target.files?.[0])}
      />
      <p className="mt-1 text-xs text-stone-500">ไฟล์สำรองจากหน้านี้ หรือไฟล์ dnd-backup-….json ที่ดึงจาก console แบบเดิม</p>
      {error && <p className="mt-2 text-sm text-red-400">⚠️ {error}</p>}

      {done && (
        <div className="mt-3 rounded-lg bg-emerald-950/60 p-3 text-sm">
          <p className="font-bold text-emerald-300">✓ กู้คืนแล้ว</p>
          <p className="text-stone-300">
            ใหม่ {TABLES.reduce((n, t) => n + done.counts[t].added, 0)} · ใช้จากไฟล์ {TABLES.reduce((n, t) => n + done.counts[t].updated, 0)}
            {' '}· ลบ {TABLES.reduce((n, t) => n + done.counts[t].deleted, 0)} รายการ
          </p>
          <a href="#/" className="mt-1 inline-block text-amber-400 underline">ไปที่รายชื่อตัวละคร</a>
        </div>
      )}

      {file && plan && (
        <div className="mt-4 space-y-3">
          <div className="text-sm">
            <p className="font-bold">{scopeName ? `🗺 แคมเปญ ${scopeName}` : '🗂 ข้อมูลทั้งหมด'}</p>
            <p className="text-stone-400">
              {file.exportedAt ? `สำรองเมื่อ ${new Date(file.exportedAt).toLocaleString('th-TH', { dateStyle: 'medium', timeStyle: 'short' })}` : 'ไฟล์แบบเดิม (จาก console)'}
              {file.deviceName && ` · จากเครื่อง ${file.deviceName}`}
            </p>
          </div>

          {loaded.warnings.length > 0 && (
            <ul className="space-y-1 rounded-lg bg-stone-900 p-3 text-sm text-amber-300">
              {loaded.warnings.map((w) => <li key={w}>⚠️ {w}</li>)}
            </ul>
          )}

          <div className="grid gap-2 sm:grid-cols-2">
            {([
              ['merge', '🤝 รวม (เก็บอันที่ใหม่กว่า)', 'เพิ่มสิ่งที่เครื่องนี้ยังไม่มี ถ้ามีทั้งสองที่ ใช้อันที่แก้ล่าสุด ไม่ลบอะไร'],
              ['replace', '🔄 แทนที่ทั้งหมด', scopeName ? `ให้แคมเปญนี้กลับเป็นเหมือนในไฟล์: ใช้ข้อมูลในไฟล์ทั้งหมด ลบของแคมเปญนี้ที่ไม่มีในไฟล์` : 'ให้เครื่องนี้กลับเป็นเหมือนในไฟล์: ใช้ข้อมูลในไฟล์ทั้งหมด ลบสิ่งที่ไม่มีในไฟล์'],
            ] as const).map(([m, title, text]) => (
              <button
                key={m}
                type="button"
                onClick={() => { setMode(m); preview(file, m, takeOver) }}
                className={`rounded-lg border p-3 text-left text-sm ${mode === m ? 'border-amber-400 bg-stone-800' : 'border-stone-700'}`}
              >
                <span className="font-bold">{title}</span>
                <span className="mt-1 block text-xs text-stone-400">{text}</span>
              </button>
            ))}
          </div>

          <table className="w-full text-sm">
            <thead>
              <tr className="text-xs text-stone-400">
                <th className="text-left font-normal" />
                {COLUMNS.map((c) => <th key={c.key} className="px-1 text-right font-normal">{c.label}</th>)}
              </tr>
            </thead>
            <tbody>
              {TABLES.map((t) => (
                <tr key={t} className="border-t border-stone-800">
                  <td className="py-1">{TABLE_LABEL[t]}</td>
                  {COLUMNS.map((c) => (
                    <td key={c.key} className={`px-1 text-right ${c.key === 'deleted' && plan.counts[t].deleted > 0 ? 'font-bold text-red-400' : ''}`}>
                      {plan.counts[t][c.key]}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>

          {otherOwner && (
            <div className="rounded-lg bg-stone-900 p-3 text-sm">
              <Checkbox checked={takeOver} onChange={(v) => { setTakeOver(v); preview(file, mode, v) }}
                label={`ให้เครื่องนี้เป็นเครื่อง DM ของแคมเปญในไฟล์ (แทนเครื่อง ${file.deviceName || 'เดิม'})`} />
              <p className="mt-1 text-xs text-stone-400">ติ๊กไว้ถ้าย้ายมาใช้เครื่องนี้เป็น DM: เปลี่ยนชื่อ ลบ และเปิดห้องของแคมเปญได้ · ผู้เล่นไม่ต้องติ๊ก</p>
            </div>
          )}

          {mode === 'replace' && (
            <p className="rounded-lg bg-red-950/60 p-3 text-sm">
              {deleting > 0 ? <>จะลบ <b>{deleting}</b> รายการที่ไม่มีในไฟล์ </> : 'ไม่มีอะไรถูกลบ '}
              · แอปจะดาวน์โหลดสำรองข้อมูลปัจจุบันให้ก่อนอัตโนมัติ เผื่อต้องการย้อนกลับ
            </p>
          )}

          <Button variant={mode === 'replace' ? 'danger' : 'primary'} className="w-full" onClick={restore}>
            {busy ? 'กำลังกู้คืน…' : mode === 'replace' ? '🔄 แทนที่ด้วยไฟล์นี้' : '📥 รวมข้อมูลจากไฟล์นี้'}
          </Button>
        </div>
      )}
    </Section>
  )
}
