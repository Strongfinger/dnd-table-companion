// One log line with a small ✕ to delete it (asks first). Deleting removes only the line:
// HP, conditions and other values are not changed back.
import { useState, type ReactNode } from 'react'
import { deleteLog } from '../db/log'

export default function LogLine({ id, children }: { id: string; children: ReactNode }) {
  const [confirm, setConfirm] = useState(false)
  return (
    <div className="group flex items-start gap-2">
      <div className="min-w-0 flex-1">{children}</div>
      {confirm ? (
        <span className="flex shrink-0 items-center gap-1 text-xs">
          <span className="text-stone-400">ลบบรรทัดนี้? (ไม่ย้อนค่า HP ฯลฯ)</span>
          <button type="button" className="rounded bg-red-800 px-2 py-0.5 font-bold" onClick={() => deleteLog(id)}>ลบ</button>
          <button type="button" className="rounded bg-stone-700 px-2 py-0.5" onClick={() => setConfirm(false)}>ไม่</button>
        </span>
      ) : (
        <button type="button" aria-label="ลบบรรทัดนี้" className="shrink-0 px-1 text-stone-600 hover:text-red-400" onClick={() => setConfirm(true)}>✕</button>
      )}
    </div>
  )
}
