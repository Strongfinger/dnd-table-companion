// Send a character to another device as a JSON file: download, share (phones), or copy.
import { useState } from 'react'
import type { Character } from '../model/character'
import { exportCharacter, exportFileName } from '../model/io'
import { Button, Section } from '../ui/kit'

export default function ExportPanel({ c }: { c: Character }) {
  const [status, setStatus] = useState('')
  const [showText, setShowText] = useState(false)
  const json = exportCharacter(c)
  const fileName = exportFileName(c)
  const file = new File([json], fileName, { type: 'application/json' })
  // Phones can share a file straight into LINE, Messenger, AirDrop, etc.
  const canShareFile = typeof navigator.canShare === 'function' && navigator.canShare({ files: [file] })

  function download() {
    const url = URL.createObjectURL(file)
    const a = document.createElement('a')
    a.href = url
    a.download = fileName
    a.click()
    URL.revokeObjectURL(url)
    setStatus(`ดาวน์โหลด ${fileName} แล้ว`)
  }

  async function share() {
    try {
      await navigator.share({ files: [file], title: c.name })
      setStatus('แชร์แล้ว')
    } catch {
      // The player closed the share sheet: nothing to do.
    }
  }

  async function copy() {
    try {
      await navigator.clipboard.writeText(json)
      setStatus('คัดลอกแล้ว วางในแชทหรือในหน้า "นำเข้า" ของอีกเครื่องได้เลย')
    } catch {
      // Some browsers block clipboard access: show the text so it can be copied by hand.
      setShowText(true)
      setStatus('คัดลอกอัตโนมัติไม่ได้: กดค้างที่ข้อความด้านล่างเพื่อเลือกและคัดลอกเอง')
    }
  }

  return (
    <Section title="ส่งออกตัวละคร (JSON)">
      <p className="mb-3 text-sm text-stone-400">ส่งไฟล์นี้ให้ DM หรืออีกเครื่อง แล้วกด "📥 นำเข้า" ที่หน้ารายชื่อตัวละคร</p>
      <div className="flex flex-wrap gap-2">
        {canShareFile && <Button variant="primary" className="flex-1" onClick={share}>📤 แชร์ไฟล์</Button>}
        <Button className="flex-1" onClick={download}>💾 ดาวน์โหลด .json</Button>
        <Button className="flex-1" onClick={copy}>📋 คัดลอก</Button>
      </div>
      {status && <p className="mt-2 text-sm text-emerald-300">{status}</p>}
      {showText && (
        <textarea
          readOnly
          rows={6}
          className="mt-2 w-full rounded-lg border border-stone-600 bg-stone-900 p-2 font-mono text-xs"
          value={json}
          onFocus={(e) => e.target.select()}
        />
      )}
    </Section>
  )
}
