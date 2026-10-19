// Character export/import as JSON. Imported files come from other people's devices,
// so every field is checked and limited before it is saved: never trust the file.
import {
  ABILITIES, CLASSES, CONDITIONS, MAX_FEATURE_USES, SKILLS,
  type Ability, type AttackInput, type ClassName, type Condition, type ProficiencyLevel, type Skill,
} from '../rules'
import { createCharacter, EQUIP_SLOTS, newId, type Character, type EquipSlot } from './character'
import { parseBuff } from './characterActions'

export const EXPORT_FORMAT = 'dnd-table-companion/character'
export const EXPORT_VERSION = 1
/** Bigger files are rejected before parsing (a real character is a few KB). */
export const MAX_IMPORT_BYTES = 1_000_000

export interface ExportFile {
  format: typeof EXPORT_FORMAT
  version: number
  exportedAt: string
  character: Character
}

export function exportCharacter(c: Character, now = new Date()): string {
  const file: ExportFile = { format: EXPORT_FORMAT, version: EXPORT_VERSION, exportedAt: now.toISOString(), character: c }
  return JSON.stringify(file, null, 2)
}

/** A safe file name like "Boom.json" (Thai letters are kept). */
export function exportFileName(c: Pick<Character, 'name'>): string {
  const safe = c.name.trim().replace(/[^\p{L}\p{N}\p{M}_-]+/gu, '-').replace(/^-+|-+$/g, '').slice(0, 50)
  return `${safe || 'character'}.json`
}

export type ImportResult =
  | { ok: true; character: Character; warnings: string[] }
  | { ok: false; error: string }

/**
 * Read an exported file (or a bare character object) and rebuild a clean Character.
 * Core fields (name, class, level, ability scores) must be valid or the import fails.
 * Other bad fields fall back to defaults and are listed in `warnings` (Thai).
 */
