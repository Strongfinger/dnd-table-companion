// The 📌 toggle on a notebook page or a scene: pins it to the strip in the DM panel (filled = pinned).
import { togglePinned, usePins } from '../db/pins'
import { isPinned, MAX_PINS, type Pin } from '../model/pins'

export default function PinButton({ campaignId, pin, className = '' }: { campaignId: string | null; pin: Pin; className?: string }) {
  const pins = usePins(campaignId) ?? []
  const on = isPinned(pins, pin)
  const full = !on && pins.length >= MAX_PINS
  return (
    <button
      type="button"
      aria-pressed={on}
      aria-label={on ? 'เลิกปักหมุด' : 'ปักหมุดไว้แถบด้านบน'}
      title={full ? `ปักหมุดได้สูงสุด ${MAX_PINS} อัน · เลิกปักอันเก่าก่อน` : on ? 'เลิกปักหมุด' : 'ปักหมุดไว้แถบด้านบน'}
      disabled={full}
      onClick={() => void togglePinned(campaignId, pin)}
      className={`flex h-10 min-w-10 items-center justify-center rounded-lg px-2 text-lg ${on ? 'bg-amber-500 text-stone-900' : 'text-stone-400 hover:bg-stone-700'} disabled:opacity-40 ${className}`}
    >
      📌
    </button>
  )
}
