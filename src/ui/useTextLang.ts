import { useEffect, useState } from 'react'

export type TextLang = 'th' | 'en'

// The storage key is still "spellLang": spells had the switch first.
const KEY = 'spellLang'

/** Tell every mounted card at once: the Storage event only fires in *other* tabs. */
const listeners = new Set<(lang: TextLang) => void>()

function stored(): TextLang {
  try { return localStorage.getItem(KEY) === 'en' ? 'en' : 'th' } catch { return 'th' }
}

/**
 * Thai or English rules text (spells, feats, monsters, items…): the reader's choice, remembered on this device
 * (Thai first). One choice for the whole app, changed with the ไทย/English switch on the room tab (🌐 ห้อง).
 */
export function useTextLang(): [TextLang, (lang: TextLang) => void] {
  const [lang, setLang] = useState(stored)
  useEffect(() => {
    listeners.add(setLang)
    return () => { listeners.delete(setLang) }
  }, [])
  return [lang, (l) => {
    try { localStorage.setItem(KEY, l) } catch { /* private mode: just this visit */ }
    for (const fn of listeners) fn(l)
  }]
}
