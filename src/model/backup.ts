// Full backup: everything this device keeps (campaigns, characters, fights, notebook, logs) in one
// JSON file, saved outside the app and loaded back later (same device after a reset, or a new one).
// Pure code: reading/writing the database is in db/backup.ts.
//
// A file may also be the console dump made by hand before this existed: `{ characters: [...], log: [...], ... }`
// with one array per database table. Both are checked record by record like any other import:
// a bad record is skipped with a warning, the rest still loads.
import type { Campaign } from './campaign'
import type { Character } from './character'
import { parseChapter, type Chapter } from './chronicle'
import { withEncounterDefaults, type Combatant, type Encounter } from './encounter'
import { parseCharacterRecord } from './io'
import { NOTE_KINDS, withNoteDefaults, type Note, type NoteKind } from './note'
import type { Scene } from './sessionPlan'
import { newerOf, stamp, type SyncMeta } from './sync'
import type { LogEntry } from '../db/db'

export const BACKUP_FORMAT = 'dnd-table-companion/backup'
export const BACKUP_VERSION = 1
/** A real campaign is a few hundred KB; this only stops a wrong (huge) file. */
export const MAX_BACKUP_BYTES = 50_000_000

/** The tables a backup holds (settings are per device and are not copied, except the selected campaign). */
export interface BackupData {
  campaigns: Campaign[]
  characters: Character[]
  encounters: Encounter[]
  notes: Note[]
  log: LogEntry[]
  /** The journey chronicle (missing in files made before it existed). */
  chapters: Chapter[]
}

export interface BackupFile extends BackupData {
  format: typeof BACKUP_FORMAT
  version: number
  exportedAt: string
  /** The device that made the file (to hand its campaigns over when restoring on another device). */
  deviceId: string
  deviceName: string
  /** null = everything on the device; else only this campaign. */
  campaignId: string | null
  /** The campaign that was selected on that device. */
  currentCampaignId: string | null
}

export const TABLES = ['campaigns', 'characters', 'encounters', 'notes', 'log', 'chapters'] as const
export type Table = (typeof TABLES)[number]

export const TABLE_LABEL: Record<Table, string> = {
  campaigns: '🗺 แคมเปญ', characters: '📜 ตัวละคร', encounters: '⚔️ การต่อสู้', notes: '📒 หน้าสมุด/แผนเซสชัน', log: '📝 บันทึก (log)', chapters: '📚 บันทึกการเดินทาง',
}

/** Only what belongs to one campaign: its characters, fights, pages, and their log lines. */
export function campaignSlice(all: BackupData, campaignId: string): BackupData {
  const characters = all.characters.filter((c) => c.campaignId === campaignId)
  const encounters = all.encounters.filter((e) => e.campaignId === campaignId)
  const charIds = new Set(characters.map((c) => c.id))
  const fightIds = new Set(encounters.map((e) => e.id))
  return {
    campaigns: all.campaigns.filter((c) => c.id === campaignId),
    characters,
    encounters,
    notes: all.notes.filter((n) => n.campaignId === campaignId),
    chapters: all.chapters.filter((c) => c.campaignId === campaignId),
    log: all.log.filter((l) => charIds.has(l.characterId) || (!!l.encounterId && fightIds.has(l.encounterId))),
  }
}

export function makeBackup(
  all: BackupData,
  opts: { deviceId: string; deviceName: string; campaignId: string | null; currentCampaignId: string | null },
  now = new Date(),
): BackupFile {
  const data = opts.campaignId ? campaignSlice(all, opts.campaignId) : all
  return { format: BACKUP_FORMAT, version: BACKUP_VERSION, exportedAt: now.toISOString(), ...opts, ...data }
}

