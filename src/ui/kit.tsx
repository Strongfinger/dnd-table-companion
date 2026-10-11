// Small shared UI pieces so screens stay short and look consistent.
import { useState, type ReactNode } from 'react'

export function Section({ title, children, action }: { title: string; children: ReactNode; action?: ReactNode }) {
  return (
    <section className="rounded-xl bg-stone-800 p-4">
      <div className="mb-3 flex items-center justify-between gap-2">
        <h2 className="font-bold text-amber-400">{title}</h2>
        {action}
      </div>
      {children}
    </section>
  )
}

export function Label({ text, children, className = '' }: { text: string; children: ReactNode; className?: string }) {
  return (
    <label className={`block ${className}`}>
      <span className="mb-1 block text-sm text-stone-400">{text}</span>
      {children}
    </label>
  )
}

// text-base (16px) stops iPhones from zooming in when an input is tapped.
const inputClass =
  'w-full rounded-lg border border-stone-600 bg-stone-900 px-3 py-2 text-base text-stone-100 focus:border-amber-400 focus:outline-none'

export function TextInput({ value, onChange, placeholder }: { value: string; onChange: (v: string) => void; placeholder?: string }) {
  return <input className={inputClass} value={value} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} />
}

export function TextArea({ value, onChange, rows = 4 }: { value: string; onChange: (v: string) => void; rows?: number }) {
  return <textarea className={inputClass} rows={rows} value={value} onChange={(e) => onChange(e.target.value)} />
}

export function Select<T extends string>({ value, options, onChange }: {
  value: T
  options: readonly { value: T; label: string }[]
  onChange: (v: T) => void
}) {
  return (
    <select className={inputClass} value={value} onChange={(e) => onChange(e.target.value as T)}>
      {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
    </select>
  )
}

/**
 * Number box that lets you type freely, then snaps to a whole number between min and max
 * when you leave the field. So the saved value is always valid for the rules engine.
 */
export function NumberInput({ value, onChange, min, max }: { value: number; onChange: (v: number) => void; min: number; max: number }) {
  const [text, setText] = useState(String(value))
  // If the value changes from outside (e.g. "use average HP"), show the new number.
  const [shown, setShown] = useState(value)
  if (value !== shown) {
    setShown(value)
    setText(String(value))
  }

  function commit() {
    const n = Math.round(Number(text))
    const clamped = Number.isFinite(n) && text.trim() !== '' ? Math.min(max, Math.max(min, n)) : value
    setText(String(clamped))
    if (clamped !== value) onChange(clamped)
  }

  return (
    <input
      className={`${inputClass} text-center`}
      inputMode="numeric"
      value={text}
      onChange={(e) => setText(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
    />
  )
}

export function Checkbox({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: ReactNode }) {
  return (
    <label className="flex cursor-pointer items-center gap-2 py-1">
      <input type="checkbox" className="h-5 w-5 accent-amber-400" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      <span>{label}</span>
    </label>
  )
}

const buttonStyles = {
  primary: 'bg-amber-500 text-stone-900 hover:bg-amber-400',
  secondary: 'bg-stone-700 text-stone-100 hover:bg-stone-600',
  danger: 'bg-red-800 text-white hover:bg-red-700',
}

export function Button({ children, onClick, variant = 'secondary', className = '' }: {
  children: ReactNode
  onClick: () => void
  variant?: keyof typeof buttonStyles
  className?: string
}) {
  return (
    <button type="button" onClick={onClick} className={`rounded-lg px-4 py-2 font-bold ${buttonStyles[variant]} ${className}`}>
      {children}
    </button>
  )
}

/** A stat shown big with a small label under it, e.g. AC 16. */
export function Stat({ label, value, sub }: { label: string; value: ReactNode; sub?: ReactNode }) {
  return (
    <div className="rounded-lg bg-stone-900 px-2 py-2 text-center">
      <div className="text-xl font-bold">{value}</div>
      {sub && <div className="text-xs text-stone-400">{sub}</div>}
      <div className="text-xs text-stone-400">{label}</div>
    </div>
  )
}
