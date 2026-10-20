import { useEffect, useState } from 'react'

const KEY = 'showItemImages'

/** Tell every mounted ItemImage at once: the Storage event only fires in *other* tabs. */
const listeners = new Set<(on: boolean) => void>()

function stored(): boolean {
  try { return localStorage.getItem(KEY) !== 'off' } catch { return true }
}

/**
 * Whether item pictures are shown, remembered on this device (on unless turned off).
 * Off hides every item picture, for a plainer list or a slow phone.
 */
export function useShowItemImages(): [boolean, (on: boolean) => void] {
  const [show, setShow] = useState(stored)
  useEffect(() => {
    listeners.add(setShow)
    return () => { listeners.delete(setShow) }
  }, [])
  return [show, (on) => {
    try { localStorage.setItem(KEY, on ? 'on' : 'off') } catch { /* private mode: just this visit */ }
    for (const l of listeners) l(on)
  }]
}
