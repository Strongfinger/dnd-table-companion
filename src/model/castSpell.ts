// Casting a spell from the sheet's spell list: what it costs, as the same play actions the sheet and
// the live room already use (Action economy, a spell slot, Concentration). Pure: it only plans.
import type { ActionKind } from '../rules'
import type { Character } from './character'
import type { CharacterAction } from './characterActions'

export interface CastableSpell {
  name: string
  level: number
  /** e.g. "Action", "Bonus Action", "Reaction, which you take when…", "1 minute" */
  castingTime: string
  concentration: boolean
  ritual: boolean
  /** Leveled spells must be prepared (cantrips always are). */
  prepared: boolean
}

const ACTION_LABEL: Record<ActionKind, string> = { action: 'Action', bonusAction: 'Bonus Action', reaction: 'Reaction' }

/** Which of Action / Bonus Action / Reaction the casting takes; null for longer casting times (1 minute, 1 hour…). */
export function actionKindFor(castingTime: string): ActionKind | null {
  const t = castingTime.trim().toLowerCase()
  if (t.startsWith('bonus action')) return 'bonusAction'
  if (t.startsWith('reaction')) return 'reaction'
  if (t.startsWith('action')) return 'action'
  return null
}

/** Slot levels (1–9) the spell can be cast with: its level or higher, with a slot left. */
export function castableSlotLevels(c: Pick<Character, 'spellSlots'>, spellLevel: number): number[] {
  const out: number[] = []
  c.spellSlots.forEach((s, i) => {
    if (i + 1 >= spellLevel && s.used < s.max) out.push(i + 1)
  })
  return out
}

export interface CastPlan {
  actions: CharacterAction[]
  /** Fine to go ahead, but worth knowing (shown before casting). */
  warnings: string[]
  /** Can't cast like this. */
  error: string | null
}

/**
 * Plan a casting. `slotLevel`: the slot to spend (leveled spells; may be higher to upcast).
 * `asRitual`: cast as a Ritual (no slot, takes 10 minutes longer, so no Action in a fight).
 */
export function castPlan(c: Character, s: CastableSpell, choice: { slotLevel: number | null; asRitual: boolean }): CastPlan {
  const warnings: string[] = []
  const actions: CharacterAction[] = []
  const ritual = choice.asRitual && s.ritual
  const kind = ritual ? null : actionKindFor(s.castingTime)

  if (s.level > 0 && !ritual) {
    if (choice.slotLevel === null || !castableSlotLevels(c, s.level).includes(choice.slotLevel)) {
      return { actions: [], warnings, error: 'ไม่มี Spell Slot ที่ใช้ร่ายคาถานี้ได้' }
    }
  }
  if (kind && c.turn[kind]) return { actions: [], warnings, error: `ใช้ ${ACTION_LABEL[kind]} ไปแล้วในเทิร์นนี้` }

  if (s.level > 0 && !s.prepared && !ritual) warnings.push('คาถานี้ยังไม่ได้เตรียมไว้ (Prepared)')
  // 2024: a Ritual needs the spell prepared, except a Wizard casting from the spellbook (Ritual Adept).
  if (ritual && !s.prepared && c.className !== 'Wizard') warnings.push('ร่ายแบบ Ritual ได้เฉพาะคาถาที่เตรียมไว้ (Prepared) · ยกเว้น Wizard ร่ายจาก Spellbook')
  // 2024 "One Spell with a Spell Slot per Turn". Not for a Reaction: those are usually cast on someone
  // else's turn (a different turn), while the flag only resets when this character's own turn starts.
  if (s.level > 0 && !ritual && kind !== 'reaction' && c.turn.spellSlot) warnings.push('ใช้ Spell Slot ไปแล้วในเทิร์นนี้: กติกา 2024 ใช้ Spell Slot ร่ายคาถาได้ 1 ครั้งต่อเทิร์น')
  if (ritual) warnings.push('ร่ายแบบ Ritual: ไม่ใช้ Spell Slot แต่ใช้เวลาเพิ่ม 10 นาที')
  else if (!kind) warnings.push(`ใช้เวลาร่าย ${s.castingTime}`)
  if (s.concentration && c.concentration && c.concentration !== s.name) warnings.push(`Concentration เดิม (${c.concentration}) จะหลุด`)

  const upcast = s.level > 0 && !ritual && choice.slotLevel !== null && choice.slotLevel > s.level
  const what = `ร่าย ${s.name}${ritual ? ' (Ritual)' : upcast ? ` (Level ${choice.slotLevel})` : ''}`
  if (kind) actions.push({ type: 'setActionUsed', kind, used: true, detail: what })
  if (s.level > 0 && !ritual && choice.slotLevel !== null) {
    const i = choice.slotLevel - 1
    actions.push({ type: 'setSlotUsed', level: i, used: c.spellSlots[i].used + 1 })
  }
  if (s.concentration) actions.push({ type: 'setConcentration', spell: s.name })
  return { actions, warnings, error: null }
}
