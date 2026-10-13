// Pieces shared by every card that has DND-TH's Thai text: the ไทย/EN switch and the credit line.
import { SPELLS_TH_CREDIT as CREDIT } from '../model/spellsTh'

export function LangSwitch({ lang, onChange }: { lang: 'th' | 'en'; onChange: (lang: 'th' | 'en') => void }) {
  return (
    <div className="flex shrink-0 overflow-hidden rounded-lg border border-stone-600 text-xs font-bold" role="group" aria-label="ภาษาของคำอธิบาย">
      {(['th', 'en'] as const).map((l) => (
        <button key={l} type="button" aria-pressed={lang === l} onClick={() => onChange(l)}
          className={`px-2.5 py-1.5 ${lang === l ? 'bg-amber-500 text-stone-900' : 'bg-stone-800 text-stone-300'}`}>
          {l === 'th' ? 'ไทย' : 'EN'}
        </button>
      ))}
    </div>
  )
}

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
