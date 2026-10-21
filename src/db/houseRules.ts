// House rules on this device: the DM's rule pages to send to a room, and (players) the copy received from the DM.
import { liveQuery } from 'dexie'
import { parseHouseRules, rulesToShare, type SharedRule, type SharedRules } from '../model/houseRules'
import { db } from './db'
import { listNotes } from './notes'

const RECEIVED = 'house-rules'

/** DM: the campaign's rules players may read, whenever a page changes. */
export function watchRulesToShare(campaignId: string | null, onChange: (rules: SharedRule[]) => void): () => void {
  const sub = liveQuery(listNotes).subscribe({ next: (notes) => onChange(rulesToShare(notes, campaignId)), error: (err) => console.error('house rules', err) })
  return () => sub.unsubscribe()
}

/** Player: keep the DM's latest rules on this phone (readable offline, until the next room sends new ones). */
export function saveReceivedRules(rules: SharedRules): Promise<string> {
  return db.settings.put({ key: RECEIVED, value: rules })
}

export async function getReceivedRules(): Promise<SharedRule[]> {
  return parseHouseRules((await db.settings.get(RECEIVED))?.value)?.rules ?? []
}
