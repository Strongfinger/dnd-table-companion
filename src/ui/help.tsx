// Help for game terms.
// Computer (mouse): hover shows a small tooltip.
// Phone/tablet: tap a dotted-underlined word, or press-and-hold a button (~½ s), to open a sheet.
// A long-press never triggers the button's normal tap.
import { useContext, useState, type ReactNode } from 'react'
import { lookupTerm } from '../model/glossary'
import { canHover, HelpContext, useHelp, type Shown } from './useHelp'

export function HelpProvider({ children }: { children: ReactNode }) {
  const [shown, setShown] = useState<Shown>(null)
  return (
    <HelpContext.Provider value={{ show: setShown }}>
      {children}
      {shown?.mode === 'tooltip' && (
        <div
          role="tooltip"
          className="pointer-events-none fixed z-50 max-w-xs rounded-lg border border-amber-600 bg-stone-900 p-2 text-sm shadow-2xl"
          style={{ left: Math.min(shown.x, window.innerWidth - 330), top: shown.y + 8 }}
        >
          <div className="font-bold text-amber-400">{shown.entry.title}</div>
          <div className="text-stone-200">{shown.entry.text}</div>
        </div>
      )}
      {shown?.mode === 'sheet' && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50" onClick={() => setShown(null)}>
          <div role="dialog" aria-label={shown.entry.title} className="w-full max-w-xl rounded-t-2xl border-t border-amber-600 bg-stone-900 p-4 pb-8">
            <div className="mb-1 flex items-start justify-between gap-2">
              <h2 className="font-bold text-amber-400">ℹ️ {shown.entry.title}</h2>
              <button type="button" aria-label="ปิด" className="h-8 w-8 shrink-0 rounded-full bg-stone-700">✕</button>
            </div>
            <p className="text-stone-200">{shown.entry.text}</p>
            <p className="mt-3 text-xs text-stone-500">แตะที่ไหนก็ได้เพื่อปิด</p>
          </div>
        </div>
      )}
    </HelpContext.Provider>
  )
}

/** A word with help: dotted underline; tap (phone) or hover (mouse). Plain text if there's no help. */
export function Term({ name, children }: { name: string; children?: ReactNode }) {
  const ctx = useContext(HelpContext)
  const help = useHelp(name)
  const entry = lookupTerm(name)
  if (!entry || !ctx) return <>{children ?? name}</>
  return (
    <span
      {...help}
      role="button"
      tabIndex={0}
      className="cursor-help underline decoration-dotted decoration-stone-500 underline-offset-2"
      onClick={(e) => {
        e.stopPropagation()
        if (!canHover()) ctx.show({ entry, mode: 'sheet' })
      }}
      onKeyDown={(e) => e.key === 'Enter' && ctx.show({ entry, mode: 'sheet' })}
    >
      {children ?? name}
    </span>
  )
}
