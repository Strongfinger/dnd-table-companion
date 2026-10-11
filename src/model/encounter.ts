// Encounters for the DM's combat tracker. Monsters keep their own HP here;
// player characters are linked to their saved sheet (HP lives on the sheet).
import {
  CONDITIONS, concentrationDC, deriveSheet, FRESH_TURN, rollDie,
  type ActionEconomy, type Condition, type Rng, type TimedEffect, type TurnCombatant,
} from '../rules'
import { newId, type Character } from './character'

export interface Combatant extends TurnCombatant {
  kind: 'pc' | 'monster'
  /** For PCs: the linked character on this device. */
  characterId: string | null
  /** Added to the d20 when rolling initiative. */
  initBonus: number
  ac: number
  /** Monsters only (a PC's HP is read from its sheet). */
  hp: { max: number; current: number; temp: number }
  concentration: string
  notes: string
  /** Monsters only (a PC's action economy is on its sheet). Missing in older saves = fresh. */
  turn?: ActionEconomy
}

export interface Encounter {
  id: string
  name: string
  status: 'setup' | 'active' | 'ended'
  round: number
  /** Whose turn it is, or null before the fight starts. */
  activeId: string | null
  /** Kept in initiative order. */
  combatants: Combatant[]
  createdAt: number
  updatedAt: number
}

export function createEncounter(name: string): Encounter {
  const now = Date.now()
  return { id: newId(), name: name.trim() || 'การต่อสู้', status: 'setup', round: 0, activeId: null, combatants: [], createdAt: now, updatedAt: now }
}

/** A PC joins the fight: name, AC and initiative bonus come from the sheet. */
export function combatantFromCharacter(c: Character): Combatant {
  const s = deriveSheet(c)
  return {
    id: newId(),
    kind: 'pc',
    characterId: c.id,
    name: c.name,
    initiative: null,
    initBonus: s.initiative,
    dexMod: s.modifiers.dex,
    tieBreak: 0,
    defeated: false,
    effects: [],
    ac: c.ac,
    hp: { ...c.hp },
    concentration: '',
    notes: '',
  }
}

export interface MonsterInput {
  name: string
  ac: number
  hpMax: number
  initBonus: number
  /** Used for initiative ties; defaults to the initiative bonus. */
  dexMod?: number
}

/**
 * Add `count` copies of a monster. More than one get numbers: "Goblin 1", "Goblin 2"…
 * New numbers continue after the highest one already in the fight (so none repeat).
 */
export function createMonsters(input: MonsterInput, count: number, existing: Combatant[] = []): Combatant[] {
  const name = input.name.trim() || 'Monster'
  const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const numberOf = (n: string) => Number(n.match(new RegExp(`^${escaped} (\\d+)$`))?.[1] ?? 0)
  const sameName = existing.filter((c) => c.name === name || numberOf(c.name) > 0)
  // An existing unnumbered "Goblin" counts as number 1.
  const highest = Math.max(0, ...sameName.map((c) => (c.name === name ? 1 : numberOf(c.name))))
  const numbered = count > 1 || sameName.length > 0
  return Array.from({ length: count }, (_, i) => ({
    id: newId(),
    kind: 'monster' as const,
    characterId: null,
    name: numbered ? `${name} ${highest + i + 1}` : name,
    initiative: null,
    initBonus: input.initBonus,
    dexMod: input.dexMod ?? input.initBonus,
    tieBreak: 0,
    defeated: false,
    effects: [],
    ac: input.ac,
    hp: { max: input.hpMax, current: input.hpMax, temp: 0 },
    concentration: '',
    notes: '',
    turn: { ...FRESH_TURN },
  }))
}

export interface MonsterResult {
  combatant: Combatant
  text: string
}

/**
 * Damage a monster: temp HP first, then HP. At 0 HP a monster is defeated
 * (no death saves for ordinary monsters; the DM can bring it back with "ฮีล").
 */
export function damageMonster(m: Combatant, amount: number): MonsterResult {
  const dmg = Math.max(0, Math.floor(amount))
  const fromTemp = Math.min(m.hp.temp, dmg)
  const current = Math.max(0, m.hp.current - (dmg - fromTemp))
  const defeated = current === 0
  const notes = [`${m.name} โดน ${dmg} ดาเมจ → HP ${current}/${m.hp.max}`]
  if (defeated && !m.defeated) notes.push('☠️ ล้ม (ออกจากการต่อสู้)')
  if (m.concentration && defeated) notes.push(`🔮 Concentration (${m.concentration}) หลุด`)
  else if (m.concentration && dmg > 0) notes.push(`🔮 ทอย CON Save DC ${concentrationDC(dmg)} (${m.concentration})`)
  return {
    combatant: { ...m, hp: { ...m.hp, current, temp: m.hp.temp - fromTemp }, defeated: m.defeated || defeated, concentration: defeated ? '' : m.concentration },
    text: notes.join(' · '),
  }
}

/** Heal a monster; healing from 0 brings it back into the fight. */
export function healMonster(m: Combatant, amount: number): MonsterResult {
  const current = Math.min(m.hp.max, m.hp.current + Math.max(0, Math.floor(amount)))
  const back = m.defeated && current > 0
  return {
    combatant: { ...m, hp: { ...m.hp, current }, defeated: m.defeated && !back },
    text: `${m.name} ฮีล ${current - m.hp.current} → HP ${current}/${m.hp.max}${back ? ' (กลับเข้าสู่การต่อสู้)' : ''}`,
  }
}

/** Temp HP doesn't stack: keep the higher value. */
export function tempHpMonster(m: Combatant, amount: number): MonsterResult {
  const temp = Math.max(m.hp.temp, Math.max(0, Math.floor(amount)))
  return {
    combatant: { ...m, hp: { ...m.hp, temp } },
    text: temp === m.hp.temp && m.hp.temp > 0 ? `${m.name}: Temp HP ${amount} ไม่ซ้อนกัน ยังคง ${temp}` : `${m.name} ได้ Temp HP ${temp}`,
  }
}

/** Roll initiative in the app: d20 + bonus, with a log description. */
export function rollInitiative(bonus: number, rng?: Rng): { total: number; how: string } {
  const d20 = rollDie(20, rng)
  return { total: d20 + bonus, how: `🎲 ${d20} ${bonus >= 0 ? '+' : ''}${bonus}` }
}

const CONDITION_NAMES = CONDITIONS.filter((x): x is Condition => x !== 'Exhaustion')
export const isConditionName = (name: string): name is Condition => (CONDITION_NAMES as readonly string[]).includes(name)

/**
 * Conditions to take off a PC's sheet when some of its tracker effects go away:
 * only real conditions, and only if no remaining effect still applies the same one.
 */
export function conditionsToClear(removed: TimedEffect[], remaining: TimedEffect[]): Condition[] {
  const still = new Set(remaining.map((e) => e.name))
  return [...new Set(removed.map((e) => e.name))].filter(isConditionName).filter((n) => !still.has(n))
}

export function addEffect(c: Combatant, name: string, rounds: number | null, ends: TimedEffect['ends']): Combatant {
  return { ...c, effects: [...c.effects, { id: newId(), name, rounds, ends }] }
}

export function removeEffect(c: Combatant, effectId: string): Combatant {
  return { ...c, effects: c.effects.filter((e) => e.id !== effectId) }
}
