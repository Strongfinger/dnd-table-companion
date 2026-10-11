// Confirm using an Action / Bonus Action / Reaction or starting Concentration:
// pick a suggestion or type it, then it's saved to the log.
import { useState } from 'react'
import { cleanDetail } from '../model/actionSuggestions'
import { Button } from './kit'

export default function UseActionDialog({ title, suggestions, placeholder, required = false, onConfirm, onCancel }: {
  title: string
  suggestions: string[]
  placeholder: string
  /** Concentration needs a spell name; actions can be logged without detail. */
  required?: boolean
  onConfirm: (detail: string) => void
  onCancel: () => void
}) {
  const [text, setText] = useState('')
  const detail = cleanDetail(text)
  const ok = !required || detail !== ''

  return (
    <div className="fixed inset-0 z-40 flex items-end justify-center bg-black/60" onClick={onCancel}>
      <div
        role="dialog"
        aria-label={title}
        className="w-full max-w-xl space-y-3 rounded-t-2xl border-t border-stone-700 bg-stone-900 p-4 pb-8"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="font-bold text-amber-400">{title}</h2>
        {suggestions.length > 0 && (
          <div className="flex max-h-48 flex-wrap gap-1.5 overflow-y-auto">
            {suggestions.map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => setText(s)}
                className={`rounded-full border px-3 py-1.5 text-sm ${detail === s ? 'border-amber-400 bg-amber-500 font-bold text-stone-900' : 'border-stone-600'}`}
              >
                {s}
              </button>
            ))}
          </div>
        )}
        <input
          autoFocus
          className="w-full rounded-lg border border-stone-600 bg-stone-950 px-3 py-2 text-base"
          placeholder={placeholder}
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && ok && onConfirm(detail)}
        />
        <div className="flex gap-2">
          <Button className="flex-1" onClick={onCancel}>ยกเลิก</Button>
          <Button variant="primary" className={`flex-1 ${ok ? '' : 'opacity-40'}`} onClick={() => ok && onConfirm(detail)}>
            ✓ ยืนยันและบันทึก
          </Button>
        </div>
      </div>
    </div>
  )
}
