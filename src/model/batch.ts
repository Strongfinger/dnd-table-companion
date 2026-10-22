// Several creatures at once in the DM's tracker (select a few, type one damage number).
// Pure functions: they work out what WOULD happen (for the preview) and what to put back (undo);
// nothing here writes to the database. The tracker applies the plan.
import { applyDamage, halfDamage, type Condition, type TimedEffect } from '../rules'
import { damageCharacter, healCharacter, isDead } from './actions'
import type { Character } from './character'
import { addEffect, damageMonster, healMonster, type Combatant } from './encounter'

/** The conditions that come up most at the table (the sketch's list). */
export const QUICK_CONDITIONS: Condition[] = [
  'Prone', 'Poisoned', 'Frightened', 'Stunned', 'Grappled', 'Restrained', 'Blinded', 'Charmed', 'Incapacitated', 'Paralyzed',
]

/** A selected creature, with its sheet if it is a linked PC (a PC's HP lives on the sheet). */
export interface BatchTarget {
  combatant: Combatant
  character?: Character
}

/** What the DM decided for one creature: full damage, half (successful save) or none (not hit). */
export type DamageMode = 'full' | 'half' | 'none'

export interface HpPlan {
  id: string
  name: string
  kind: 'pc' | 'monster'
  hidden: boolean
  mode: DamageMode
  /** The number actually applied after half / none. */
  amount: number
  before: { current: number; temp: number }
  after: { current: number; temp: number }
  /** 'down' = dropped to 0 HP now; 'dead' = a PC that dies; 'up' = healed from 0 HP back into the fight. */
  outcome: 'same' | 'hurt' | 'healed' | 'down' | 'dead' | 'up'
  /** The usual log line for this creature (includes Concentration reminders). */
  text: string
}

/**
 * Work out damage or healing for every target without changing anything.
 * Uses the same functions as the single-creature buttons, so the preview always matches the result.
 * Half damage is rounded down on the total (no resistance/vulnerability/immunity: the DM flags those by hand).
 */
export function planHp(kind: 'damage' | 'heal', targets: BatchTarget[], amount: number, modes: Record<string, DamageMode> = {}): HpPlan[] {
  const total = Math.max(0, Math.floor(amount))
  return targets.map(({ combatant: c, character: ch }) => {
    const mode: DamageMode = kind === 'damage' ? modes[c.id] ?? 'full' : 'full'
    const applied = mode === 'none' ? 0 : mode === 'half' ? halfDamage(total) : total
    const isPc = c.kind === 'pc' && !!ch
    const hp = isPc ? ch.hp : c.hp
    const before = { current: hp.current, temp: hp.temp }
    const base = { id: c.id, name: c.name, kind: c.kind, hidden: !!c.hidden, mode, amount: applied, before }
    if (applied === 0) return { ...base, after: before, outcome: 'same' as const, text: '' }
    if (isPc) {
      const r = kind === 'damage' ? damageCharacter(ch, applied) : healCharacter(ch, applied)
      const after = { current: r.character.hp.current, temp: r.character.hp.temp }
      return { ...base, after, outcome: outcomeOf(kind, before, after, kind === 'damage' ? applyDamage(ch, applied).dead : isDead(r.character)), text: r.text }
    }
    const r = kind === 'damage' ? damageMonster(c, applied) : healMonster(c, applied)
    const after = { current: r.combatant.hp.current, temp: r.combatant.hp.temp }
    return { ...base, after, outcome: outcomeOf(kind, before, after, false), text: r.text }
  })
}

function outcomeOf(kind: 'damage' | 'heal', before: { current: number; temp: number }, after: { current: number; temp: number }, dead: boolean): HpPlan['outcome'] {
  if (dead) return 'dead'
  if (kind === 'damage') return after.current === 0 && before.current > 0 ? 'down' : after.current !== before.current || after.temp !== before.temp ? 'hurt' : 'same'
  if (before.current === 0 && after.current > 0) return 'up'
  return after.current !== before.current ? 'healed' : 'same'
}

/** Targets that don't have the condition yet (a creature that already has it is skipped, no stacking). */
export function planCondition(targets: BatchTarget[], name: string): { apply: BatchTarget[]; skipped: string[] } {
  const has = (t: BatchTarget) => t.combatant.effects.some((e) => e.name === name) || (t.character?.conditions as string[] | undefined)?.includes(name)
  return { apply: targets.filter((t) => !has(t)), skipped: targets.filter(has).map((t) => t.combatant.name) }
}

