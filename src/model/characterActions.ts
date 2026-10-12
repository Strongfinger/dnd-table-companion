// Every change a player can make to a character during play, as a small plain object.
// One function applies them all, so the sheet, the tracker and (later) a live lobby
// change characters the same way: in a lobby, phones will send these to the DM's device.
import {
  ACTION_KINDS, CONDITIONS, hitDieSize, longRest, MAX_FEATURE_USES, shortRest, spellSlotsFor, spendHitDie, startOfTurn,
  type ActionKind, type Condition,
} from '../rules'
import { CONDITION_TH } from './thai'
import {
  damageCharacter, deathSaveCharacter, healCharacter, reviveCharacter, tempHpCharacter, type ActionResult,
} from './actions'
import type { Character } from './character'

/**
 * "set" actions (slot used = 2, condition on) are used instead of "toggle" where possible,
 * so a repeated message can't flip something back. Actions like damage or heal still add up
 * if repeated: the live-lobby message layer (Phase 4) must give each message an id and drop
 * duplicates, and check the sender may change this character (players: only their own).
 * Rolls sent by players are trusted, as at a real table.
 */
export type CharacterAction =
  | { type: 'damage'; amount: number; critical: boolean }
  | { type: 'heal'; amount: number }
  | { type: 'tempHp'; amount: number }
  | { type: 'deathSave'; d20: number; manual: boolean }
  | { type: 'revive' }
  | { type: 'spendHitDie'; roll: number; manual: boolean }
  | { type: 'shortRest' }
  | { type: 'longRest' }
  | { type: 'setSlotUsed'; level: number; used: number }
  | { type: 'setSlotsFromTable' }
  | { type: 'setFeatureUsed'; featureId: string; used: number }
  | { type: 'setExhaustion'; level: number }
  | { type: 'setCondition'; condition: Condition; on: boolean }
  | { type: 'setInspiration'; on: boolean }
  | { type: 'setConcentration'; spell: string }
  /** `detail`: what it was used for, e.g. "Attack: Greatsword" (logged). */
  | { type: 'setActionUsed'; kind: ActionKind; used: boolean; detail?: string }
  | { type: 'resetTurn' }

const SLOT_LABEL = ['1st', '2nd', '3rd', '4th', '5th', '6th', '7th', '8th', '9th']
const hpText = (h: Character['hp']) => `HP ${h.current}/${h.max}${h.temp ? ` (+${h.temp} Temp)` : ''}`
const rollText = (value: number, manual: boolean) => `${manual ? 'ทอยเอง' : '🎲'} ${value}`
const ACTION_LABEL: Record<ActionKind, string> = { action: 'Action', bonusAction: 'Bonus Action', reaction: 'Reaction' }

/**
 * Apply one action. Returns the new character and a log line (Thai), or null when there is
 * nothing to do (e.g. no Hit Dice left, or the value is already set). Text '' = don't log.
 */
export function applyCharacterAction(c: Character, a: CharacterAction): ActionResult | null {
  switch (a.type) {
    case 'damage':
      return damageCharacter(c, a.amount, a.critical)
    case 'heal':
      return healCharacter(c, a.amount)
    case 'tempHp':
      return tempHpCharacter(c, a.amount)
    case 'deathSave':
      return deathSaveCharacter(c, a.d20, a.manual)
    case 'revive':
      return reviveCharacter(c)
    case 'spendHitDie': {
      const size = hitDieSize(c)
      if (a.roll > size) return null // a d6 can't roll 7
      const r = spendHitDie(c, a.roll, c.scores.con)
      if (!r) return null
      return { character: r, text: `${c.name} ใช้ Hit Die d${size}: ${rollText(a.roll, a.manual)} + CON → ฟื้น ${r.hp.current - c.hp.current} · ${hpText(r.hp)}` }
    }
    case 'shortRest':
      return { character: shortRest(c), text: `☕ ${c.name} Short Rest เสร็จ: ความสามารถแบบ Short Rest กลับมาแล้ว` }
    case 'longRest': {
      const r = longRest(c)
      if (!r) return null
      return {
        character: { ...r, conditions: r.conditions.filter((x) => x !== 'Unconscious'), turn: startOfTurn() },
        text: `🌙 ${c.name} Long Rest เสร็จ: ทุกอย่างกลับมาเต็ม` + (c.exhaustion > 0 ? ` · Exhaustion ลดเหลือ ${r.exhaustion}` : ''),
      }
    }
    case 'setSlotUsed': {
      const slot = c.spellSlots[a.level]
      if (!slot) return null
      const used = Math.min(slot.max, Math.max(0, a.used))
      if (used === slot.used) return null
      return {
        character: { ...c, spellSlots: c.spellSlots.map((x, j) => (j === a.level ? { ...x, used } : x)) },
        text: `${c.name} ${used > slot.used ? 'ใช้' : 'คืน'} Spell Slot ${SLOT_LABEL[a.level]} (เหลือ ${slot.max - used}/${slot.max})`,
      }
    }
    case 'setSlotsFromTable':
      return {
        character: { ...c, spellSlots: spellSlotsFor(c.className, c.level).map((max) => ({ max, used: 0 })) },
        text: `ตั้ง Spell Slots ของ ${c.name} ตามตาราง ${c.className} ${c.level}`,
      }
    case 'setFeatureUsed': {
      const f = c.features.find((x) => x.id === a.featureId)
      if (!f) return null
      const used = Math.min(f.max, Math.max(0, a.used))
      if (used === f.used) return null
      return {
        character: { ...c, features: c.features.map((x) => (x.id === f.id ? { ...x, used } : x)) },
        text: f.pool
          ? `${c.name} ${used > f.used ? 'ใช้' : 'คืน'} ${f.name} ${Math.abs(used - f.used)} แต้ม (เหลือ ${f.max - used}/${f.max})`
          : `${c.name} ${used > f.used ? 'ใช้' : 'คืน'} ${f.name} (เหลือ ${f.max - used}/${f.max})`,
      }
    }
    case 'setExhaustion': {
      const level = Math.min(6, Math.max(0, a.level))
      if (level === c.exhaustion) return null
      return { character: { ...c, exhaustion: level }, text: `${c.name}: Exhaustion ${c.exhaustion} → ${level}` }
    }
    case 'setCondition': {
      const has = c.conditions.includes(a.condition)
      if (has === a.on) return null
      return {
        character: { ...c, conditions: a.on ? [...c.conditions, a.condition] : c.conditions.filter((x) => x !== a.condition) },
        text: `${c.name} ${a.on ? 'ติด' : 'หาย'} ${a.condition} (${CONDITION_TH[a.condition]})`,
      }
    }
    case 'setInspiration':
      if (c.heroicInspiration === a.on) return null
      return { character: { ...c, heroicInspiration: a.on }, text: `${c.name} ${a.on ? 'ได้' : 'ใช้'} Heroic Inspiration` }
    case 'setConcentration':
      if (c.concentration === a.spell) return null
      return {
        character: { ...c, concentration: a.spell },
        text: a.spell ? `🔮 ${c.name} Concentration: ${a.spell}` : `🔮 ${c.name} เลิก Concentration${c.concentration ? `: ${c.concentration}` : ''}`,
      }
    case 'setActionUsed':
      if (c.turn[a.kind] === a.used) return null
      return {
        character: { ...c, turn: { ...c.turn, [a.kind]: a.used } },
        // Using it is logged with what it was for; giving it back (fixing a mistap) is not.
        text: a.used ? `⚡ ${c.name} ใช้ ${ACTION_LABEL[a.kind]}${a.detail ? `: ${a.detail}` : ''}` : '',
      }
    case 'resetTurn':
      return { character: { ...c, turn: startOfTurn() }, text: '' }
  }
}

