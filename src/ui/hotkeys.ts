// Single-key shortcuts for the DM's fight tracker. `hotkeyFor` is a pure function (easy to test);
// `useHotkeys` reads the real keyboard event and calls it.
//
// Keys are matched on `event.code` (the physical key), not `event.key`, so they work on the Thai
// keyboard layout too (the N key types "ื" there).
import { useEffect, useRef } from 'react'

export type HotkeyAction = 'next' | 'previous' | 'damage' | 'undo' | 'search' | 'escape' | 'help'

/** What `hotkeyFor` needs to know about a key press. */
export interface KeyPress {
  code: string
  shiftKey: boolean
  ctrlKey: boolean
  metaKey: boolean
  altKey: boolean
  /** Typing with an input method (Thai/Japanese…): the key belongs to the IME. */
  isComposing: boolean
  /** Key held down: only the first press counts. */
  repeat: boolean
  /** Focus is in an input, textarea, select or editable text. */
  typing: boolean
  /** Focus is on a button, link or similar: Space must press that control. */
  onControl: boolean
  /** A dialog (help card, action chooser, dice roller…) is open. */
  dialogOpen: boolean
}

const BY_CODE: Record<string, HotkeyAction> = {
  KeyN: 'next', Space: 'next', KeyP: 'previous', KeyD: 'damage', KeyZ: 'undo', Slash: 'search', Escape: 'escape',
}

/**
 * Which tracker action a key press means, or null to leave it alone.
 * `enabled` false (the DM turned shortcuts off): only Esc still works (it is not a character key).
 */
export function hotkeyFor(k: KeyPress, enabled = true): HotkeyAction | null {
  if (k.isComposing || k.ctrlKey || k.metaKey || k.altKey || k.repeat) return null
  if (k.typing || k.dialogOpen) return null
  // "?" is Shift + the slash key.
  const action = k.code === 'Slash' && k.shiftKey ? 'help' : k.shiftKey ? null : BY_CODE[k.code] ?? null
  if (!action) return null
  if (!enabled && action !== 'escape') return null
  // Space on a focused button presses the button, it must not skip the turn.
  if (k.code === 'Space' && k.onControl) return null
  return action
}

const CONTROL = 'button, a, summary, [role="button"], [role="checkbox"], [role="switch"]'
const TYPING = 'input, textarea, select, [contenteditable=""], [contenteditable="true"]'

function pressFrom(e: KeyboardEvent): KeyPress {
  const t = e.target instanceof Element ? e.target : null
  return {
    code: e.code, shiftKey: e.shiftKey, ctrlKey: e.ctrlKey, metaKey: e.metaKey, altKey: e.altKey,
    isComposing: e.isComposing, repeat: e.repeat,
    typing: !!t?.closest(TYPING),
    onControl: !!t?.closest(CONTROL),
    dialogOpen: !!document.querySelector('[role="dialog"], [aria-modal="true"]'),
  }
}

export type HotkeyHandlers = Partial<Record<HotkeyAction, () => void>>

/**
 * Run `handlers[action]` when a shortcut key is pressed. The handlers can change on every render:
 * the newest ones are always used (kept in a ref), so even two quick presses see fresh state.
 * `enabled` (the on/off switch) is read at press time too.
 */
export function useHotkeys(handlers: HotkeyHandlers, enabled: boolean) {
  const latest = useRef(handlers)
  const on = useRef(enabled)
  useEffect(() => {
    latest.current = handlers
    on.current = enabled
  })
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const action = hotkeyFor(pressFrom(e), on.current)
      const run = action && latest.current[action]
      if (!run) return
      e.preventDefault()
      run()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])
}

const SAVED_KEY = 'tracker-hotkeys'

/** Shortcuts are on unless the DM switched them off on this device (storage may be unavailable). */
export function savedHotkeysOn(): boolean {
  try {
    return localStorage.getItem(SAVED_KEY) !== 'off'
  } catch {
    return true
  }
}

export function saveHotkeysOn(on: boolean) {
  try {
    localStorage.setItem(SAVED_KEY, on ? 'on' : 'off')
  } catch {
    // not saved: fine
  }
}
