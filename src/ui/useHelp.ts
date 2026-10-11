// Help for game terms: shared state and the press/hover handlers (components are in help.tsx).
import { createContext, useContext, useRef } from 'react'
import { lookupTerm, type GlossaryEntry } from '../model/glossary'

export type Shown = { entry: GlossaryEntry; mode: 'tooltip'; x: number; y: number } | { entry: GlossaryEntry; mode: 'sheet' } | null

export const HelpContext = createContext<{ show: (s: Shown) => void } | null>(null)

const LONG_PRESS_MS = 450

/** Is this a real mouse that can hover (not a finger)? */
export const canHover = () => typeof window !== 'undefined' && window.matchMedia('(hover: hover) and (pointer: fine)').matches

/**
 * Props to spread on any element (usually a button) to give it help for `term`:
 * hover tooltip with a mouse, press-and-hold sheet on touch. Returns {} if there's no help.
 */
export function useHelp(term: string) {
  const ctx = useContext(HelpContext)
  const timer = useRef<number | undefined>(undefined)
  const longPressed = useRef(false)
  const entry = lookupTerm(term)
  if (!ctx || !entry) return {}

  const cancel = () => window.clearTimeout(timer.current)
  return {
    // Mouse: tooltip under the element.
    onMouseEnter: (e: React.MouseEvent) => {
      if (!canHover()) return
      const r = (e.currentTarget as HTMLElement).getBoundingClientRect()
      ctx.show({ entry, mode: 'tooltip', x: r.left, y: r.bottom })
    },
    onMouseLeave: () => canHover() && ctx.show(null),
    // Touch: press and hold opens the sheet.
    onPointerDown: (e: React.PointerEvent) => {
      if (e.pointerType === 'mouse') return
      longPressed.current = false
      cancel()
      timer.current = window.setTimeout(() => {
        longPressed.current = true
        ctx.show({ entry, mode: 'sheet' })
      }, LONG_PRESS_MS)
    },
    onPointerUp: cancel,
    onPointerCancel: cancel,
    onPointerLeave: cancel,
    // The tap that ends a long-press must not also press the button.
    onClickCapture: (e: React.MouseEvent) => {
      if (longPressed.current) {
        e.preventDefault()
        e.stopPropagation()
        longPressed.current = false
      }
      if (canHover()) ctx.show(null)
    },
    // Stop the phone's own long-press menu / text selection on these elements.
    onContextMenu: (e: React.MouseEvent) => e.preventDefault(),
    style: { WebkitTouchCallout: 'none' as const, userSelect: 'none' as const },
  }
}

