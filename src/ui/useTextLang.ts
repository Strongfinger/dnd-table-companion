import { useState } from 'react'

/**
 * Thai or English rules text (spells, feats…): the reader's choice, remembered on this device (Thai first).
 * One choice for every card. (The storage key is still "spellLang": spells had the switch first.)
 */
export function useTextLang(): ['th' | 'en', (lang: 'th' | 'en') => void] {
  const [lang, setLang] = useState<'th' | 'en'>(() => {
    try { return localStorage.getItem('spellLang') === 'en' ? 'en' : 'th' } catch { return 'th' }
  })
  return [lang, (l) => {
    setLang(l)
    try { localStorage.setItem('spellLang', l) } catch { /* private mode: just this visit */ }
  }]
}
