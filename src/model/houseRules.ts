// House rules for everyone at the table: the DM writes them as notebook pages (kind 'rule'), and the rules
// in use (not the ones marked "เลิกใช้") go to players in a live room, who keep a copy on their phone to read
// in the lookup tab, also offline. Only the rule's own fields and text are sent, with [[links]] as plain text.
import { KIND_FIELDS, plainText, type Note } from './note'

export interface SharedRule {
  id: string
  title: string
  /** 'active' (ใช้อยู่) or 'trial' (ลองใช้). */
  status: string
  /** The rule's fields (type, trigger, effect, duration, who, official), by key. */
  fields: Record<string, string>
  body: string
}

export interface SharedRules {
  /** The DM's room campaign the rules belong to (null = pages without a campaign). */
  campaignId: string | null
  rules: SharedRule[]
}

const FIELD_KEYS = KIND_FIELDS.rule.map((f) => f.key).filter((k) => k !== 'status')
const SHARED_STATUS = ['active', 'trial']
const MAX_RULES = 100
const MAX_FIELD = 500
const MAX_BODY = 3000
/** Characters of JSON per message (Thai text is up to 3 bytes a character; a message may be 64 KB). */
const MAX_JSON = 20_000

const isShared = (status: string | undefined) => SHARED_STATUS.includes(status || 'active')

/** The house rules of a campaign that players may read, by title, as small as fits one room message. */
export function rulesToShare(notes: Note[], campaignId: string | null): SharedRule[] {
  const rules = notes
    .filter((n) => n.kind === 'rule' && n.campaignId === campaignId && n.title.trim() && isShared(n.fields?.status))
    .sort((a, b) => a.title.localeCompare(b.title, 'th'))
    .map((n): SharedRule => ({
      id: n.id,
      title: n.title.trim().slice(0, 100),
      status: n.fields?.status || 'active',
      fields: Object.fromEntries(FIELD_KEYS.filter((k) => n.fields?.[k]?.trim()).map((k) => [k, plainText(n.fields[k]).slice(0, MAX_FIELD)])),
      body: plainText(n.body).slice(0, MAX_BODY),
    }))
  const out: SharedRule[] = []
  let size = 0
  for (const r of rules.slice(0, MAX_RULES)) {
    size += JSON.stringify(r).length
    if (size > MAX_JSON) break
    out.push(r)
  }
  return out
}

const text = (v: unknown, max: number) => (typeof v === 'string' ? v.slice(0, max) : '')

/** A 'houseRules' room message from the DM, checked (null when it isn't one). */
export function parseHouseRules(body: unknown): SharedRules | null {
  if (typeof body !== 'object' || body === null) return null
  const b = body as Record<string, unknown>
  if (!Array.isArray(b.rules) || b.rules.length > MAX_RULES) return null
  if (b.campaignId !== null && (typeof b.campaignId !== 'string' || b.campaignId.length > 64)) return null
  const rules: SharedRule[] = []
  for (const x of b.rules) {
    if (typeof x !== 'object' || x === null) return null
    const r = x as Record<string, unknown>
    const id = text(r.id, 100)
    const title = text(r.title, 100).trim()
    if (!id || !title) return null
    const raw = typeof r.fields === 'object' && r.fields !== null ? (r.fields as Record<string, unknown>) : {}
    rules.push({
      id,
      title,
      status: SHARED_STATUS.includes(r.status as string) ? (r.status as string) : 'active',
      fields: Object.fromEntries(FIELD_KEYS.filter((k) => text(raw[k], MAX_FIELD)).map((k) => [k, text(raw[k], MAX_FIELD)])),
      body: text(r.body, MAX_BODY),
    })
  }
  return { campaignId: b.campaignId as string | null, rules }
}

/** Rules whose title, fields or text contain all the search words (any case). */
export function searchRules(rules: SharedRule[], query: string): SharedRule[] {
  const words = query.toLowerCase().split(/\s+/).filter(Boolean)
  return rules.filter((r) => {
    const all = [r.title, r.body, ...Object.values(r.fields)].join('\n').toLowerCase()
    return words.every((w) => all.includes(w))
  })
}

/** This device's own rules (any campaign) and the DM's rules received in a room, without repeats. */
export function mergeRules(own: SharedRule[], received: SharedRule[]): SharedRule[] {
  const ids = new Set(own.map((r) => r.id))
  return [...own, ...received.filter((r) => !ids.has(r.id))].sort((a, b) => a.title.localeCompare(b.title, 'th'))
}

/**
 * The rules players may read from these pages (for this device's own lookup tab): the selected campaign's,
 * or every campaign's when none is selected.
 */
export function ownRules(notes: Note[], campaignId?: string | null): SharedRule[] {
  const all = [...new Set(notes.filter((n) => n.kind === 'rule').map((n) => n.campaignId))]
  const campaigns = campaignId && all.includes(campaignId) ? [campaignId] : all
  return campaigns.flatMap((c) => rulesToShare(notes, c))
}
