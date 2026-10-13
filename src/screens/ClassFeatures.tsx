// Every SRD 5.2.1 feature the character has, with its English rules text: class features up to their level,
// their subclass's features, species traits and feats. Tap a name to read it. (Limited-use ones are also
// in the play panel, where they can be used.)
import { useState } from 'react'
import type { Character } from '../model/character'
import { Section } from '../ui/kit'
import FeatureText from './FeatureText'
import { useFeaturesTh, useFeatureTexts } from './useSrdData'
import { characterFeatureEntries } from '../model/featureTexts'

export default function ClassFeatures({ c }: { c: Character }) {
  const data = useFeatureTexts()
  const thai = useFeaturesTh()
  const [open, setOpen] = useState<string | null>(null)
  if (!data) return null
  const entries = characterFeatureEntries(c, data)
  if (entries.length === 0) return null
  return (
    <Section title="ความสามารถจาก Class · Species · Feat">
      <p className="mb-2 text-xs text-stone-400">จาก SRD 5.2.1 (ภาษาอังกฤษ, Feat มีภาษาไทย) · แตะชื่อเพื่ออ่าน{c.subclass ? '' : ' · ใส่ Subclass ในหน้าแก้ไขเพื่อดูความสามารถของ Subclass'}</p>
      <ul className="divide-y divide-stone-800">
        {entries.map((e) => (
          <li key={e.id} className="py-1.5">
            <button type="button" className="flex w-full items-baseline justify-between gap-2 text-left" onClick={() => setOpen(open === e.id ? null : e.id)} aria-expanded={open === e.id}>
              <span className={open === e.id ? 'font-bold text-amber-300' : ''}>{e.name}{thai[e.id] && <span className="text-sm font-normal text-stone-500"> · {thai[e.id].name}</span>}</span>
              <span className="shrink-0 text-xs text-stone-500">{e.tag}</span>
            </button>
            {open === e.id && <FeatureText text={e.text} th={thai[e.id]} />}
          </li>
        ))}
      </ul>
    </Section>
  )
}
