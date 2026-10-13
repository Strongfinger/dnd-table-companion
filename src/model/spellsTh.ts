// Thai spell text (a translation of the SRD 5.2.1 spells), kept apart from the English data in
// src/data/srd-spells-th.json. The file is built from a CSV by scripts/srd/spells-th.ts, which uses
// buildSpellsTh() below; the app shows it on spell cards with a TH/EN switch.
// This module has no runtime imports, so Node can run the build script on it directly.
import type { SrdSpell } from './spells'

export interface SpellTh {
  /** Thai spell name (the English name stays the main one). */
  name: string
  text: string
  higher?: string
}

export interface SpellsThFile {
  source: string
  license: string
  builtAt: string
  /** By SRD spell id. */
  spells: Record<string, SpellTh>
}

export const SPELLS_TH_CREDIT = { name: 'DND-TH', url: 'https://dnd-th.com/', license: 'CC BY-NC-SA 4.0', licenseUrl: 'https://creativecommons.org/licenses/by-nc-sa/4.0/' }

/** Read CSV text (RFC 4180: quoted fields, "" inside quotes, line breaks inside quotes, CRLF, BOM). */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = []
  let row: string[] = []
  let field = ''
  let quoted = false
  const s = text.replace(/^﻿/, '')
  for (let i = 0; i < s.length; i++) {
    const ch = s[i]
    if (quoted) {
      if (ch === '"' && s[i + 1] === '"') { field += '"'; i++ }
      else if (ch === '"') quoted = false
      else field += ch
    } else if (ch === '"') quoted = true
    else if (ch === ',') { row.push(field); field = '' }
    else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && s[i + 1] === '\n') i++
      row.push(field); rows.push(row); row = []; field = ''
    } else field += ch
  }
  if (field !== '' || row.length > 0) { row.push(field); rows.push(row) }
  return rows.filter((r) => r.some((f) => f.trim() !== ''))
}

/** Plain text from a scraped cell: no HTML tags or entities, tidy spaces, paragraphs kept. */
export function cleanText(v: string, max: number): string {
  return v
    .replace(/<br\s*\/?>/gi, '\n').replace(/<\/p>/gi, '\n').replace(/<[^>]*>/g, '')
    .replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'")
    .split('\n').map((l) => l.replace(/[ \t]+/g, ' ').trim()).filter(Boolean).join('\n')
    .slice(0, max)
}

const norm = (name: string) => name.toLowerCase().replace(/[’‘`]/g, "'").replace(/\s+/g, ' ').trim()

/** "ลูกไฟโลกันต์ (Fireball)" → Thai and English parts (the English part is the last brackets). */
export function splitTitle(title: string): { thai: string; english: string } | null {
  const m = title.trim().match(/^(.*?)\s*\(([^()]+)\)\s*$/)
  return m ? { thai: m[1].trim(), english: m[2].trim() } : null
}

export interface SpellsThReport {
  rows: number
  matched: number
  /** English names (from the CSV) that aren't SRD 5.2.1 spells: skipped. */
  notInSrd: string[]
  /** SRD spells with no Thai row. */
  missing: string[]
  /** English names that came more than once (first kept). */
  duplicates: string[]
  /** Rows without a usable name or text. */
  incomplete: number
}

/**
 * Match CSV rows to SRD spells by English name. Columns (header names, any order):
 * `english_name` + `thai_name`, or `title` like "ลูกไฟโลกันต์ (Fireball)"; `thai_text`; optional `thai_higher_levels`.
 */
export function buildSpellsTh(csv: string, srd: Pick<SrdSpell, 'id' | 'name'>[]): { spells: Record<string, SpellTh>; report: SpellsThReport } | { error: string } {
  const [header, ...rows] = parseCsv(csv)
  if (!header) return { error: 'empty CSV' }
  const col = (name: string) => header.findIndex((h) => h.trim().toLowerCase() === name)
  const iEn = col('english_name'), iTh = col('thai_name'), iTitle = col('title'), iText = col('thai_text'), iHigher = col('thai_higher_levels')
  if (iText < 0 || (iTitle < 0 && (iEn < 0 || iTh < 0))) {
    return { error: `need columns thai_text and either title or english_name + thai_name (found: ${header.join(', ')})` }
  }
  const byName = new Map(srd.map((s) => [norm(s.name), s.id]))
  const spells: Record<string, SpellTh> = {}
  const report: SpellsThReport = { rows: rows.length, matched: 0, notInSrd: [], missing: [], duplicates: [], incomplete: 0 }
  const seen = new Set<string>()
  for (const r of rows) {
    const split = iTitle >= 0 ? splitTitle(r[iTitle] ?? '') : null
    const english = (iEn >= 0 ? r[iEn] : '')?.trim() || split?.english || ''
    const thai = cleanText((iTh >= 0 ? r[iTh] : '') || split?.thai || '', 100)
    const text = cleanText(r[iText] ?? '', 8000)
    if (!english || !thai || !text) { report.incomplete++; continue }
    const id = byName.get(norm(english))
    if (!id) { report.notInSrd.push(english.slice(0, 60)); continue }
    if (seen.has(id)) { report.duplicates.push(english.slice(0, 60)); continue }
    seen.add(id)
    const higher = iHigher >= 0 ? cleanText(r[iHigher] ?? '', 2000) : ''
    spells[id] = { name: thai, text, ...(higher ? { higher } : {}) }
    report.matched++
  }
  report.missing = srd.filter((s) => !seen.has(s.id)).map((s) => s.name)
  return { spells, report }
}