/** e.g. "dnd-backup-2026-10-19.json", or "dnd-backup-Icespire-2026-10-19.json" for one campaign. */
export function backupFileName(now = new Date(), campaignName?: string): string {
  const pad = (n: number) => String(n).padStart(2, '0')
  const day = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`
  const safe = (campaignName ?? '').trim().replace(/[^\p{L}\p{N}\p{M}_-]+/gu, '-').replace(/^-+|-+$/g, '').slice(0, 40)
  return `dnd-backup-${safe ? `${safe}-` : ''}${day}.json`
}

// --- reading a file ---

export type BackupResult = { ok: true; file: BackupFile; warnings: string[] } | { ok: false; error: string }

type Obj = Record<string, unknown>
const isObj = (v: unknown): v is Obj => typeof v === 'object' && v !== null && !Array.isArray(v)
const isId = (v: unknown): v is string => typeof v === 'string' && /^[\w-]{1,64}$/.test(v)
const isNum = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v)
const isInt = (v: unknown, min: number, max: number): v is number => Number.isInteger(v) && (v as number) >= min && (v as number) <= max
const str = (v: unknown, max: number, fallback = '') => (typeof v === 'string' ? v.slice(0, max) : fallback)
const time = (v: unknown, fallback: number) => (isNum(v) && v >= 0 && v < 8.64e15 ? v : fallback)
const campaignRef = (v: unknown) => (isId(v) ? v : null)

/** rev/updatedBy/updatedAt, with safe values when missing (older records). */
function meta(raw: Obj, now: number): SyncMeta {
  return {
    rev: isInt(raw.rev, 0, 1e9) ? raw.rev : 0,
    updatedBy: typeof raw.updatedBy === 'string' ? raw.updatedBy.slice(0, 64) : '',
    updatedAt: time(raw.updatedAt, now),
  }
}

function parseCampaign(raw: unknown, now: number): Campaign | null {
  if (!isObj(raw) || !isId(raw.id) || typeof raw.name !== 'string' || !raw.name.trim()) return null
  return {
    id: raw.id, name: raw.name.trim().slice(0, 100), ownerDeviceId: str(raw.ownerDeviceId, 64),
    createdAt: time(raw.createdAt, now), ...meta(raw, now),
    ...(typeof raw.chronicleId === 'string' && /^[A-Za-z0-9]{1,64}$/.test(raw.chronicleId) ? { chronicleId: raw.chronicleId } : {}),
  }
}

function parseCharacter(raw: unknown, now: number): { character: Character | null; error?: string } {
  if (!isObj(raw)) return { character: null, error: 'ตัวละคร 1 รายการ: ข้อมูลไม่ถูกต้อง' }
  if (!isId(raw.id)) return { character: null, error: `ตัวละคร "${str(raw.name, 50)}" ไม่มี id` }
  const r = parseCharacterRecord(raw)
  if (!r.ok) return { character: null, error: `ตัวละคร "${str(raw.name, 50)}": ${r.error}` }
  // The single-character import gives a new updatedAt; a restore keeps the saved one.
  return { character: { ...r.character, updatedAt: time(raw.updatedAt, now) } }
}

function parseEffect(raw: unknown): Combatant['effects'][number] | null {
  if (!isObj(raw) || typeof raw.id !== 'string' || typeof raw.name !== 'string') return null
  return {
    id: raw.id.slice(0, 64), name: raw.name.slice(0, 100),
    rounds: isInt(raw.rounds, 0, 10_000) ? raw.rounds : null,
    ends: raw.ends === 'start' ? 'start' : 'end',
  }
}

function parseCombatant(raw: unknown): Combatant | null {
  if (!isObj(raw) || typeof raw.id !== 'string' || !raw.id || raw.id.length > 64 || typeof raw.name !== 'string') return null
  if (raw.kind !== 'pc' && raw.kind !== 'monster') return null
  const hp = isObj(raw.hp) ? raw.hp : {}
  const max = isInt(hp.max, 0, 99_999) ? hp.max : 1
  const t = raw.turn
  return {
    id: raw.id, name: raw.name.slice(0, 100), kind: raw.kind,
    characterId: isId(raw.characterId) ? raw.characterId : null,
    initiative: isNum(raw.initiative) ? raw.initiative : null,
    initBonus: isNum(raw.initBonus) ? raw.initBonus : 0,
    dexMod: isNum(raw.dexMod) ? raw.dexMod : 0,
    tieBreak: isNum(raw.tieBreak) ? raw.tieBreak : 0,
    defeated: raw.defeated === true,
    effects: Array.isArray(raw.effects) ? raw.effects.slice(0, 50).flatMap((e) => parseEffect(e) ?? []) : [],
    ac: isInt(raw.ac, 0, 99) ? raw.ac : 10,
    hp: { max, current: isInt(hp.current, 0, max) ? hp.current : max, temp: isInt(hp.temp, 0, 99_999) ? hp.temp : 0 },
    concentration: str(raw.concentration, 100),
    notes: str(raw.notes, 5000),
    ...(isObj(t) && typeof t.action === 'boolean' && typeof t.bonusAction === 'boolean' && typeof t.reaction === 'boolean'
      ? { turn: { action: t.action, bonusAction: t.bonusAction, reaction: t.reaction, ...(t.spellSlot === true && { spellSlot: true }) } }
      : {}),
    ...(typeof raw.hidden === 'boolean' ? { hidden: raw.hidden } : {}),
  }
}

function parseEncounter(raw: unknown, now: number): Encounter | null {
  if (!isObj(raw) || !isId(raw.id) || !Array.isArray(raw.combatants)) return null
  const combatants = raw.combatants.slice(0, 200).flatMap((c) => parseCombatant(c) ?? [])
  const status = raw.status === 'active' || raw.status === 'ended' ? raw.status : 'setup'
  const activeId = typeof raw.activeId === 'string' && combatants.some((c) => c.id === raw.activeId) ? raw.activeId : null
  return withEncounterDefaults({
    id: raw.id, name: str(raw.name, 100) || 'การต่อสู้', campaignId: campaignRef(raw.campaignId),
    status, round: isInt(raw.round, 0, 100_000) ? raw.round : 0, activeId, combatants,
    createdAt: time(raw.createdAt, now), ...meta(raw, now),
  })
}

function parseScene(raw: unknown): Scene | null {
  if (!isObj(raw) || typeof raw.id !== 'string') return null
  return {
    id: raw.id.slice(0, 64), title: str(raw.title, 100), readAloud: str(raw.readAloud, 20_000), notes: str(raw.notes, 20_000),
    checklist: Array.isArray(raw.checklist)
      ? raw.checklist.slice(0, 100).flatMap((c) => (isObj(c) && typeof c.id === 'string' && typeof c.text === 'string'
        ? [{ id: c.id.slice(0, 64), text: c.text.slice(0, 1000), done: c.done === true }] : []))
      : [],
    fightId: isId(raw.fightId) ? raw.fightId : null,
    done: raw.done === true,
  }
}

function parseNote(raw: unknown, now: number): Note | null {
  if (!isObj(raw) || !isId(raw.id)) return null
  const fields: Record<string, string> = {}
  if (isObj(raw.fields)) for (const [k, v] of Object.entries(raw.fields).slice(0, 30)) if (typeof v === 'string') fields[k.slice(0, 30)] = v.slice(0, 2000)
  return withNoteDefaults({
    id: raw.id, campaignId: campaignRef(raw.campaignId),
    kind: (NOTE_KINDS as readonly string[]).includes(raw.kind as string) ? (raw.kind as NoteKind) : 'session',
    title: str(raw.title, 200), fields, body: str(raw.body, 100_000),
    sessionDate: typeof raw.sessionDate === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(raw.sessionDate) ? raw.sessionDate : '',
    scenes: Array.isArray(raw.scenes) ? raw.scenes.slice(0, 100).flatMap((s) => parseScene(s) ?? []) : [],
    createdAt: time(raw.createdAt, now), ...meta(raw, now),
  })
}

function parseLog(raw: unknown): LogEntry | null {
  if (!isObj(raw) || !isId(raw.id) || typeof raw.characterId !== 'string' || raw.characterId.length > 64 || !isNum(raw.at) || typeof raw.text !== 'string') return null
  return {
    id: raw.id, characterId: raw.characterId, at: raw.at, text: raw.text.slice(0, 5000),
    ...(isId(raw.encounterId) ? { encounterId: raw.encounterId } : {}),
    ...(isInt(raw.round, 0, 100_000) ? { round: raw.round } : {}),
    ...(raw.forPlayers === true ? { forPlayers: true as const } : {}),
    ...(raw.fromDm === true ? { fromDm: true as const } : {}),
  }
}

/** Limits per table, so a broken file can't fill the device. */
const MAX_ROWS: Record<Table, number> = { campaigns: 200, characters: 2000, encounters: 2000, notes: 10_000, log: 200_000, chapters: 2000 }

/** Read a backup file (or the older console dump) into clean records, not saved yet. */
export function parseBackup(text: string, now = Date.now()): BackupResult {
  if (text.length > MAX_BACKUP_BYTES) return { ok: false, error: 'ไฟล์ใหญ่เกินไป (เกิน 50 MB)' }
  let data: unknown
  try {
    data = JSON.parse(text)
  } catch {
    return { ok: false, error: 'อ่านไฟล์ไม่ได้: ไม่ใช่ JSON ที่ถูกต้อง' }
  }
  if (!isObj(data)) return { ok: false, error: 'ไฟล์นี้ไม่ใช่ไฟล์สำรองข้อมูลของแอปนี้' }

  let head: Pick<BackupFile, 'exportedAt' | 'deviceId' | 'deviceName' | 'campaignId' | 'currentCampaignId'>
  if (data.format !== undefined) {
    if (data.format !== BACKUP_FORMAT) return { ok: false, error: 'ไฟล์นี้ไม่ใช่ไฟล์สำรองข้อมูล (ไฟล์ตัวละครให้นำเข้าที่หน้ารายชื่อตัวละคร, แพ็กแคมเปญที่หน้า DM)' }
    if (typeof data.version !== 'number' || data.version > BACKUP_VERSION) return { ok: false, error: 'ไฟล์มาจากแอปเวอร์ชันใหม่กว่า กรุณาอัปเดตแอปก่อน' }
    head = {
      exportedAt: str(data.exportedAt, 40), deviceId: str(data.deviceId, 64), deviceName: str(data.deviceName, 40),
      campaignId: campaignRef(data.campaignId), currentCampaignId: campaignRef(data.currentCampaignId),
    }
  } else {
    // The console dump: tables as arrays, settings as { key, value } rows.
    if (!TABLES.some((t) => Array.isArray(data[t]))) return { ok: false, error: 'ไฟล์นี้ไม่ใช่ไฟล์สำรองข้อมูลของแอปนี้' }
    const settings = Array.isArray(data.settings) ? data.settings.filter(isObj) : []
    const setting = (key: string) => settings.find((s) => s.key === key)?.value
    const device = setting('device')
    head = {
      exportedAt: '', deviceId: isObj(device) ? str(device.id, 64) : '', deviceName: isObj(device) ? str(device.name, 40) : '',
      campaignId: null, currentCampaignId: campaignRef(setting('currentCampaignId')),
    }
  }

  const warnings: string[] = []
  const rows = (t: Table): unknown[] => {
    const v = data[t]
    if (v === undefined) return []
    if (!Array.isArray(v)) return warnings.push(`${TABLE_LABEL[t]}: ข้อมูลไม่ใช่รายการ ข้ามไป`), []
    if (v.length > MAX_ROWS[t]) warnings.push(`${TABLE_LABEL[t]}: มีมากเกิน ${MAX_ROWS[t]} รายการ อ่านแค่ ${MAX_ROWS[t]} แรก`)
    return v.slice(0, MAX_ROWS[t])
  }
  /** Keep the records that pass `parse`; the first copy of an id wins. */
  function table<T extends { id: string }>(t: Table, parse: (v: unknown) => T | null, countBad = true): T[] {
    const out = new Map<string, T>()
    let bad = 0
    for (const raw of rows(t)) {
      const r = parse(raw)
      if (!r) bad++
      else if (!out.has(r.id)) out.set(r.id, r)
    }
    if (bad > 0 && countBad) warnings.push(`${TABLE_LABEL[t]}: ข้าม ${bad} รายการที่ข้อมูลไม่ถูกต้อง`)
    return [...out.values()]
  }

  // A skipped character is listed by name (with the reason) instead of only counted.
  const characters = table('characters', (raw) => {
    const r = parseCharacter(raw, now)
    if (r.error) warnings.push(`ข้าม${r.error}`)
    return r.character
  }, false)
  const file: BackupFile = {
    format: BACKUP_FORMAT, version: BACKUP_VERSION, ...head,
    campaigns: table('campaigns', (v) => parseCampaign(v, now)),
    characters,
    encounters: table('encounters', (v) => parseEncounter(v, now)),
    notes: table('notes', (v) => parseNote(v, now)),
    log: table('log', parseLog),
    chapters: table('chapters', (v) => parseChapter(v, now)),
  }
  if (TABLES.every((t) => file[t].length === 0)) return { ok: false, error: 'ไฟล์นี้ไม่มีข้อมูลเลย' }
  return { ok: true, file, warnings }
}

// --- restoring ---

/**
 * `merge`: add what this device doesn't have; a record on both keeps the newer copy (higher revision,
 * then later change), so nothing newer on this device is lost.
 * `replace`: the file wins for every record in it, and records in the file's scope (everything, or its
 * one campaign) that are not in the file are deleted, so the device looks like it did when the file was made.
 */
export type RestoreMode = 'merge' | 'replace'

export interface TableCounts {
  /** Not on this device yet. */
  added: number
  /** On both; the file's copy will be saved. */
  updated: number
  /** On both; this device's copy stays (newer, or the same). */
  kept: number
  /** Only on this device, in the file's scope: deleted with `replace`. */
  deleted: number
}

export interface RestorePlan {
  counts: Record<Table, TableCounts>
  put: BackupData
  delete: Record<Table, string[]>
}

/** JSON with object keys sorted, so the same record compares equal whatever order its fields were saved in. */
function canonical(v: unknown): string {
  if (Array.isArray(v)) return `[${v.map(canonical).join(',')}]`
  if (isObj(v)) return `{${Object.keys(v).filter((k) => v[k] !== undefined).sort().map((k) => `${JSON.stringify(k)}:${canonical(v[k])}`).join(',')}}`
  return JSON.stringify(v) ?? 'null'
}
const same = (a: unknown, b: unknown) => canonical(a) === canonical(b)
/** Same revision, time and device: the same save, even if a field was filled in with a default since. */
const sameSave = (a: SyncMeta, b: SyncMeta) => a.rev === b.rev && a.updatedAt === b.updatedAt && a.updatedBy === b.updatedBy

/**
 * Work out what a restore changes (pure, for the preview and the save).
 * `me`: this device. With `takeOver`, campaigns the file's device owned become this device's, so the DM can
 * keep managing them after moving to a new device. Records keep their ids; a replaced record gets a revision
 * above both copies, so live rooms and other devices take it as the newest.
 */
export function planRestore(file: BackupFile, device: BackupData, mode: RestoreMode, me: string, takeOver: boolean, now = Date.now()): RestorePlan {
  const incoming: BackupData = {
    ...file,
    campaigns: takeOver && file.deviceId && file.deviceId !== me
      ? file.campaigns.map((c) => (c.ownerDeviceId === file.deviceId ? { ...c, ownerDeviceId: me } : c))
      : file.campaigns,
  }
  const scope = file.campaignId ? campaignSlice(device, file.campaignId) : device
  const counts = {} as Record<Table, TableCounts>
  const put = {} as Record<Table, unknown[]>
  const del = {} as Record<Table, string[]>

  for (const t of TABLES) {
    const here = new Map<string, { id: string }>(device[t].map((r) => [r.id, r]))
    const c: TableCounts = { added: 0, updated: 0, kept: 0, deleted: 0 }
    const out: unknown[] = []
    for (const rec of incoming[t] as { id: string }[]) {
      const old = here.get(rec.id)
      if (!old) {
        c.added++
        out.push(rec)
      } else if (same(old, rec)) {
        c.kept++
      } else if (t === 'log') {
        // Log lines have no revision: merge keeps this device's line, replace takes the file's.
        if (mode === 'replace') {
          c.updated++
          out.push(rec)
        } else {
          c.kept++
        }
      } else if (mode === 'replace') {
        c.updated++
        const a = old as unknown as SyncMeta
        const b = rec as unknown as SyncMeta
        out.push(stamp({ ...(rec as unknown as SyncMeta), rev: Math.max(a.rev ?? 0, b.rev ?? 0) }, me, now))
      } else if (!sameSave(rec as unknown as SyncMeta, old as unknown as SyncMeta) && newerOf(rec as unknown as SyncMeta, old as unknown as SyncMeta) === (rec as unknown)) {
        c.updated++
        out.push(rec)
      } else {
        c.kept++
      }
    }
    const inFile = new Set((incoming[t] as { id: string }[]).map((r) => r.id))
    del[t] = mode === 'replace' ? (scope[t] as { id: string }[]).filter((r) => !inFile.has(r.id)).map((r) => r.id) : []
    c.deleted = del[t].length
    counts[t] = c
    put[t] = out
  }
  return { counts, put: put as unknown as BackupData, delete: del }
}
