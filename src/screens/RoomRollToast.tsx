// Live lobby: when someone else in the room rolls, show it for a few seconds at the bottom of the screen.
import { useEffect, useState } from 'react'
import { useLobby } from '../app/useLobby'
import { rollEventText } from '../model/rollEvent'

const SHOW_MS = 5000

export default function RoomRollToast() {
  const { rolls } = useLobby()
  const latest = rolls.find((r) => !r.mine)
  const [hiddenId, setHiddenId] = useState<string | null>(null)

  // Hide each roll after a few seconds (a newer roll restarts the timer).
  useEffect(() => {
    if (!latest) return
    const timer = setTimeout(() => setHiddenId(latest.id), SHOW_MS)
    return () => clearTimeout(timer)
  }, [latest])

  if (!latest || latest.id === hiddenId) return null
  const r = latest.roll
  return (
    <div
      role="status"
      onClick={() => setHiddenId(latest.id)}
      className={`fixed bottom-20 left-4 right-20 z-30 mx-auto max-w-md rounded-xl px-4 py-3 text-sm font-bold shadow-lg shadow-black/50 ${r.natural === 20 ? 'bg-emerald-800' : r.natural === 1 ? 'bg-red-900' : 'bg-sky-900'}`}
    >
      {rollEventText(r)}
    </div>
  )
}
