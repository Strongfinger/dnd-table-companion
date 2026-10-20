// Pieces shared by every card that has DND-TH's Thai text: the credit line, and WithThai (Thai text or the
// English one). The ไทย/EN choice itself is one button in the top bar (LangToggle in App.tsx).
import type { ReactNode } from 'react'
import { DND_TH_CREDIT as CREDIT } from '../model/dndTh'
import MiniMarkdown from './MiniMarkdown'
import { useTextLang } from './useTextLang'

export function ThaiCredit() {
  return (
    <p className="text-xs text-stone-500">
      คำแปลภาษาไทย:{' '}
      <a className="underline" href={CREDIT.url} target="_blank" rel="noreferrer">{CREDIT.name}</a>
      {' '}(<a className="underline" href={CREDIT.licenseUrl} target="_blank" rel="noreferrer">{CREDIT.license}</a>)
      {' '}ใช้โดยได้รับอนุญาต · ต้นฉบับ SRD 5.2.1 (CC-BY-4.0)
    </p>
  )
}

/** Thai markdown and credit when there is a translation and Thai is chosen, else just the English `children`. */
export function WithThai({ th, children }: { th?: string; children: ReactNode }) {
  const [lang] = useTextLang()
  if (!th) return <>{children}</>
  return (
    <div className="mt-1 space-y-2 text-sm text-stone-300">
      {lang === 'th' ? <><MiniMarkdown text={th} /><ThaiCredit /></> : children}
    </div>
  )
}
