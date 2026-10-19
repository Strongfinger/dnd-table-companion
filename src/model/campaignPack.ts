// Campaign pack: one JSON file with a campaign's prepared notebook pages, session plans and fights,
// written outside the app (e.g. from the DM's own adventure notes) and imported on the DM's device.
// Every page and fight has a short `id` in the file; the stored id is built from the campaign and that
// id, so importing the same pack again finds the same records instead of making copies.
// The file is checked like any other import: only known fields, short strings, limited counts.
import { createEncounter, createMonsters, type Encounter } from './encounter'
import { NOTE_KINDS, createNote, type Note, type NoteKind } from './note'
import { createScene, type Scene } from './sessionPlan'

export const PACK_FORMAT = 'dnd-table-companion/campaign-pack'
export const MAX_PACK_BYTES = 1_000_000

export interface PackMonster {
  name: string
  count: number
  ac: number
  hp: number
  initBonus: number
  notes: string
  hidden: boolean
}

export interface CampaignPack {
  campaign: { id: string; name: string }
  notes: Note[]
  encounters: Encounter[]
}

export type PackResult = { ok: true; pack: CampaignPack; warnings: string[] } | { ok: false; error: string }

const SLUG = /^[a-z0-9-]{1,40}$/
const MAX_PAGES = 300
const MAX_FIGHTS = 50

type Obj = Record<string, unknown>
const isObj = (v: unknown): v is Obj => typeof v === 'object' && v !== null && !Array.isArray(v)
const str = (v: unknown, max: number) => (typeof v === 'string' ? v.slice(0, max) : '')
const int = (v: unknown, min: number, max: number, fallback: number) =>
  typeof v === 'number' && Number.isFinite(v) ? Math.min(max, Math.max(min, Math.round(v))) : fallback
const list = (v: unknown, max: number): unknown[] => (Array.isArray(v) ? v.slice(0, max) : [])

/**
 * Which campaign on this device a pack goes into by default: the pack's own campaign if it is here already,
 * else a campaign with the same name (e.g. one the DM made by hand before importing, which players' phones
 * already follow), else none (a new campaign is made with the pack's id and name).
 */
export function defaultPackTarget(pack: Pick<CampaignPack, 'campaign'>, campaigns: { id: string; name: string }[]): string | null {
  if (campaigns.some((c) => c.id === pack.campaign.id)) return pack.campaign.id
  const name = pack.campaign.name.trim().toLowerCase()
  return campaigns.find((c) => c.name.trim().toLowerCase() === name)?.id ?? null
}

/** Stored id of a pack record: `<campaign>-<id>` (both slugs, so it stays a short, safe id). */
export const packRecordId = (campaignId: string, id: string) => `${campaignId}-${id}`

function parseScene(raw: unknown, fightIds: Map<string, string>, campaignId: string, warnings: string[]): Scene | null {
  if (!isObj(raw)) return null
  const scene = createScene(str(raw.title, 100))
  scene.readAloud = str(raw.readAloud, 5000)
  scene.notes = str(raw.notes, 5000)
  scene.checklist = list(raw.checklist, 50).flatMap((t, i) =>
    typeof t === 'string' && t.trim() ? [{ id: `${scene.id}-${i}`, text: t.slice(0, 300), done: false }] : [])
  const fight = str(raw.fight, 40)
  if (fight) {
    if (fightIds.has(fight)) scene.fightId = packRecordId(campaignId, fight)
    else warnings.push(`ฉาก "${scene.title}" อ้างถึงการต่อสู้ "${fight}" ที่ไม่มีในไฟล์`)
  }
  return scene
}

function parseMonster(raw: unknown): PackMonster | null {
  if (!isObj(raw) || !str(raw.name, 60).trim()) return null
  return {
    name: str(raw.name, 60).trim(),
    count: int(raw.count, 1, 20, 1),
    ac: int(raw.ac, 1, 30, 10),
    hp: int(raw.hp, 1, 999, 1),
    initBonus: int(raw.initBonus, -10, 20, 0),
    notes: str(raw.notes, 500),
    hidden: raw.hidden === true,
  }
}

