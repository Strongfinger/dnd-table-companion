// Thai Rules Glossary: DND-TH's translation (https://dnd-th.com/, used with their permission, 2026-10-13) of the
// SRD 5.2.1 Rules Glossary, in src/data/srd-glossary-th.json. Built by scripts/srd/glossary-th.ts from DND-TH's
// rules-glossary page (markdown). Every one of its 154 entries is in the SRD 5.2.1 glossary (checked against the
// PDF, 2026-10-13). The app shows the full Thai text next to our own short summaries (model/glossary.ts).
// Nothing here is imported at runtime except dndTh.ts, so Node can run the build script on it directly.
import { cleanMarkdown, findTypos, nonSrdName, stripNonSrdNames } from './dndTh.ts'

export interface GlossaryThEntry {
  /** English entry name, as in the SRD ("Prone", "Opportunity Attacks"). */
  en: string
  /** Thai name. */
  th: string
  /** The entry's tag in English, if it has one: Action, Area of Effect, Attitude, Condition or Hazard. */
  tag?: string
  /** Rules text in simple markdown. */
  text: string
}

export interface GlossaryThFile {
  source: string
  license: string
  builtAt: string
  /** In glossary order. */
  entries: GlossaryThEntry[]
}

export interface GlossaryThReport { entries: number; nonSrd: string[]; typos: string[] }

/** "ติดพิษ (Poisoned) [สภาวะ (Condition)] {#PoisonedCondition}" → its parts. */
function parseEntryHeading(text: string): { th: string; en: string; tag?: string } | null {
  let t = text.replace(/\s*\{#[^}]*\}\s*$/, '').trim()
  const tag = t.match(/\s*\[([^\]]*)\]\s*$/)
  if (tag) t = t.slice(0, tag.index).trim()
  const en = t.match(/\(([^()]+)\)\s*$/)
  if (!en) return null
  const tagEn = tag?.[1].match(/\(([^()]+)\)\s*$/)?.[1] ?? tag?.[1]
  return { th: t.slice(0, en.index).trim(), en: en[1].trim(), ...(tagEn ? { tag: tagEn.trim() } : {}) }
}

/** Every "### Thai (English)" entry with its text up to the next entry; "---" dividers and sidebars go. */
export function buildGlossaryTh(md: string): { entries: GlossaryThEntry[]; report: GlossaryThReport } {
  const entries: GlossaryThEntry[] = []
  const report: GlossaryThReport = { entries: 0, nonSrd: [], typos: [] }
  let cur: { head: NonNullable<ReturnType<typeof parseEntryHeading>>; lines: string[] } | null = null
  const close = () => {
    if (!cur) return
    const text = stripNonSrdNames(cleanMarkdown(cur.lines.join('\n').slice(0, 30000)))
    const bad = nonSrdName(text)
    if (bad) report.nonSrd.push(`${cur.head.en} (${bad})`)
    else if (text) {
      entries.push({ ...cur.head, text })
      for (const t of findTypos(`${cur.head.th}\n${text}`)) report.typos.push(`${cur.head.en}: ${t}`)
    }
    cur = null
  }
  for (const line of md.replace(/\r\n?/g, '\n').split('\n')) {
    const h = line.match(/^(#{1,6})\s+(.*)$/)
    if (h && h[1].length <= 3) {
      close()
      const head = h[1].length === 3 ? parseEntryHeading(h[2]) : null
      if (head) cur = { head, lines: [] }
      continue
    }
    if (/^\s*-{3,}\s*$/.test(line) || /^\s*>/.test(line)) continue
    cur?.lines.push(h ? line.replace(/\s*\{#[^}]*\}\s*$/, '') : line)
  }
  close()
  report.entries = entries.length
  return { entries, report }
}
