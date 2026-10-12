// Small shared UI pieces so screens stay short and look consistent.
import { useState, type ReactNode } from 'react'
import { ACTION_KINDS, parseManualRoll, rollDie, type ActionEconomy, type ActionKind } from '../rules'
import { Term } from './help'
import { useHelp } from './useHelp'

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

export function Checkbox({ checked, onChange, label, disabled = false }: {
  checked: boolean
  onChange: (v: boolean) => void
  label: ReactNode
  disabled?: boolean
}) {
  return (
    <label className={`flex items-center gap-2 py-1 ${disabled ? 'opacity-70' : 'cursor-pointer'}`}>
      <input type="checkbox" className="h-5 w-5 accent-amber-400" checked={checked} disabled={disabled} onChange={(e) => onChange(e.target.checked)} />
      <span>{label}</span>
    </label>
  )
}

const buttonStyles = {
  primary: 'bg-amber-500 text-stone-900 hover:bg-amber-400',
  secondary: 'bg-stone-700 text-stone-100 hover:bg-stone-600',
  danger: 'bg-red-800 text-white hover:bg-red-700',
}

export function Button({ children, onClick, variant = 'secondary', className = '', 'aria-label': ariaLabel }: {
  children: ReactNode
  onClick: () => void
  variant?: keyof typeof buttonStyles
  className?: string
  /** For icon-only buttons (e.g. ⚙️), so screen readers say what they do. */
  'aria-label'?: string
}) {
  return (
    <button type="button" onClick={onClick} aria-label={ariaLabel} className={`rounded-lg px-4 py-2 font-bold ${buttonStyles[variant]} ${className}`}>
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
      <div className="text-xs text-stone-400"><Term name={label} /></div>
    </div>
  )
}

const CUSTOM = '__custom'

/**
 * Pick-list with an "อื่นๆ (Homebrew)" option that reveals a text box,
 * so non-SRD choices (e.g. Noble) can still be typed in.
 */
export function ChoiceField({ value, options, onChange, disabled = false }: {
  value: string
  options: readonly string[]
  onChange: (v: string) => void
  disabled?: boolean
}) {
  const [custom, setCustom] = useState(value !== '' && !options.includes(value))
  return (
    <div className="space-y-2">
      <select
        className={inputClass}
        disabled={disabled}
        value={custom ? CUSTOM : value}
        onChange={(e) => {
          const v = e.target.value
          setCustom(v === CUSTOM)
          onChange(v === CUSTOM ? '' : v)
        }}
      >
        <option value="">— เลือก —</option>
        {options.map((o) => <option key={o} value={o}>{o}</option>)}
        <option value={CUSTOM}>อื่นๆ (Homebrew)…</option>
      </select>
      {custom && <input className={inputClass} value={value} placeholder="พิมพ์ชื่อเอง" onChange={(e) => onChange(e.target.value)} />}
    </div>
  )
}

/** Shows rule warnings (⚠️) and notes (ℹ️) from checkCharacter(). */
export function RuleMessages({ messages }: { messages: { level: 'warning' | 'info'; message: string }[] }) {
  if (messages.length === 0) return <p className="rounded-lg bg-emerald-950 p-3 text-sm text-emerald-300">✓ ถูกต้องตามกติกา</p>
  return (
    <ul className="space-y-1 rounded-lg bg-stone-900 p-3 text-sm">
      {messages.map((m) => (
        <li key={m.message} className={m.level === 'warning' ? 'text-amber-300' : 'text-stone-400'}>
          {m.level === 'warning' ? '⚠️ ' : 'ℹ️ '}
          {m.message}
        </li>
      ))}
    </ul>
  )
}

/**
 * A dice roll the player can do two ways: 🎲 let the app roll, or type the number
 * from real dice at the table. Either way `onRoll` gets one die result (1..sides).
 */
export function DiceRoll({ sides, label, onRoll }: { sides: number; label: string; onRoll: (value: number, manual: boolean) => void }) {
  const [text, setText] = useState('')
  const manual = parseManualRoll(text, sides)
  return (
    <div className="space-y-1">
      <div className="flex gap-2">
        <Button variant="primary" className="flex-1 whitespace-nowrap px-2" onClick={() => onRoll(rollDie(sides), false)}>
          🎲 {label} (d{sides})
        </Button>
        <input
          className="w-16 rounded-lg border border-stone-600 bg-stone-900 px-2 text-center text-base"
          inputMode="numeric"
          placeholder={`1–${sides}`}
          aria-label={`ค่าที่ทอยได้จริง d${sides}`}
          value={text}
          onChange={(e) => setText(e.target.value.replace(/\D/g, ''))}
        />
        <Button
          className={`whitespace-nowrap px-3 ${manual === null ? 'opacity-40' : ''}`}
          onClick={() => {
            if (manual === null) return
            onRoll(manual, true)
            setText('')
          }}
        >
          ใช้ค่านี้
        </Button>
      </div>
      {text && manual === null && <p className="text-xs text-amber-300">ใส่เลข 1–{sides}</p>}
    </div>
  )
}

const ACTION_LABEL = { action: 'Action', bonusAction: 'Bonus Action', reaction: 'Reaction' } as const

/**
 * Action / Bonus Action / Reaction for this turn. Lit = still available, dim and crossed = used.
 * Tap to mark used (or tap again to give it back).
 */
export function ActionEconomyBar({ economy, onToggle, compact = false, locked = [] }: {
  economy: ActionEconomy
  onToggle?: (kind: ActionKind) => void
  compact?: boolean
  /** Available but can't be used right now (e.g. not this player's turn): shown dimmed with 🔒. */
  locked?: ActionKind[]
}) {
  return (
    <div className="flex gap-1.5">
      {ACTION_KINDS.map((kind) => {
        const used = economy[kind]
        const isLocked = !used && locked.includes(kind)
        const style = used ? 'border-stone-700 text-stone-500 line-through'
          : isLocked ? 'border-stone-600 bg-stone-900 text-stone-400'
            : 'border-emerald-500 bg-emerald-900/60 text-emerald-100'
        const size = compact ? 'px-1.5 text-[10px]' : 'flex-1 px-2 py-2 text-sm font-bold'
        return onToggle ? (
          <EconomyButton key={kind} label={ACTION_LABEL[kind]} used={used} locked={isLocked} className={`rounded-lg border ${style} ${size}`} onClick={() => onToggle(kind)} />
        ) : (
          <span key={kind} className={`rounded border ${style} ${size}`}>{compact ? ACTION_LABEL[kind].replace('Bonus Action', 'Bonus') : ACTION_LABEL[kind]}</span>
        )
      })}
    </div>
  )
}

/** A button that also shows help for its label (hover with a mouse, press-and-hold on a phone). */
export function HelpButton({ term, children, className = '', onClick, ...rest }: {
  term: string
  children: ReactNode
  className?: string
  onClick: () => void
  'aria-pressed'?: boolean
  title?: string
}) {
  const help = useHelp(term)
  return (
    <button type="button" {...help} {...rest} onClick={onClick} className={className}>
      {children}
    </button>
  )
}

function EconomyButton({ label, used, locked, className, onClick }: { label: string; used: boolean; locked: boolean; className: string; onClick: () => void }) {
  return <HelpButton term={label} aria-pressed={used} className={className} onClick={onClick}>{locked && '🔒 '}{label}</HelpButton>
}