/** Read a campaign pack file into campaign + notes + fights ready to save (not saved yet). */
export function parseCampaignPack(text: string, now = Date.now()): PackResult {
  if (text.length > MAX_PACK_BYTES) return { ok: false, error: 'ไฟล์ใหญ่เกินไป (เกิน 1 MB)' }
  let data: unknown
  try {
    data = JSON.parse(text)
  } catch {
    return { ok: false, error: 'ไม่ใช่ไฟล์ JSON ที่ถูกต้อง' }
  }
  if (!isObj(data) || data.format !== PACK_FORMAT) return { ok: false, error: 'ไม่ใช่ไฟล์แพ็กแคมเปญของแอปนี้' }
  if (!isObj(data.campaign)) return { ok: false, error: 'ไม่มีข้อมูลแคมเปญ (campaign)' }
  const campaignId = str(data.campaign.id, 40)
  const campaignName = str(data.campaign.name, 100).trim()
  if (!SLUG.test(campaignId) || !campaignName) return { ok: false, error: 'campaign ต้องมี id (a-z 0-9 -) และชื่อ' }

  const warnings: string[] = []
  const seen = new Set<string>()
  const okId = (id: string, what: string) => {
    if (!SLUG.test(id)) return warnings.push(`ข้าม${what}ที่ id ไม่ถูกต้อง: "${id}"`), false
    if (seen.has(id)) return warnings.push(`ข้าม${what}ที่ id ซ้ำ: "${id}"`), false
    seen.add(id)
    return true
  }

  // Fights first, so scenes can link to them.
  const encounters: Encounter[] = []
  const fightIds = new Map<string, string>()
  for (const raw of list(data.fights, MAX_FIGHTS)) {
    if (!isObj(raw)) continue
    const id = str(raw.id, 40)
    if (!okId(id, 'การต่อสู้')) continue
    const e = { ...createEncounter(str(raw.name, 100), campaignId), id: packRecordId(campaignId, id), createdAt: now, updatedAt: now }
    for (const m of list(raw.monsters, 20).map(parseMonster)) {
      if (!m) continue
      const added = createMonsters({ name: m.name, ac: m.ac, hpMax: m.hp, initBonus: m.initBonus }, m.count, e.combatants)
      e.combatants.push(...added.map((c) => ({ ...c, notes: m.notes, ...(m.hidden ? { hidden: true } : {}) })))
    }
    fightIds.set(id, e.id)
    encounters.push(e)
  }

  const notes: Note[] = []
  for (const raw of list(data.pages, MAX_PAGES)) {
    if (!isObj(raw)) continue
    const id = str(raw.id, 40)
    if (!okId(id, 'หน้า')) continue
    const kind = (NOTE_KINDS as readonly string[]).includes(raw.kind as string) ? (raw.kind as NoteKind) : 'session'
    const note = { ...createNote(campaignId, now, kind, str(raw.title, 100).trim()), id: packRecordId(campaignId, id) }
    note.body = str(raw.body, 20000)
    if (isObj(raw.fields)) {
      for (const [k, v] of Object.entries(raw.fields).slice(0, 20)) if (typeof v === 'string') note.fields[k.slice(0, 30)] = v.slice(0, 500)
    }
    if (typeof raw.date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(raw.date)) note.sessionDate = raw.date
    note.scenes = list(raw.scenes, 40).flatMap((s) => parseScene(s, fightIds, campaignId, warnings) ?? [])
    notes.push(note)
  }

  if (notes.length === 0 && encounters.length === 0) return { ok: false, error: 'ไฟล์นี้ไม่มีหน้าหรือการต่อสู้เลย' }
  return { ok: true, pack: { campaign: { id: campaignId, name: campaignName }, notes, encounters }, warnings }
}
