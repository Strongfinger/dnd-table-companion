// Short Thai summaries of the SRD magic items (src/data/srd-magic-items-summary-th.json), for the buffs list:
// a worn magic item shows its key effects in a line or two, and "อ่านเพิ่มเติม" opens its full text.
import { shortEffect, type MagicEffect } from './inventory'

export interface MagicItemSummaryFile {
  source: string
  license: string
  /** By SRD magic item id: the English name (to find items added by name) and the summary. */
  items: Record<string, { name: string; summary: string }>
}

/** The SRD summary of the magic item with this English name (case and spaces don't matter). */
export function srdSummaryByName(items: MagicItemSummaryFile['items'], name: string): string | undefined {
  const key = name.trim().toLowerCase().replace(/\s+/g, ' ')
  return Object.values(items).find((i) => i.name.toLowerCase() === key)?.summary
}

/**
 * What the buffs list shows for an equipped magic item: its own summary (written by the DM, or set when it was
 * added from the SRD list), else the SRD summary for its name, else the start of its text.
 */
export function effectSummary(effect: Pick<MagicEffect, 'name' | 'summary' | 'description'>, srd: MagicItemSummaryFile['items']): string {
  return effect.summary || srdSummaryByName(srd, effect.name) || shortEffect(effect.description)
}