export function parseCharacterImport(text: string): ImportResult {
  if (new Blob([text]).size > MAX_IMPORT_BYTES) return { ok: false, error: 'ไฟล์ใหญ่เกินไป (เกิน 1 MB)' }

  let data: unknown
  try {
    data = JSON.parse(text)
  } catch {
    return { ok: false, error: 'อ่านไฟล์ไม่ได้: ไม่ใช่ JSON ที่ถูกต้อง' }
  }
  if (!isObject(data)) return { ok: false, error: 'ไฟล์ไม่ใช่ข้อมูลตัวละคร' }

  // Accept our export wrapper, or a bare character object.
  let raw: Record<string, unknown> = data
  if (data.format !== undefined) {
    if (data.format !== EXPORT_FORMAT) return { ok: false, error: 'ไฟล์นี้ไม่ใช่ไฟล์ตัวละครของแอปนี้' }
    if (typeof data.version !== 'number' || data.version > EXPORT_VERSION) {
      return { ok: false, error: 'ไฟล์มาจากแอปเวอร์ชันใหม่กว่า กรุณาอัปเดตแอปก่อน' }
    }
    if (!isObject(data.character)) return { ok: false, error: 'ไม่พบข้อมูลตัวละครในไฟล์' }
    raw = data.character
  }

  // Core fields: without these the sheet can't be calculated.
  const name = typeof raw.name === 'string' ? raw.name.trim().slice(0, 100) : ''
  if (!name) return { ok: false, error: 'ไม่มีชื่อตัวละคร' }
  if (!CLASSES.includes(raw.className as ClassName)) return { ok: false, error: `Class "${String(raw.className)}" ไม่ถูกต้อง` }
  const level = raw.level
  if (!isInt(level, 1, 20)) return { ok: false, error: 'Level ต้องเป็นเลข 1–20' }
  if (!isObject(raw.scores) || !ABILITIES.every((a) => isInt((raw.scores as Record<string, unknown>)[a], 1, 30))) {
    return { ok: false, error: 'Ability Scores ต้องเป็นเลข 1–30 ครบทั้ง 6 ค่า' }
  }

  const warnings: string[] = []
  const d = createCharacter()
  /** Use the value if it passes `check`, otherwise the default plus a warning. */
  function field<T>(key: string, check: (v: unknown) => T | undefined, fallback: T, label: string): T {
    if (raw[key] === undefined) return fallback
    const v = check(raw[key])
    if (v === undefined) {
      warnings.push(`${label} ไม่ถูกต้อง ใช้ค่าเริ่มต้นแทน`)
      return fallback
    }
    return v
  }

  const str = (max: number) => (v: unknown) => (typeof v === 'string' ? v.slice(0, max) : undefined)
  const int = (min: number, max: number) => (v: unknown) => (isInt(v, min, max) ? v : undefined)
  const bool = (v: unknown) => (typeof v === 'boolean' ? v : undefined)

  const scores = Object.fromEntries(ABILITIES.map((a) => [a, (raw.scores as Record<Ability, number>)[a]])) as Record<Ability, number>
  const hpMax = isObject(raw.hp) && isInt(raw.hp.max, 1, 999) ? raw.hp.max : d.hp.max
  if (!(isObject(raw.hp) && isInt(raw.hp.max, 1, 999))) warnings.push('Max HP ไม่ถูกต้อง ใช้ค่าเริ่มต้นแทน')

  const character: Character = {
    ...d,
    id: typeof raw.id === 'string' && /^[\w-]{1,64}$/.test(raw.id) ? raw.id : newId(),
    name,
    className: raw.className as ClassName,
    level,
    scores,
    player: field('player', str(100), '', 'ชื่อผู้เล่น'),
    subclass: field('subclass', str(100), '', 'Subclass'),
    species: field('species', str(100), '', 'Species'),
    background: field('background', str(100), '', 'Background'),
    alignment: field('alignment', str(100), '', 'Alignment'),
    // Sync bookkeeping: ids are short safe tokens; the revision is a whole number.
    campaignId: field('campaignId', (v) => (v === null ? null : safeId(v)), null, 'แคมเปญ'),
    ownerDeviceId: field('ownerDeviceId', (v) => (v === '' ? '' : safeId(v)), '', 'เจ้าของ'),
    rev: field('rev', int(0, 1_000_000_000), 0, 'รุ่นข้อมูล'),
    updatedBy: field('updatedBy', (v) => (v === '' ? '' : safeId(v)), '', 'แก้ไขล่าสุดโดย'),
    feats: field('feats', arrayOf(str(100), 20), [], 'Feats'),
    ...(raw.featPicks === undefined ? {} : { featPicks: field('featPicks', arrayOf(featPick, 30), [], 'Feat slots') }),
    saveProficiencies: field('saveProficiencies', subsetOf(ABILITIES), [], 'Saving Throws'),
    skills: field('skills', skillsMap, {}, 'Skills'),
    initiativeProficient: field('initiativeProficient', bool, false, 'Alert'),
    initiativeMisc: field('initiativeMisc', int(-20, 20), 0, 'โบนัส Initiative'),
    spellcastingAbility: field('spellcastingAbility', (v) => (v === null || ABILITIES.includes(v as Ability) ? (v as Ability | null) : undefined), null, 'Spellcasting Ability'),
    attacks: field('attacks', arrayOf(attack, 50), [], 'Attacks'),
    hp: {
      max: hpMax,
      current: isObject(raw.hp) && isInt(raw.hp.current, 0, hpMax) ? raw.hp.current : hpMax,
      temp: isObject(raw.hp) && isInt(raw.hp.temp, 0, 999) ? raw.hp.temp : 0,
    },
    hitDiceSpent: field('hitDiceSpent', int(0, level), 0, 'Hit Dice'),
    deathSaves: field('deathSaves', deathSaves, { successes: 0, failures: 0 }, 'Death Saves'),
    heroicInspiration: field('heroicInspiration', bool, false, 'Heroic Inspiration'),
    exhaustion: field('exhaustion', int(0, 6), 0, 'Exhaustion'),
    conditions: field('conditions', subsetOf(CONDITIONS.filter((x): x is Condition => x !== 'Exhaustion')), [], 'Conditions'),
    concentration: field('concentration', str(100), '', 'Concentration'),
    buffs: field('buffs', arrayOf((v) => parseBuff(v) ?? undefined, 30), [], 'บัฟ/เอฟเฟกต์'),
    turn: field('turn', economy, d.turn, 'Action/Bonus Action/Reaction'),
    features: field('features', arrayOf(feature, 50), [], 'ความสามารถที่ใช้ได้จำกัด'),
    ac: field('ac', int(1, 40), d.ac, 'AC'),
    ...(raw.acAuto === true ? { acAuto: true } : {}),
    ...(raw.srdLinked === true ? { srdLinked: true } : {}),
    ...(raw.acBonus === undefined ? {} : { acBonus: field('acBonus', int(-10, 20), 0, 'โบนัส AC') }),
    speed: field('speed', int(0, 200), d.speed, 'Speed'),
    spellSlots: field('spellSlots', spellSlots, d.spellSlots, 'Spell Slots'),
    spells: field('spells', arrayOf(spell, 500), [], 'Spells'),
    inventory: field('inventory', arrayOf(item, 500), [], 'Inventory'),
    coins: field('coins', coins, d.coins, 'เงิน'),
    proficienciesText: field('proficienciesText', str(20000), '', 'ความชำนาญอื่นๆ'),
    featuresText: field('featuresText', str(20000), '', 'Features & Traits'),
    notes: field('notes', str(20000), '', 'โน้ต'),
    ...(raw.monster === undefined ? {} : { monster: field('monster', monsterMeta, undefined, 'Monster') }),
    // A lock stays a lock: a damaged one keeps no grant.
    ...(raw.levelLock === undefined ? {} : { levelLock: { granted: isObject(raw.levelLock) && isInt(raw.levelLock.granted, 0, 1) ? raw.levelLock.granted as number : 0 } }),
    createdAt: field('createdAt', int(0, 8.64e15), d.createdAt, 'วันที่สร้าง'),
    updatedAt: d.updatedAt,
  }
  return { ok: true, character, warnings }
}

