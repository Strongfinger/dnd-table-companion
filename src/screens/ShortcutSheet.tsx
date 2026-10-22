// The cheat sheet for the tracker's keyboard shortcuts, with the ON/OFF switch for single-key shortcuts
// (WCAG 2.1.4: a way to turn single-character shortcuts off). A small popover, not a modal: keys keep working.
import { useEffect, useRef } from 'react'

const KEYS: { keys: string[]; what: string }[] = [
  { keys: ['N', 'Space'], what: 'ถัดไป' },
  { keys: ['P'], what: 'ก่อนหน้า' },
  { keys: ['D'], what: 'ใส่ดาเมจให้ตัวที่เลือก (ไม่ได้เลือก = ตัวที่กำลังเล่น)' },
  { keys: ['Z'], what: 'เลิกทำครั้งล่าสุด' },
  { keys: ['/'], what: 'ค้นหาสมุดและฉากในแผงด้านข้าง' },
  { keys: ['Esc'], what: 'ยกเลิก / ปิด' },
  { keys: ['?'], what: 'เปิดหน้านี้' },
]

export default function ShortcutSheet({ enabled, onEnabled, onClose }: {
  enabled: boolean
  onEnabled: (on: boolean) => void
  onClose: () => void
}) {
  const box = useRef<HTMLElement>(null)
  // Focus moves in when it opens; the tracker puts it back on the ⌨ button when it closes.
  useEffect(() => box.current?.focus(), [])
  return (
    <section
      ref={box}
      tabIndex={-1}
      aria-label="ทางลัดแป้นพิมพ์"
      onKeyDown={(e) => { if (e.key === 'Escape') onClose() }}
      className="fixed bottom-20 left-4 z-40 w-80 max-w-[calc(100vw-2rem)] space-y-2 rounded-xl border border-stone-600 bg-stone-900 p-3 text-sm shadow-2xl focus:outline-none"
    >
      <div className="flex items-center justify-between gap-2">
        <h2 className="font-bold text-amber-400">⌨ ทางลัด <span className="text-xs font-normal text-stone-400">(ใช้ได้เมื่อไม่ได้พิมพ์อยู่)</span></h2>
        <button type="button" aria-label="ปิดทางลัด" onClick={onClose} className="h-8 w-8 rounded-full bg-stone-700">✕</button>
      </div>
      <ul className="space-y-1">
        {KEYS.map((k) => (
          <li key={k.what} className="flex items-start gap-3">
            <span className="flex w-24 shrink-0 gap-1">
              {k.keys.map((x) => <kbd key={x} className="rounded border border-stone-600 bg-stone-950 px-1.5 font-mono text-xs">{x}</kbd>)}
            </span>
            <span className="text-stone-200">{k.what}</span>
          </li>
        ))}
      </ul>
      <p className="text-xs text-stone-400">ทำงานได้แม้แป้นพิมพ์เป็นภาษาไทย · ถ้าโฟกัสอยู่ที่ปุ่ม ใช้ N แทน Space · ใช้ได้เมื่อเริ่มการต่อสู้แล้ว</p>
      <label className="flex cursor-pointer items-center gap-2 rounded-lg bg-stone-800 px-2 py-1.5">
        <input type="checkbox" role="switch" className="h-5 w-5" checked={!enabled} onChange={(e) => onEnabled(!e.target.checked)} />
        <span>ปิดทางลัดแป้นพิมพ์ <span className="text-xs text-stone-400">(ปุ่ม Esc ยังใช้ได้)</span></span>
      </label>
    </section>
  )
}