/** Put a condition (a tracker effect) on a combatant. Rounds null = until removed. */
export const withCondition = (c: Combatant, name: string, rounds: number | null): Combatant => addEffect(c, name, rounds, 'end')

// --- Undo ---------------------------------------------------------------------------------------

/** Everything a batch can change on one creature. */
export interface Vitals {
  hp: { current: number; temp: number }
  concentration: string
  effects: TimedEffect[]
  /** Monsters only: a PC's "defeated" flag is worked out from its sheet, so it is not part of the snapshot. */
  defeated: boolean
  /** PC sheet only. */
  deathSaves: { successes: number; failures: number } | null
  conditions: Condition[] | null
}

export function readVitals(c: Combatant, ch?: Character): Vitals {
  if (c.kind === 'pc' && ch) {
    return {
      hp: { current: ch.hp.current, temp: ch.hp.temp }, concentration: ch.concentration, effects: c.effects, defeated: false,
      deathSaves: { ...ch.deathSaves }, conditions: [...ch.conditions],
    }
  }
  return { hp: { current: c.hp.current, temp: c.hp.temp }, concentration: c.concentration, effects: c.effects, defeated: c.defeated, deathSaves: null, conditions: null }
}

/** Same values? (Condition order on a sheet doesn't matter.) */
export function sameVitals(a: Vitals, b: Vitals): boolean {
  const norm = (v: Vitals) => JSON.stringify({ ...v, conditions: v.conditions && [...v.conditions].sort() })
  return norm(a) === norm(b)
}

export interface Snapshot {
  id: string
  name: string
  characterId: string | null
  before: Vitals
  after: Vitals
}

/** The creatures a batch really changed, with their state before and after (the undo data). */
export function snapshotsOf(
  before: { combatant: Combatant; character?: Character }[], after: Record<string, Vitals | undefined>,
): Snapshot[] {
  return before.flatMap(({ combatant: c, character }) => {
    const b = readVitals(c, character)
    const a = after[c.id]
    return a && !sameVitals(a, b) ? [{ id: c.id, name: c.name, characterId: c.kind === 'pc' ? c.characterId : null, before: b, after: a }] : []
  })
}

/**
 * Which creatures to put back. One that changed since the batch (a player used their phone, or the DM
 * edited it) or that left the fight is skipped, so undo never overwrites newer changes.
 */
export function planUndo(entries: Snapshot[], now: Record<string, Vitals | undefined>): { restore: Snapshot[]; skipped: string[] } {
  const restore: Snapshot[] = []
  const skipped: string[] = []
  for (const e of entries) {
    const v = now[e.id]
    if (v && sameVitals(v, e.after)) restore.push(e)
    else skipped.push(e.name)
  }
  return { restore, skipped }
}

// --- Selecting ----------------------------------------------------------------------------------

/** "Goblin 3" → "Goblin". */
export const baseName = (name: string): string => name.replace(/\s+\d+$/, '')

/** Chips like "Goblin ×3": monsters still in the fight that share a base name (two or more). */
export function groupChips(list: Combatant[]): { label: string; ids: string[] }[] {
  const groups = new Map<string, string[]>()
  for (const c of list) {
    if (c.kind !== 'monster' || c.defeated) continue
    const key = baseName(c.name)
    groups.set(key, [...(groups.get(key) ?? []), c.id])
  }
  return [...groups.entries()].filter(([, ids]) => ids.length >= 2).map(([name, ids]) => ({ label: `${name} ×${ids.length}`, ids }))
}

/** Shift-click: every id between two clicked ones in the list order (both ends included). */
export function rangeIds(order: string[], a: string, b: string): string[] {
  const i = order.indexOf(a)
  const j = order.indexOf(b)
  if (i < 0 || j < 0) return [b]
  return order.slice(Math.min(i, j), Math.max(i, j) + 1)
}

/** A group chip: if the whole group is selected already, take it out; otherwise add it. */
export function toggleGroup(selected: string[], ids: string[]): string[] {
  const all = ids.every((id) => selected.includes(id))
  return all ? selected.filter((id) => !ids.includes(id)) : [...selected, ...ids.filter((id) => !selected.includes(id))]
}
