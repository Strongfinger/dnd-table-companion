// The play log under the play panel: what happened, newest first.
import { useLiveQuery } from 'dexie-react-hooks'
import { useState } from 'react'
import { useLobby } from '../app/useLobby'
import { clearLog, listLog } from '../db/log'
import { Button, Section } from '../ui/kit'
import LogLine from '../ui/LogLine'

const time = (at: number) => new Date(at).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' })
const day = (at: number) => new Date(at).toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: 'numeric' })

export default function PlayLog({ characterId }: { characterId: string }) {
  // Players in a live room can only read logs; their character's log follows the DM's.
  const readOnly = useLobby().session?.role === 'player'
  const [showAll, setShowAll] = useState(false)
  const [confirmClear, setConfirmClear] = useState(false)
  const entries = useLiveQuery(() => listLog(characterId, 500), [characterId]) ?? []
  const shown = showAll ? entries : entries.slice(0, 10)

  return (
    <Section
      title="บันทึกการเล่น (Log)"
      action={entries.length > 0 && !readOnly && <Button className="text-sm" onClick={() => setConfirmClear(!confirmClear)}>ล้าง</Button>}
    >
      {confirmClear && (
        <div className="mb-3 flex items-center gap-2 rounded-lg bg-stone-900 p-2 text-sm">
          <span className="flex-1">ลบบันทึกทั้งหมดของตัวละครนี้?</span>
          <Button variant="danger" className="text-sm" onClick={() => { clearLog(characterId); setConfirmClear(false) }}>ลบ</Button>
        </div>
      )}
      {entries.length === 0 && <p className="text-sm text-stone-500">ยังไม่มีบันทึก ทุกการกดในส่วน "ระหว่างเล่น" จะถูกบันทึกที่นี่</p>}
      <ol className="space-y-1 text-sm">
        {shown.map((e, i) => {
          // Show the date once at the start of each day.
          const newDay = i === 0 || day(e.at) !== day(shown[i - 1].at)
          return (
            <li key={e.id}>
              {newDay && <div className="mt-2 text-xs font-bold text-stone-500">{day(e.at)}</div>}
              <LogLine id={e.id} readOnly={readOnly}>
                <div className="flex gap-2">
                  <span className="shrink-0 tabular-nums text-stone-500">{time(e.at)}</span>
                  <span>{e.text}{e.round ? <span className="ml-1 text-xs text-amber-500/80">(รอบ {e.round})</span> : null}</span>
                </div>
              </LogLine>
            </li>
          )
        })}
      </ol>
      {entries.length > 10 && (
        <button type="button" className="mt-2 text-sm text-amber-400 underline" onClick={() => setShowAll(!showAll)}>
          {showAll ? 'แสดงน้อยลง' : `ดูทั้งหมด (${entries.length})`}
        </button>
      )}
    </Section>
  )
}