// --- small checkers: each returns the cleaned value, or undefined if it's invalid ---

function safeId(v: unknown): string | undefined {
  return typeof v === 'string' && /^[\w-]{1,64}$/.test(v) ? v : undefined
}

function isObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v)
}

function isInt(v: unknown, min: number, max: number): v is number {
  return Number.isInteger(v) && (v as number) >= min && (v as number) <= max
}

function arrayOf<T>(check: (v: unknown) => T | undefined, maxLength: number) {
  return (v: unknown): T[] | undefined => {
    if (!Array.isArray(v) || v.length > maxLength) return undefined
    const out = v.map(check)
    return out.every((x) => x !== undefined) ? (out as T[]) : undefined
  }
}

function subsetOf<T extends string>(allowed: readonly T[]) {
  return (v: unknown): T[] | undefined =>
    Array.isArray(v) && v.every((x) => allowed.includes(x as T)) ? [...new Set(v as T[])] : undefined
}

// Item ids are only used as list keys, so any short text without control characters is fine.
const noControlChars = (v: string) => [...v].every((ch) => ch.charCodeAt(0) >= 32)
/** A creature played as a character: CR 0–30, PB 2–9, a real Hit Die size, where it came from. */
function monsterMeta(v: unknown): Character['monster'] | undefined {
  if (!isObject(v)) return undefined
  const ok = typeof v.cr === 'number' && v.cr >= 0 && v.cr <= 30 && isInt(v.pb, 2, 9) && [4, 6, 8, 10, 12, 20].includes(v.hitDie as number)
  return ok ? { cr: v.cr as number, pb: v.pb as number, hitDie: v.hitDie as number, source: typeof v.source === 'string' ? v.source.slice(0, 100) : '' } : undefined
}

const itemId = (v: unknown) => (typeof v === 'string' && v.length >= 1 && v.length <= 64 && noControlChars(v) ? v : newId())
const text = (v: unknown, max: number) => (typeof v === 'string' ? v.slice(0, max) : undefined)

function skillsMap(v: unknown): Partial<Record<Skill, ProficiencyLevel>> | undefined {
  if (!isObject(v)) return undefined
  const out: Partial<Record<Skill, ProficiencyLevel>> = {}
  for (const [k, p] of Object.entries(v)) {
    if (!SKILLS.includes(k as Skill) || !['none', 'proficient', 'expertise'].includes(p as string)) return undefined
    if (p !== 'none') out[k as Skill] = p as ProficiencyLevel
  }
  return out
}

function attack(v: unknown): AttackInput | undefined {
  if (!isObject(v) || !ABILITIES.includes(v.ability as Ability)) return undefined
  const name = text(v.name, 100)
  const damageDice = text(v.damageDice, 20)
  if (name === undefined || damageDice === undefined) return undefined
  return {
    id: itemId(v.id),
    name,
    ability: v.ability as Ability,
    proficient: v.proficient !== false,
    damageDice,
    damageType: text(v.damageType, 50) ?? '',
    addModToDamage: v.addModToDamage !== false,
  }
}

