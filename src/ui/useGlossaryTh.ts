// DND-TH's Thai Rules Glossary (src/data/srd-glossary-th.json), by English entry name, loaded on first use.
// Optional like the other Thai files: without it the app shows only our short summaries.
import { useEffect, useState } from 'react'
import type { GlossaryThEntry, GlossaryThFile } from '../model/glossaryTh'

const thaiGlossaryFile = import.meta.glob<GlossaryThFile>('../data/srd-glossary-th.json', { import: 'default' })

export function useGlossaryTh(): Map<string, GlossaryThEntry> {
  const [map, setMap] = useState(() => new Map<string, GlossaryThEntry>())
  useEffect(() => {
    const load = Object.values(thaiGlossaryFile)[0]
    load?.().then((f) => setMap(new Map(f.entries.map((e) => [e.en, e]))))
  }, [])
  return map
}