/** For screen labels. */
export const actionLabel = (kind: ActionKind) => ACTION_LABEL[kind]

// --- Validation: an action from another device is untrusted until checked ---

const CONDITION_NAMES = CONDITIONS.filter((x): x is Condition => x !== 'Exhaustion')
const isObj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v)
const isInt = (v: unknown, min: number, max: number): v is number => Number.isInteger(v) && (v as number) >= min && (v as number) <= max
const isBool = (v: unknown): v is boolean => typeof v === 'boolean'

/** Check a received action and rebuild it with only known fields, or null if anything is off. */
export function parseCharacterAction(v: unknown): CharacterAction | null {
  if (!isObj(v) || typeof v.type !== 'string') return null
  switch (v.type) {
    case 'damage':
      return isInt(v.amount, 1, 999) && isBool(v.critical) ? { type: 'damage', amount: v.amount, critical: v.critical } : null
    case 'heal':
    case 'tempHp':
      return isInt(v.amount, 1, 999) ? { type: v.type, amount: v.amount } : null
    case 'deathSave':
      return isInt(v.d20, 1, 20) && isBool(v.manual) ? { type: 'deathSave', d20: v.d20, manual: v.manual } : null
    case 'spendHitDie':
      return isInt(v.roll, 1, 12) && isBool(v.manual) ? { type: 'spendHitDie', roll: v.roll, manual: v.manual } : null
    case 'revive':
    case 'shortRest':
    case 'longRest':
    case 'setSlotsFromTable':
    case 'resetTurn':
      return { type: v.type }
    case 'setSlotUsed':
      return isInt(v.level, 0, 8) && isInt(v.used, 0, 9) ? { type: 'setSlotUsed', level: v.level, used: v.used } : null
    case 'setFeatureUsed':
      return typeof v.featureId === 'string' && v.featureId.length >= 1 && v.featureId.length <= 64 && isInt(v.used, 0, MAX_FEATURE_USES)
        ? { type: 'setFeatureUsed', featureId: v.featureId, used: v.used }
        : null
    case 'setExhaustion':
      return isInt(v.level, 0, 6) ? { type: 'setExhaustion', level: v.level } : null
    case 'setCondition':
      return CONDITION_NAMES.includes(v.condition as Condition) && isBool(v.on) ? { type: 'setCondition', condition: v.condition as Condition, on: v.on } : null
    case 'setInspiration':
      return isBool(v.on) ? { type: 'setInspiration', on: v.on } : null
    case 'setConcentration':
      return typeof v.spell === 'string' && v.spell.length <= 100 ? { type: 'setConcentration', spell: v.spell } : null
    case 'setActionUsed':
      if (!ACTION_KINDS.includes(v.kind as ActionKind) || !isBool(v.used)) return null
      if (v.detail !== undefined && (typeof v.detail !== 'string' || v.detail.length > 100)) return null
      return { type: 'setActionUsed', kind: v.kind as ActionKind, used: v.used, ...(v.detail ? { detail: v.detail } : {}) }
    default:
      return null
  }
}