function feature(v: unknown): Character['features'][number] | undefined {
  if (!isObject(v) || !isInt(v.max, 1, MAX_FEATURE_USES) || (v.recharge !== 'short' && v.recharge !== 'long' && v.recharge !== 'shortOne')) return undefined
  const name = text(v.name, 100)
  if (name === undefined) return undefined
  const out: Character['features'][number] = { id: itemId(v.id), name, max: v.max, used: isInt(v.used, 0, v.max) ? v.used : 0, recharge: v.recharge }
  if (v.pool === true) out.pool = true
  if (typeof v.srdId === 'string' && /^[a-z0-9-]{1,64}$/.test(v.srdId)) out.srdId = v.srdId
  return out
}

function spellSlots(v: unknown): Character['spellSlots'] | undefined {
  if (!Array.isArray(v) || v.length !== 9) return undefined
  const out = v.map((s) => (isObject(s) && isInt(s.max, 0, 9) ? { max: s.max, used: isInt(s.used, 0, s.max) ? s.used : 0 } : undefined))
  return out.every((x) => x !== undefined) ? (out as Character['spellSlots']) : undefined
}

function spell(v: unknown): Character['spells'][number] | undefined {
  if (!isObject(v) || !isInt(v.level, 0, 9)) return undefined
  const name = text(v.name, 100)
  return name === undefined ? undefined : { id: itemId(v.id), name, level: v.level, prepared: v.prepared === true }
}

function item(v: unknown): Character['inventory'][number] | undefined {
  if (!isObject(v) || !isInt(v.qty, 0, 9999)) return undefined
  const name = text(v.name, 200)
  if (name === undefined) return undefined
  const out: Character['inventory'][number] = { id: itemId(v.id), name, qty: v.qty }
  if (typeof v.srdId === 'string' && /^[a-z0-9-]{1,64}$/.test(v.srdId)) out.srdId = v.srdId
  if (v.equipped === true) out.equipped = true
  if (isSlot(v.slot)) out.slot = v.slot
  if (isSlot(v.wear)) out.wear = v.wear
  return out
}

function isSlot(v: unknown): v is EquipSlot {
  return typeof v === 'string' && (EQUIP_SLOTS as readonly string[]).includes(v)
}

function featPick(v: unknown): NonNullable<Character['featPicks']>[number] | undefined {
  if (!isObject(v) || typeof v.slot !== 'string' || !/^[a-z0-9-]{1,30}$/.test(v.slot)) return undefined
  const feat = text(v.feat, 100)
  if (!feat) return undefined
  const out: NonNullable<Character['featPicks']>[number] = { slot: v.slot, feat }
  if (v.increase !== undefined) {
    if (!isObject(v.increase)) return undefined
    const inc: Partial<Record<Ability, number>> = {}
    for (const [k, n] of Object.entries(v.increase)) {
      if (!ABILITIES.includes(k as Ability) || !isInt(n, 1, 4)) return undefined
      inc[k as Ability] = n
    }
    out.increase = inc
  }
  return out
}

function coins(v: unknown): Character['coins'] | undefined {
  if (!isObject(v)) return undefined
  const keys = ['cp', 'sp', 'ep', 'gp', 'pp'] as const
  if (!keys.every((k) => v[k] === undefined || isInt(v[k], 0, 9_999_999))) return undefined
  return Object.fromEntries(keys.map((k) => [k, (v[k] as number | undefined) ?? 0])) as Character['coins']
}

function economy(v: unknown): Character['turn'] | undefined {
  return isObject(v) && typeof v.action === 'boolean' && typeof v.bonusAction === 'boolean' && typeof v.reaction === 'boolean'
    ? { action: v.action, bonusAction: v.bonusAction, reaction: v.reaction, ...(v.spellSlot === true && { spellSlot: true }) }
    : undefined
}

function deathSaves(v: unknown): Character['deathSaves'] | undefined {
  return isObject(v) && isInt(v.successes, 0, 3) && isInt(v.failures, 0, 3) ? { successes: v.successes, failures: v.failures } : undefined
}
